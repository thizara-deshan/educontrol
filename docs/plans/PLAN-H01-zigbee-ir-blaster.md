# PLAN-H01 — Zigbee IR blaster (ZS06) live
Milestone: `docs/milestones/H01-zigbee-ir-blaster.md` · Start tag: `h01-start` · Verify-all: `pnpm verify`

Inputs read for this plan: H01; INTAKE-01 (§2C, §3, §4, §5B, §5C, Observed); ARCHITECTURE §3.4, §6.7, §6.9, §7.1–§7.3,
§8, §9; SPEC S2.E20 and the coordinator fields (§ zigbee contract); CLAUDE.md; decisions D-22–D-25; PLAN-M10 (format,
deploy helpers). Code: `services/hw/app/{config,contracts,events,registry,main,fake_support}.py`, `transports/mqtt.py`,
`modules/ir/*`, `tests/{helpers,test_ir,test_registry,test_main,test_config,test_deploy_env}.py`, `pyproject.toml`;
`deploy/pi/{install.sh,lib.sh,README.md}`, `steps/*.sh`, `systemd/*`, `env/hw.env.example`, `test/test-lib.sh`; core-api
`domain/ir.ts` (20 s window), `ir/service.ts` + `commands/policies.ts` (blaster gate H25), `hw/client.ts` + `config.ts`
(IR send timeout 3 s, learn 25 s). Live Pi (read-only): `/opt/zigbee2mqtt` (package.json 2.14.2, master commit
`344b6e0`, `dist/` built), its `data/configuration.yaml` (keys only, never copied), `/etc/systemd/system/zigbee2mqtt.service`
(nvm Node), `/etc/mosquitto/conf.d/eduscope-local.conf`, `/usr/bin/node` v24.22.0, mosquitto + mosquitto-clients 2.0.21,
zigbee-herdsman-converters `lib/zosung.js:511` (`timestamp: Date.now()`).
**No UI work:** S1 and S3 already show blaster state, IR controls and the Re-learn/Test flow; this milestone only makes
the hardware behind them real. `reference/screens/` is not needed. No contract change (zod, pydantic schemas, fixtures
stay as they are).

## Executor notes (read once, apply to every task)

- Repo root: `/home/eduscope/edcontrol` on the **R-101 Pi** (H01's machine; mosquitto, zigbee2mqtt and the paired
  ZS06 `r101_ir` are live here). "Run `cmd`" = from the repo root.
- Before T1: `git tag h01-start` (on the commit that adds this plan).
- Apply blocks **verbatim**:
  - "Create `X`" = the block is the full file content (end it with one newline); create missing folders. "Replace
    `X`" = same, over an existing file.
  - "Patch `X`" = run the shell block from the repo root exactly as given. `git apply` prints nothing on success. If it
    prints `error: patch failed`, **stop** and write a Blocker. Never hand-edit around a failed patch.
- **What was verified while writing this plan** (two scratch worktrees on this Pi, every task applied in order as its
  own commit): after each of T1–T6 and T11 `ruff check`, `ruff format --check` and `pytest -m "not hardware"` pass
  (counts: T1 138 · T2 145 · T3 146 · T4 147 · T5–T11 165); after T7–T10 shellcheck 0.11.0 and `test-lib.sh` pass;
  `systemd-analyze verify` accepts `zigbee2mqtt.service`; the T6 hardware tests **pass against the real ZS06**; hw-service
  from the T5 tree with `HW_DRIVERS=ir=real` on a spare port reported `ir: real` and
  `{"blaster": {"online": true, "lqi": null}}` from the live broker. `aiomqtt` resolved to 2.5.1 (+ paho-mqtt 2.1.0).
  **Not verified (needs root, a fresh SD card or a person):** every install.sh run, the udev link, the unit swap,
  the fresh-clone build of zigbee2mqtt (T9 path for a Pi without `/opt/zigbee2mqtt`), reboot, and all S1/S3 checks.
- **`[ON PI · HUMAN]` steps need root or a person in the room.** You have no sudo password. Stop and ask the human to
  type the command with the `!` prefix in the Claude Code prompt (e.g. `! sudo deploy/pi/install.sh`), read its output,
  and continue. If nobody answers, write a Blocker and stop. Never work around sudo.
- **`[ON PI]` steps** (no root) you run yourself on this Pi.
- The services run (`eduscope.target`). `pnpm dev` is not needed in H01.
- After each task: run its **Verify**, then `pnpm verify`; tick the task box in this file; commit with the task's
  message (one commit per task, plan file included).

### Decisions this plan makes (do not re-open them)

- **D1 — Learn refusals keep their code.** `/v1/ir/learn` has no error variant (contract). A driver that refuses a
  learn raises `IrRefused(code, message)` (new, `ir/service.py`); the service reports it as `hw.error` **with that code**
  and answers `timeout`. Any other exception stays `transport`. Send refusals use the same object as an ack error.
  Codes: `ir_mcu` → `invalid` (INTAKE-01 Part A not built); broker down → `transport` "MQTT broker not connected";
  blaster offline → `device_offline` "r101_ir is offline" (same text as the fake).
- **D2 — Transport.** `MqttTransport` (aiomqtt 2.x) is built by the registry, started **after** the services (their
  drivers register exact topics in `start()`; `subscribe()` after `start()` raises), stopped first. It runs only when
  a zigbee module (`lights`, `projector_power`, `ir`, `sensors`, `zigbee_status`) is real. Connecting never blocks startup.
  `publish()` sends JSON with **QoS 1** and a 2 s timeout, so an ack means "the broker accepted it" (core-api waits 3 s).
  No fixed MQTT client id (hw-service and the hardware tests may connect side by side). Backoff 1 → 2 → 4 … → 30 s, reset
  after a successful connect. Unit tests never reach a broker: `make_settings()` points them at port 1.
- **D3 — `ir.blaster`.** `online` = broker connected **and** `<base>/bridge/state` online **and**
  `<base>/r101_ir/availability` online (both retained; JSON `{"state":…}` or legacy plain `online`). On a broker drop
  both flags reset until the retained messages arrive again. `lqi` = last `linkquality` from `<base>/r101_ir`, `null`
  while offline and until the first state message (the state topic is not retained, so `null` after a restart is
  normal; AC2 allows it). The event is emitted only when `(online, lqi)` changes; the driver reports offline once at
  start, so the snapshot is never `null` with a real driver.
- **D4 — Learn freshness.** Arm time = wall clock in ms just before `learn_ir_code: ON`. A capture is the first
  `<base>/r101_ir` message whose `learned_ir_timings` is an object with a numeric `timestamp ≥ arm time` and a non-empty
  `learned_ir_code`. zigbee2mqtt stamps it with its own `Date.now()` on this Pi (zosung.js:511), so the clocks are the same.
  The code is returned exactly as received. Timeout → publish `learn_ir_code: OFF` (a failure only logs a warning).
  Cancel → resolve `cancelled`, then publish OFF. A new learn cancels the one in progress (as the fake does).
- **D5 — `DEFAULT_COORDINATOR` stays unchanged** (deviation from the milestone's "update … firmware revision, by-id
  port"). `zigbee_status` stays fake in H01, so these values are what S2.E20 displays, and SPEC S2.E20 fixes them as UI
  copy (`Z-Stack 3.x.0`, port `zigbee-coord`), as do the zod fixtures and kiosk tests; H01 rules out UI copy changes.
  With D6, `zigbee-coord` is also a real device name now. The firmware revision `20250321` and by-id path stay recorded
  in INTAKE-01 §2C for the later `zigbee_status` Hxx.
- **D6 — udev link `/dev/zigbee-coord`** matches the CH340 by vendor:product (`1a86:7523`). The CH340 has no serial
  number, so this has the **same** limit as the by-id path (a second CH340 would collide) — marked `[ASSUMED]` in the
  rule. The configuration template uses `/dev/zigbee-coord`; R-101's live `configuration.yaml` keeps its by-id path
  (never edited).
- **D7 — `HW_DRIVERS=ir=real`.** `deploy/pi/env/hw.env.example` gets `HW_DRIVERS=ir=real` (new installs come up
  with z2m and a real blaster together). install.sh never rewrites `/etc/eduscope/hw.env` (M10 D4), so on R-101 the
  human sets the line once with `sudoedit` (T11).
- **D8 — zigbee2mqtt version.** Pinned `2.14.2` (tag `5c0c1c6`). An existing `/opt/zigbee2mqtt` whose `package.json`
  says `2.14.2` is accepted as is (R-101's hand clone is master `344b6e0` reporting 2.14.2); another version stops the
  installer with a message (upgrade by hand, README §10). A missing `dist/index.js` is built with the system pnpm.
  `data/configuration.yaml` is written only when missing; nothing else under `data/` is ever touched.
- **D9 — `eduscope-hw.service` is unchanged.** No `Requires=`/`After=mosquitto`: the transport reconnects on its own
  (AC7), and hw keeps serving its other modules while the broker is down.
- **D10 — Docs.** ARCHITECTURE §7.2/§7.3 still say `[ASSUMED]` for the ZS06 path; CLAUDE.md forbids editing it here.
  INTAKE-01 is the record that confirms it. The old transport placeholder docstring is replaced.

## File map

| File | Create/Modify | Responsibility |
|---|---|---|
| `services/hw/app/config.py` | Modify | MQTT host/port, base topic, backoff bounds, publish timeout (T1) |
| `services/hw/tests/helpers.py` | Modify | `make_settings()` never reaches a broker (T1) |
| `services/hw/tests/test_config.py` | Modify | new defaults (T1) |
| `services/hw/pyproject.toml`, `services/hw/uv.lock` | Modify | `aiomqtt` dependency (T2) |
| `services/hw/app/transports/mqtt.py` | Replace | shared aiomqtt client: subscribe, dispatch, publish, reconnect (T2) |
| `services/hw/tests/test_mqtt.py` | Create | transport with an injected client (T2) |
| `services/hw/app/modules/ir/service.py` | Modify | `IrRefused` → `hw.error` with its code (T3) |
| `services/hw/tests/test_ir.py` | Modify | refusal test (T3); stub test replaced (T5) |
| `services/hw/app/registry.py` | Modify | transport lifecycle (T4); real IR gets the transport (T5) |
| `services/hw/tests/test_registry.py` | Modify | transport only with a real zigbee driver (T4); real IR offline without broker (T5) |
| `services/hw/app/modules/ir/driver_real.py` | Replace | ZS06 driver: blaster, send, learn, cancel (T5) |
| `services/hw/tests/fake_mqtt.py` | Create | in-memory `MqttLink` (T5) |
| `services/hw/tests/test_ir_real.py` | Create | driver tests, payloads from INTAKE-01 §2C (T5) |
| `services/hw/tests/test_ir_hardware.py` | Create | `@pytest.mark.hardware` tests (T6) |
| `deploy/pi/steps/50-zigbee.sh` | Create (T7), Modify (T8–T10) | install step: mosquitto, udev, zigbee2mqtt, its unit |
| `deploy/pi/zigbee/eduscope-local.conf` | Create | mosquitto listener 127.0.0.1:1883 (T7) |
| `deploy/pi/zigbee/99-eduscope-zigbee.rules` | Create | `/dev/zigbee-coord` (T8) |
| `deploy/pi/zigbee/configuration.yaml` | Create | zigbee2mqtt template, keys `GENERATE` (T9) |
| `deploy/pi/systemd/zigbee2mqtt.service` | Create | the one zigbee2mqtt, system Node (T10) |
| `deploy/pi/env/hw.env.example`, `services/hw/tests/test_deploy_env.py` | Modify | `HW_DRIVERS=ir=real` (T11) |
| `deploy/pi/README.md` | Modify | Zigbee section, hw.env, units table (T12) |
| this plan | Modify | ticks, Blockers |

Order: config → transport → service rule → wiring → driver → hardware tests → deploy step pieces in run order →
env → README → acceptance. `install.sh` sources `steps/[0-9][0-9]-*.sh` in name order, so `50-zigbee.sh` runs after the
build (30) and kiosk (40) and before the services (90) without touching `install.sh`.

## Tasks

### T1 — Settings for the MQTT broker
- [x] done

**Files:** `services/hw/app/config.py`, `services/hw/tests/helpers.py`, `services/hw/tests/test_config.py`

**Context:** INTAKE-01 §5B config list; ARCHITECTURE §7.1 (`MQTT_HOST`, `MQTT_PORT`, `Z2M_BASE_TOPIC`); CLAUDE.md "no
hardcoded topics/ports". `ir_node="r101_ir"` already exists and stays. Decision D2 (tests use port 1).

**Do:**
1. Patch the three files:
```sh
git apply <<'PATCH'
diff --git a/services/hw/app/config.py b/services/hw/app/config.py
index 65ebaac..ab43d0a 100644
--- a/services/hw/app/config.py
+++ b/services/hw/app/config.py
@@ -109,7 +109,17 @@ class Settings(BaseSettings):
     # Events buffered per SSE subscriber; a subscriber that falls this far behind is dropped.
     subscriber_queue: int = Field(default=256, ge=1)
 
-    # Friendly names [ASSUMED] (ARCHITECTURE §7.1)
+    # zigbee2mqtt broker (INTAKE-01 §2C: mosquitto on this Pi, 127.0.0.1:1883, anonymous).
+    mqtt_host: str = "127.0.0.1"
+    mqtt_port: int = Field(default=1883, ge=1, le=65535)
+    z2m_base_topic: str = "zigbee2mqtt"
+    # Reconnect backoff doubles from min to max seconds (INTAKE-01 §5B: 1 → 30 s).
+    mqtt_reconnect_min_s: float = Field(default=1.0, gt=0)
+    mqtt_reconnect_max_s: float = Field(default=30.0, gt=0)
+    # A QoS 1 publish the broker has not accepted after this long fails (core-api waits 3 s).
+    mqtt_publish_timeout_s: float = Field(default=2.0, gt=0)
+
+    # Friendly names [ASSUMED] (ARCHITECTURE §7.1); ir_node confirmed on hardware (INTAKE-01 §2C)
     lights_node: str = "r101_lights"
     proj_plug_node: str = "r101_proj_plug"
     ir_node: str = "r101_ir"
diff --git a/services/hw/tests/helpers.py b/services/hw/tests/helpers.py
index 08f4537..976a7da 100644
--- a/services/hw/tests/helpers.py
+++ b/services/hw/tests/helpers.py
@@ -14,7 +14,7 @@ E = TypeVar("E", bound=HwEnvelope)
 
 
 def make_settings(**overrides: object) -> Settings:
-    """Fast fake time (1000x), periodic readings and heartbeat effectively off unless overridden."""
+    """Fast fake time (1000x), periodic readings and heartbeat effectively off, no MQTT broker."""
     values: dict[str, object] = {
         "mode": "fake",
         "drivers": "",
@@ -22,6 +22,11 @@ def make_settings(**overrides: object) -> Settings:
         "fake_time_scale": 1000.0,
         "fake_report_interval_s": 3600.0,
         "heartbeat_s": 3600.0,
+        # Real-zigbee tests never reach a broker (on the Pi mosquitto listens on 1883):
+        # port 1 refuses at once, and the transport retries quickly until the test stops it.
+        "mqtt_port": 1,
+        "mqtt_reconnect_min_s": 0.01,
+        "mqtt_reconnect_max_s": 0.05,
         **overrides,
     }
     return Settings(_env_file=None, **values)
diff --git a/services/hw/tests/test_config.py b/services/hw/tests/test_config.py
index c8009e0..f964f02 100644
--- a/services/hw/tests/test_config.py
+++ b/services/hw/tests/test_config.py
@@ -18,6 +18,10 @@ def test_defaults_are_fake_on_loopback() -> None:
         "r101_door",
     ]
     assert settings.coordinator.model == "ZG-808Z"
+    assert (settings.mqtt_host, settings.mqtt_port) == ("127.0.0.1", 1883)
+    assert settings.z2m_base_topic == "zigbee2mqtt"
+    assert settings.ir_node == "r101_ir"
+    assert (settings.mqtt_reconnect_min_s, settings.mqtt_reconnect_max_s) == (1.0, 30.0)
 
 
 def test_reads_hw_prefixed_env(monkeypatch: pytest.MonkeyPatch) -> None:
PATCH
```

**Test:** included above (`test_defaults_are_fake_on_loopback` asserts the new defaults).

**Verify:** `uv run --directory services/hw pytest tests/test_config.py -q` → all pass; `pnpm verify` green (hw: 138
passed).

**Commit:** `git commit -m "feat(hw): MQTT broker settings for zigbee2mqtt"`

### T2 — Shared MQTT transport (`transports/mqtt.py`)
- [x] done

**Files:** `services/hw/pyproject.toml`, `services/hw/uv.lock`, `services/hw/app/transports/mqtt.py`,
`services/hw/tests/test_mqtt.py`

**Context:** D-13 (aiomqtt, one client), INTAKE-01 §5B (reconnect 1 → 30 s, `connected`), ARCHITECTURE §7.1; Decision D2.
aiomqtt 2.x API used: `aiomqtt.Client(hostname=, port=)` as async context manager, `await client.subscribe(topic, qos=1)`,
`async for m in client.messages` (raises `aiomqtt.MqttError` on disconnect), `str(m.topic)`, `m.payload` (bytes),
`await client.publish(topic, payload, qos=1, timeout=s)` (waits for PUBACK; raises `MqttError` on timeout).

**Do:**
1. Run `uv add --directory services/hw "aiomqtt>=2.4"` → `pyproject.toml` gains `"aiomqtt>=2.4",` at the end of
   `dependencies`; `uv.lock` gains `aiomqtt` and `paho-mqtt`.
2. Replace `services/hw/app/transports/mqtt.py`:
```python
"""Shared zigbee2mqtt client for the real zigbee drivers (D-13, ARCHITECTURE §7.1, INTAKE-01 §5B).

One `aiomqtt` client per process. Drivers register exact topics with `subscribe()` before
`start()` (the registry starts the services first) and get every message on them. `publish()`
sends one JSON object with QoS 1, so it returns only once the broker accepted it (the ZS06 itself
never acknowledges, §2C). The connection loop reconnects with a doubling backoff
(`HW_MQTT_RECONNECT_MIN_S` → `HW_MQTT_RECONNECT_MAX_S`) and reports every up/down change to the
`on_connection` listeners.
"""

import asyncio
import json
from collections.abc import AsyncIterator, Callable, Mapping
from contextlib import AbstractAsyncContextManager, suppress
from typing import Protocol

import aiomqtt

from app.config import Settings
from app.contracts import logger

# A message payload: the parsed JSON value, or the decoded text when it is not JSON.
MessageHandler = Callable[[object], None]
ConnectionHandler = Callable[[bool], None]


class MqttNotConnected(ConnectionError):
    """`publish()` while the broker is not connected (drivers answer `transport`)."""

    def __init__(self) -> None:
        super().__init__("MQTT broker not connected")


class MqttLink(Protocol):
    """What a real zigbee driver needs from the transport. Tests inject an in-memory one."""

    @property
    def connected(self) -> bool: ...

    def subscribe(self, topic: str, handler: MessageHandler) -> None: ...

    def on_connection(self, handler: ConnectionHandler) -> None: ...

    async def publish(self, topic: str, payload: Mapping[str, object]) -> None: ...


class MqttMessage(Protocol):
    @property
    def topic(self) -> object: ...  # aiomqtt.Topic; str() gives the topic text

    @property
    def payload(self) -> object: ...


class MqttClient(Protocol):
    """The part of `aiomqtt.Client` this transport uses (a fake in tests/test_mqtt.py)."""

    @property
    def messages(self) -> AsyncIterator[MqttMessage]: ...

    async def subscribe(self, topic: str, qos: int = 0) -> object: ...

    async def publish(
        self,
        topic: str,
        payload: str,
        qos: int = 0,
        *,
        timeout: float | None = None,  # noqa: ASYNC109 - aiomqtt.Client.publish's own parameter
    ) -> None: ...


ClientFactory = Callable[[], AbstractAsyncContextManager[MqttClient]]


def next_backoff(delay_s: float, max_s: float) -> float:
    """1 → 2 → 4 → … → max_s (INTAKE-01 §5B: 1 → 30 s)."""
    return min(delay_s * 2, max_s)


def decode_payload(raw: object) -> object:
    """MQTT bytes → parsed JSON, or the plain text when it is not JSON (e.g. legacy `online`)."""
    text = raw.decode("utf-8", errors="replace") if isinstance(raw, bytes | bytearray) else raw
    if not isinstance(text, str):
        return text
    try:
        parsed: object = json.loads(text)
    except ValueError:
        return text
    return parsed


class MqttTransport:
    def __init__(self, settings: Settings, client_factory: ClientFactory | None = None) -> None:
        self._settings = settings
        self._client_factory = client_factory or self._aiomqtt_client
        self._handlers: dict[str, list[MessageHandler]] = {}
        self._connection_handlers: list[ConnectionHandler] = []
        self._client: MqttClient | None = None
        self._connected = False
        self._task: asyncio.Task[None] | None = None

    @property
    def connected(self) -> bool:
        return self._connected

    def subscribe(self, topic: str, handler: MessageHandler) -> None:
        """Registers `handler` for exactly `topic`; subscribed again on every connect."""
        if self._task is not None:
            raise RuntimeError(f"mqtt: subscribe({topic!r}) after start()")
        self._handlers.setdefault(topic, []).append(handler)

    def on_connection(self, handler: ConnectionHandler) -> None:
        self._connection_handlers.append(handler)

    async def publish(self, topic: str, payload: Mapping[str, object]) -> None:
        client = self._client
        if client is None or not self._connected:
            raise MqttNotConnected
        await client.publish(
            topic, json.dumps(payload), qos=1, timeout=self._settings.mqtt_publish_timeout_s
        )

    async def start(self) -> None:
        """Starts the connection loop in the background; never waits for the broker."""
        if self._task is None:
            self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        task, self._task = self._task, None
        if task is not None:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task

    def _aiomqtt_client(self) -> AbstractAsyncContextManager[MqttClient]:
        # No fixed client id: hw-service and the [ON PI] hardware tests may connect side by side.
        return aiomqtt.Client(hostname=self._settings.mqtt_host, port=self._settings.mqtt_port)

    async def _run(self) -> None:
        delay = self._settings.mqtt_reconnect_min_s
        while True:
            try:
                async with self._client_factory() as client:
                    for topic in list(self._handlers):
                        await client.subscribe(topic, qos=1)
                    self._client = client
                    self._set_connected(True)
                    logger.info(
                        "mqtt: connected to %s:%d",
                        self._settings.mqtt_host,
                        self._settings.mqtt_port,
                    )
                    delay = self._settings.mqtt_reconnect_min_s
                    async for message in client.messages:
                        self._dispatch(str(message.topic), message.payload)
            except (aiomqtt.MqttError, OSError) as exc:
                logger.warning("mqtt: %s; reconnecting in %.0f s", exc, delay)
            finally:
                self._client = None
                self._set_connected(False)
            await asyncio.sleep(delay)
            delay = next_backoff(delay, self._settings.mqtt_reconnect_max_s)

    def _dispatch(self, topic: str, raw: object) -> None:
        payload = decode_payload(raw)
        for handler in list(self._handlers.get(topic, [])):
            try:
                handler(payload)
            except Exception:
                logger.exception("mqtt: handler for %s failed", topic)

    def _set_connected(self, connected: bool) -> None:
        if connected == self._connected:
            return
        self._connected = connected
        for handler in list(self._connection_handlers):
            handler(connected)
```
3. Create `services/hw/tests/test_mqtt.py`:
```python
"""MqttTransport with an injected aiomqtt-like client: subscribe on connect, dispatch, publish,
reconnect with backoff."""

import asyncio
import json
from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from dataclasses import dataclass

import aiomqtt
import pytest

from app.transports.mqtt import (
    MqttClient,
    MqttNotConnected,
    MqttTransport,
    decode_payload,
    next_backoff,
)
from tests.helpers import make_settings


@dataclass
class Message:
    topic: str
    payload: object


class FakeClient:
    """One connection. `drop()` ends it the way aiomqtt does: the message iterator raises."""

    def __init__(self) -> None:
        self.subscribed: list[str] = []
        self.published: list[tuple[str, str, int]] = []
        self._queue: asyncio.Queue[Message | None] = asyncio.Queue()

    async def subscribe(self, topic: str, qos: int = 0) -> object:
        self.subscribed.append(topic)
        return None

    async def publish(
        self,
        topic: str,
        payload: str,
        qos: int = 0,
        *,
        timeout: float | None = None,  # noqa: ASYNC109 - mirrors aiomqtt.Client.publish
    ) -> None:
        self.published.append((topic, payload, qos))

    def push(self, topic: str, payload: object) -> None:
        self._queue.put_nowait(Message(topic, payload))

    def drop(self) -> None:
        self._queue.put_nowait(None)

    @property
    def messages(self) -> AsyncIterator[Message]:
        return self._iterate()

    async def _iterate(self) -> AsyncIterator[Message]:
        while True:
            message = await self._queue.get()
            if message is None:
                raise aiomqtt.MqttError("Disconnected during message iteration")
            yield message


class Broker:
    """Client factory: each connect hands out a new FakeClient; `refuse` = broker down."""

    def __init__(self) -> None:
        self.clients: list[FakeClient] = []
        self.refuse = 0
        self.connects = asyncio.Event()

    def factory(self) -> AbstractAsyncContextManager[MqttClient]:
        return self._connect()

    @asynccontextmanager
    async def _connect(self) -> AsyncIterator[MqttClient]:
        if self.refuse > 0:
            self.refuse -= 1
            raise aiomqtt.MqttError("[Errno 111] Connection refused")
        client = FakeClient()
        self.clients.append(client)
        self.connects.set()
        yield client


async def until(condition: Callable[[], object], within: float = 1.0) -> None:
    async with asyncio.timeout(within):
        while not condition():  # noqa: ASYNC110 - polls state another task changes
            await asyncio.sleep(0.001)


def test_backoff_doubles_up_to_the_max() -> None:
    delays = [1.0]
    for _ in range(6):
        delays.append(next_backoff(delays[-1], 30.0))
    assert delays == [1.0, 2.0, 4.0, 8.0, 16.0, 30.0, 30.0]


def test_decode_payload() -> None:
    assert decode_payload(b'{"state":"online"}') == {"state": "online"}
    assert decode_payload(b"online") == "online"
    assert decode_payload(bytearray(b"[1, 2]")) == [1, 2]
    assert decode_payload(None) is None


async def test_subscribes_dispatches_and_publishes_json_with_qos_1() -> None:
    broker = Broker()
    transport = MqttTransport(make_settings(), broker.factory)
    seen: list[object] = []
    states: list[bool] = []
    transport.subscribe("zigbee2mqtt/r101_ir", seen.append)
    transport.on_connection(states.append)
    assert transport.connected is False
    await transport.start()
    await until(lambda: transport.connected)
    client = broker.clients[0]
    assert client.subscribed == ["zigbee2mqtt/r101_ir"]
    client.push("zigbee2mqtt/r101_ir", b'{"linkquality":170}')
    client.push("zigbee2mqtt/other", b"{}")
    await until(lambda: seen)
    assert seen == [{"linkquality": 170}]
    await transport.publish("zigbee2mqtt/r101_ir/set", {"learn_ir_code": "ON"})
    topic, payload, qos = client.published[0]
    assert (topic, json.loads(payload), qos) == (
        "zigbee2mqtt/r101_ir/set",
        {"learn_ir_code": "ON"},
        1,
    )
    await transport.stop()
    assert transport.connected is False
    assert states == [True, False]


async def test_publish_without_a_connection_raises() -> None:
    transport = MqttTransport(make_settings(), Broker().factory)
    with pytest.raises(MqttNotConnected, match="MQTT broker not connected"):
        await transport.publish("t", {})


async def test_reconnects_and_resubscribes_after_a_drop() -> None:
    broker = Broker()
    broker.refuse = 2  # broker down at start: two refused connects, then up
    transport = MqttTransport(make_settings(), broker.factory)
    states: list[bool] = []
    transport.subscribe("zigbee2mqtt/bridge/state", lambda _payload: None)
    transport.on_connection(states.append)
    await transport.start()
    await until(lambda: transport.connected)
    broker.clients[0].drop()
    await until(lambda: len(broker.clients) == 2 and transport.connected)
    assert broker.clients[1].subscribed == ["zigbee2mqtt/bridge/state"]
    assert states == [True, False, True]
    await transport.stop()


async def test_a_failing_handler_does_not_stop_the_others() -> None:
    broker = Broker()
    transport = MqttTransport(make_settings(), broker.factory)
    seen: list[object] = []

    def broken(_payload: object) -> None:
        raise ValueError("boom")

    transport.subscribe("t", broken)
    transport.subscribe("t", seen.append)
    await transport.start()
    await until(lambda: transport.connected)
    broker.clients[0].push("t", b"1")
    await until(lambda: seen)
    assert seen == [1]
    await transport.stop()


async def test_subscribe_after_start_is_a_bug() -> None:
    transport = MqttTransport(make_settings(), Broker().factory)
    await transport.start()
    with pytest.raises(RuntimeError):
        transport.subscribe("t", lambda _payload: None)
    await transport.stop()
```

**Test:** `tests/test_mqtt.py` above — backoff sequence, payload decoding, subscribe + dispatch + QoS 1 JSON publish,
publish while disconnected raises, reconnect after two refused connects and a drop with resubscribe, a failing
handler doesn't stop the others, `subscribe()` after `start()` raises.

**Verify:** `uv run --directory services/hw pytest tests/test_mqtt.py -q` → `7 passed`; `pnpm verify` green (hw: 145).

**Commit:** `git commit -m "feat(hw): shared aiomqtt transport with reconnect backoff"`

### T3 — `IrRefused`: a refused learn reports its own error code
- [x] done

**Files:** `services/hw/app/modules/ir/service.py`, `services/hw/tests/test_ir.py`

**Context:** ARCHITECTURE §3.4 (`HwIrLearnResult` has no error variant; `hw.error {module, code, message}`); Decision D1.

**Do:**
1. Patch both files:
```sh
git apply <<'PATCH'
diff --git a/services/hw/app/modules/ir/service.py b/services/hw/app/modules/ir/service.py
index 352768c..afaca9c 100644
--- a/services/hw/app/modules/ir/service.py
+++ b/services/hw/app/modules/ir/service.py
@@ -3,7 +3,15 @@
 from collections.abc import Callable
 from typing import Protocol
 
-from app.contracts import HwAck, HwDriverKind, HwErrorData, HwErrorEvent, guard, logger
+from app.contracts import (
+    HwAck,
+    HwDriverKind,
+    HwErrorCode,
+    HwErrorData,
+    HwErrorEvent,
+    guard,
+    logger,
+)
 from app.events import EventBus
 from app.modules.ir.schemas import (
     HwIrBlasterEvent,
@@ -19,6 +27,14 @@ IrEvent = HwIrBlasterEvent | HwIrLearnEvent
 IrEmit = Callable[[IrEvent], None]
 
 
+class IrRefused(Exception):
+    """A driver refuses a command: `send` answers it as an ack error, `learn` as `hw.error`."""
+
+    def __init__(self, code: HwErrorCode, message: str) -> None:
+        super().__init__(message)
+        self.code: HwErrorCode = code
+
+
 class IrDriver(Protocol):
     kind: HwDriverKind
 
@@ -54,13 +70,19 @@ class IrService:
     async def learn(self, request: HwIrLearnRequest) -> HwIrLearnResult:
         """The learn response has no error variant: a driver failure is reported as `hw.error`
         and answered with `timeout` (nothing was captured, the old code stays untouched)."""
+        code: HwErrorCode
         try:
             return await self.driver.learn(request)
+        except IrRefused as exc:
+            code = exc.code
+            message = str(exc)
         except Exception as exc:
-            logger.warning("ir learn failed: %s", exc)
-            data = HwErrorData(module="ir", code="transport", message=f"ir: {exc}")
-            self._bus.publish(HwErrorEvent(data=data))
-            return HwIrLearnTimeout(status="timeout")
+            code = "transport"
+            message = str(exc)
+        logger.warning("ir learn failed (%s): %s", code, message)
+        data = HwErrorData(module="ir", code=code, message=f"ir: {message}")
+        self._bus.publish(HwErrorEvent(data=data))
+        return HwIrLearnTimeout(status="timeout")
 
     async def cancel_learn(self) -> HwAck:
         return await guard("ir", self.driver.cancel_learn())
diff --git a/services/hw/tests/test_ir.py b/services/hw/tests/test_ir.py
index 2c8b9b7..ba052d6 100644
--- a/services/hw/tests/test_ir.py
+++ b/services/hw/tests/test_ir.py
@@ -11,11 +11,12 @@ from app.modules.ir.schemas import (
     HwIrLearnCaptured,
     HwIrLearnEvent,
     HwIrLearnRequest,
+    HwIrLearnResult,
     HwIrLearnTimeout,
     HwIrSendRequest,
     HwIrSnapshot,
 )
-from app.modules.ir.service import IrService
+from app.modules.ir.service import IrRefused, IrService
 from tests.helpers import http_client, make_settings, next_event
 
 SEND = HwIrSendRequest(transport="ir_zs06", code_format="tuya", code="C/8hRgHrBkYBgAMH")
@@ -97,6 +98,21 @@ async def test_cancel_ends_a_learn_in_progress() -> None:
     assert await learn_statuses(sub, 1) == ["cancelled"]
 
 
+class RefusingIrDriver(FakeIrDriver):
+    async def learn(self, request: HwIrLearnRequest) -> HwIrLearnResult:
+        raise IrRefused("invalid", "ir_mcu is not available yet")
+
+
+async def test_a_refused_learn_reports_its_code_and_times_out() -> None:
+    bus = EventBus(8)
+    sub = bus.subscribe()
+    service = IrService(RefusingIrDriver(make_settings()), bus)
+    await service.start()
+    assert await service.learn(LEARN) == HwIrLearnTimeout(status="timeout")
+    error = await next_event(sub, HwErrorEvent)
+    assert (error.data.code, error.data.message) == ("invalid", "ir: ir_mcu is not available yet")
+
+
 async def test_real_driver_errors_become_transport_and_timeout() -> None:
     bus = EventBus(8)
     sub = bus.subscribe()
PATCH
```

**Test:** `test_a_refused_learn_reports_its_code_and_times_out` (above). The existing
`test_real_driver_errors_become_transport_and_timeout` still passes (generic exception → `transport`).

**Verify:** `uv run --directory services/hw pytest tests/test_ir.py -q` → all pass; `pnpm verify` green (hw: 146).

**Commit:** `git commit -m "feat(hw): IR learn refusals keep their error code"`

### T4 — Registry runs the transport when a zigbee driver is real
- [x] done

**Files:** `services/hw/app/registry.py`, `services/hw/tests/test_registry.py`

**Context:** ARCHITECTURE §7.1 ("started in the FastAPI lifespan only when any real zigbee driver is active"; the
lifespan calls `registry.start()/stop()`); Decision D2. `RealIrDriver(settings)` is unchanged in this task (T5 changes it).

**Do:**
1. Patch both files:
```sh
git apply <<'PATCH'
diff --git a/services/hw/app/registry.py b/services/hw/app/registry.py
index 5480db0..a9bbb06 100644
--- a/services/hw/app/registry.py
+++ b/services/hw/app/registry.py
@@ -44,8 +44,17 @@ from app.modules.zigbee_status import router as zigbee_router
 from app.modules.zigbee_status.driver_real import RealZigbeeStatusDriver
 from app.modules.zigbee_status.service import ZigbeeStatusService
 from app.snapshot import HwSnapshot, HwSnapshotEvent
+from app.transports.mqtt import MqttTransport
 
 MODULES: tuple[HwModule, ...] = get_args(HwModule)
+# Modules whose real driver talks to zigbee2mqtt; any of them real ⇒ the MQTT transport runs.
+ZIGBEE_MODULES: tuple[HwModule, ...] = (
+    "lights",
+    "projector_power",
+    "ir",
+    "sensors",
+    "zigbee_status",
+)
 
 
 def parse_driver_overrides(raw: str) -> dict[HwModule, HwDriverKind]:
@@ -83,6 +92,7 @@ class Registry:
     sensors: SensorsService
     zigbee_status: ZigbeeStatusService
     fake_routers: list[APIRouter] = field(default_factory=list)
+    mqtt: MqttTransport | None = None
 
     def routers(self) -> list[APIRouter]:
         return [
@@ -106,8 +116,13 @@ class Registry:
         await self.audio.start()
         await self.sensors.start()
         await self.zigbee_status.start()
+        # After the services: their drivers subscribe their topics in start().
+        if self.mqtt is not None:
+            await self.mqtt.start()
 
     async def stop(self) -> None:
+        if self.mqtt is not None:
+            await self.mqtt.stop()
         await self.zigbee_status.stop()
         await self.sensors.stop()
         await self.audio.stop()
@@ -149,6 +164,9 @@ class Registry:
 def build_registry(settings: Settings, bus: EventBus) -> Registry:
     kinds = driver_kinds(settings)
     fake_routers: list[APIRouter] = []
+    # Building the transport does no I/O; it only connects when the registry starts it.
+    mqtt = MqttTransport(settings)
+    zigbee_real = any(kinds[module] == "real" for module in ZIGBEE_MODULES)
 
     lights_fake_driver: lights_fake.FakeLightsDriver | None = None
     if kinds["lights"] == "fake":
@@ -212,4 +230,5 @@ def build_registry(settings: Settings, bus: EventBus) -> Registry:
         sensors=sensors,
         zigbee_status=zigbee_status,
         fake_routers=fake_routers,
+        mqtt=mqtt if zigbee_real else None,
     )
diff --git a/services/hw/tests/test_registry.py b/services/hw/tests/test_registry.py
index 90a607f..1c8e287 100644
--- a/services/hw/tests/test_registry.py
+++ b/services/hw/tests/test_registry.py
@@ -72,6 +72,14 @@ def test_health_reports_each_module_driver() -> None:
     assert health.modules.ir == "fake"
 
 
+def test_mqtt_runs_only_with_a_real_zigbee_driver() -> None:
+    assert build_registry(make_settings(), EventBus(8)).mqtt is None
+    non_zigbee = make_settings(drivers="hdmi=real,projection_screen=real,audio=real")
+    assert build_registry(non_zigbee, EventBus(8)).mqtt is None
+    assert build_registry(make_settings(drivers="ir=real"), EventBus(8)).mqtt is not None
+    assert build_registry(make_settings(mode="real"), EventBus(8)).mqtt is not None
+
+
 async def test_fake_ir_send_drives_the_fake_projector() -> None:
     bus = EventBus(256)
     sub = bus.subscribe()
PATCH
```

**Test:** `test_mqtt_runs_only_with_a_real_zigbee_driver` (above). `test_main.py`'s real-mode tests now start the
transport; it retries against port 1 in the background and is cancelled on shutdown.

**Verify:** `uv run --directory services/hw pytest tests/test_registry.py tests/test_main.py -q` → all pass;
`pnpm verify` green (hw: 147).

**Commit:** `git commit -m "feat(hw): start the MQTT transport with real zigbee drivers"`

### T5 — Real ZS06 driver (`ir/driver_real.py`)
- [x] done

**Files:** `services/hw/app/modules/ir/driver_real.py`, `services/hw/tests/fake_mqtt.py`,
`services/hw/tests/test_ir_real.py`, `services/hw/tests/test_ir.py`, `services/hw/app/registry.py`,
`services/hw/tests/test_registry.py`

**Context:** INTAKE-01 §2C (topics, payloads, learn result, stale code, no device ack, 444–708-char codes), §5B; H01
notes; ARCHITECTURE §3.4 (`ir.blaster`, `ir.learn`), §6.9; SPEC R5/H21/H25 via core-api (unchanged). Decisions D1, D3,
D4. One component: the driver plus its wiring. Fake driver unchanged. No `[ASSUMED]` left: every behaviour here was
observed on hardware.

**Do:**
1. Replace `services/hw/app/modules/ir/driver_real.py`:
```python
"""Real IR driver: the ZS06 blaster (`transport: ir_zs06`) through zigbee2mqtt (INTAKE-01 §2C, §5B).

Topics (`<base>` = HW_Z2M_BASE_TOPIC, `<node>` = HW_IR_NODE):
- `<base>/<node>/availability` `{"state": "online"|"offline"}` (retained) and
  `<base>/bridge/state` `{"state": "online"|"offline"}` (retained) → `ir.blaster.online`, which is
  also false while the broker is down. `linkquality` in `<base>/<node>` → `ir.blaster.lqi`.
- send: `{"ir_code_to_send": code}` → `<base>/<node>/set`. The ZS06 never acknowledges, so the
  ack only means "the broker accepted it" and core-api keeps IR `assumed`.
- learn: `{"learn_ir_code": "ON"}`; the capture is the first `<base>/<node>` message whose
  `learned_ir_timings` is an object with `timestamp` (ms) ≥ the arm time. zigbee2mqtt repeats the
  cached `learned_ir_code` in later messages, so the code alone never counts. Codes are passed on
  exactly as received. Timeout and cancel publish `{"learn_ir_code": "OFF"}`.
- `ir_mcu` (ESP32) is not built yet (INTAKE-01 Part A): send → `invalid`, learn → `invalid`.
"""

import asyncio
import time
from collections.abc import Callable

from app.config import Settings
from app.contracts import ACK_OK, HwAck, HwDriverKind, ack_error, logger
from app.modules.ir.schemas import (
    HwIrBlasterData,
    HwIrBlasterEvent,
    HwIrLearnCancelled,
    HwIrLearnCaptured,
    HwIrLearnEvent,
    HwIrLearnRequest,
    HwIrLearnResult,
    HwIrLearnStateData,
    HwIrLearnTimeout,
    HwIrSendRequest,
    IrLearnStatus,
)
from app.modules.ir.service import IrEmit, IrRefused
from app.transports.mqtt import MqttLink

MCU_PENDING = "ir_mcu (ESP32) is not available yet (INTAKE-01 Part A)"


def wall_clock_ms() -> int:
    """zigbee2mqtt stamps `learned_ir_timings.timestamp` with its own Date.now() on this Pi."""
    return int(time.time() * 1000)


def is_online(payload: object) -> bool:
    """`{"state": "online"}` (zigbee2mqtt 2.x) or the legacy plain text `online`."""
    if isinstance(payload, dict):
        return payload.get("state") == "online"
    return payload == "online"


def fresh_capture(payload: object, armed_ms: int) -> str | None:
    """The learned code when `payload` is a capture made after `armed_ms`, else None."""
    if not isinstance(payload, dict):
        return None
    timings = payload.get("learned_ir_timings")
    code = payload.get("learned_ir_code")
    if not isinstance(timings, dict) or not isinstance(code, str) or code == "":
        return None
    stamp = timings.get("timestamp")
    if isinstance(stamp, bool) or not isinstance(stamp, int | float):
        return None
    return code if stamp >= armed_ms else None


def link_quality(payload: object) -> int | None:
    if not isinstance(payload, dict):
        return None
    lqi = payload.get("linkquality")
    if isinstance(lqi, bool) or not isinstance(lqi, int) or not 0 <= lqi <= 255:
        return None
    return lqi


class RealIrDriver:
    kind: HwDriverKind = "real"

    def __init__(
        self, settings: Settings, mqtt: MqttLink, now_ms: Callable[[], int] = wall_clock_ms
    ) -> None:
        self._settings = settings
        self._mqtt = mqtt
        self._now_ms = now_ms
        base = settings.z2m_base_topic
        node = settings.ir_node
        self._state_topic = f"{base}/{node}"
        self._set_topic = f"{base}/{node}/set"
        self._availability_topic = f"{base}/{node}/availability"
        self._bridge_topic = f"{base}/bridge/state"
        self._available = False
        self._bridge_online = False
        self._lqi: int | None = None
        self._reported: HwIrBlasterData | None = None
        self._learn: asyncio.Future[HwIrLearnResult] | None = None
        self._armed_ms = 0
        self._emit: IrEmit | None = None

    @property
    def online(self) -> bool:
        return self._mqtt.connected and self._bridge_online and self._available

    async def start(self, emit: IrEmit) -> None:
        self._emit = emit
        self._mqtt.subscribe(self._availability_topic, self._on_availability)
        self._mqtt.subscribe(self._bridge_topic, self._on_bridge)
        self._mqtt.subscribe(self._state_topic, self._on_state)
        self._mqtt.on_connection(self._on_connection)
        self._report_blaster()

    async def stop(self) -> None:
        self._resolve_learn(HwIrLearnCancelled(status="cancelled"))
        self._emit = None

    async def send(self, request: HwIrSendRequest) -> HwAck:
        refused = self._refusal(request.transport)
        if refused is not None:
            return ack_error(refused.code, str(refused))
        await self._mqtt.publish(self._set_topic, {"ir_code_to_send": request.code})
        return ACK_OK

    async def learn(self, request: HwIrLearnRequest) -> HwIrLearnResult:
        """One capture at a time: a new learn cancels the one in progress (like the fake)."""
        refused = self._refusal(request.transport)
        if refused is not None:
            raise refused
        self._resolve_learn(HwIrLearnCancelled(status="cancelled"))
        future: asyncio.Future[HwIrLearnResult] = asyncio.get_running_loop().create_future()
        self._learn = future
        self._armed_ms = self._now_ms()
        try:
            await self._mqtt.publish(self._set_topic, {"learn_ir_code": "ON"})
        except Exception:
            self._learn = None
            raise
        self._report_learn("listening")
        result: HwIrLearnResult
        try:
            result = await asyncio.wait_for(future, timeout=request.timeout_s)
        except TimeoutError:
            result = HwIrLearnTimeout(status="timeout")
            await self._learn_off()
        finally:
            if self._learn is future:
                self._learn = None
        self._report_learn(result.status)
        return result

    async def cancel_learn(self) -> HwAck:
        self._resolve_learn(HwIrLearnCancelled(status="cancelled"))
        if not self._mqtt.connected:
            return ack_error("transport", "MQTT broker not connected")
        await self._mqtt.publish(self._set_topic, {"learn_ir_code": "OFF"})
        return ACK_OK

    def _refusal(self, transport: str) -> IrRefused | None:
        if transport != "ir_zs06":
            return IrRefused("invalid", MCU_PENDING)
        if not self._mqtt.connected:
            return IrRefused("transport", "MQTT broker not connected")
        if not self.online:
            return IrRefused("device_offline", f"{self._settings.ir_node} is offline")
        return None

    async def _learn_off(self) -> None:
        """Stops learn mode after a timeout; a failure only logs (H21: nothing is stored)."""
        try:
            await self._mqtt.publish(self._set_topic, {"learn_ir_code": "OFF"})
        except Exception as exc:
            logger.warning("ir: could not switch learn mode off: %s", exc)

    def _resolve_learn(self, result: HwIrLearnResult) -> None:
        future = self._learn
        if future is not None and not future.done():
            future.set_result(result)

    def _on_availability(self, payload: object) -> None:
        self._available = is_online(payload)
        self._report_blaster()

    def _on_bridge(self, payload: object) -> None:
        self._bridge_online = is_online(payload)
        self._report_blaster()

    def _on_state(self, payload: object) -> None:
        lqi = link_quality(payload)
        if lqi is not None:
            self._lqi = lqi
            self._report_blaster()
        future = self._learn
        if future is None or future.done():
            return
        code = fresh_capture(payload, self._armed_ms)
        if code is not None:
            future.set_result(HwIrLearnCaptured(status="captured", code_format="tuya", code=code))

    def _on_connection(self, connected: bool) -> None:
        if not connected:
            # Retained availability and bridge state arrive again on the next subscribe.
            self._available = False
            self._bridge_online = False
        self._report_blaster()

    def _report_blaster(self) -> None:
        """Emits `ir.blaster` when (online, lqi) changed; lqi is null while offline."""
        online = self.online
        data = HwIrBlasterData(online=online, lqi=self._lqi if online else None)
        if data == self._reported or self._emit is None:
            return
        self._reported = data
        self._emit(HwIrBlasterEvent(data=data))

    def _report_learn(self, status: IrLearnStatus) -> None:
        if self._emit is not None:
            self._emit(HwIrLearnEvent(data=HwIrLearnStateData(status=status)))
```
2. Create `services/hw/tests/fake_mqtt.py`:
```python
"""In-memory `MqttLink` for real-driver tests: records publishes, delivers messages by hand."""

from collections.abc import Mapping

from app.transports.mqtt import ConnectionHandler, MessageHandler, MqttNotConnected


class FakeMqtt:
    def __init__(self, connected: bool = True) -> None:
        self._connected = connected
        self.handlers: dict[str, list[MessageHandler]] = {}
        self.connection_handlers: list[ConnectionHandler] = []
        self.published: list[tuple[str, dict[str, object]]] = []
        self.fail_publish: Exception | None = None

    @property
    def connected(self) -> bool:
        return self._connected

    def subscribe(self, topic: str, handler: MessageHandler) -> None:
        self.handlers.setdefault(topic, []).append(handler)

    def on_connection(self, handler: ConnectionHandler) -> None:
        self.connection_handlers.append(handler)

    async def publish(self, topic: str, payload: Mapping[str, object]) -> None:
        if not self._connected:
            raise MqttNotConnected
        if self.fail_publish is not None:
            raise self.fail_publish
        self.published.append((topic, dict(payload)))

    def deliver(self, topic: str, payload: object) -> None:
        """A message from the broker, payload already decoded (as MqttTransport passes it)."""
        for handler in list(self.handlers.get(topic, [])):
            handler(payload)

    def set_connected(self, connected: bool) -> None:
        self._connected = connected
        for handler in list(self.connection_handlers):
            handler(connected)
```
3. Create `services/hw/tests/test_ir_real.py`:
```python
"""RealIrDriver (ZS06 via zigbee2mqtt) against an in-memory MQTT link. Topics and payload shapes are
copied from INTAKE-01 §2C (observed on the R-101 Pi, zigbee2mqtt 2.14.2)."""

import asyncio

from app.contracts import ACK_OK, HwErrorEvent, ack_error
from app.events import EventBus, Subscription
from app.modules.ir.driver_real import RealIrDriver, fresh_capture, is_online
from app.modules.ir.schemas import (
    HwIrBlasterData,
    HwIrBlasterEvent,
    HwIrLearnCancelled,
    HwIrLearnCaptured,
    HwIrLearnEvent,
    HwIrLearnRequest,
    HwIrLearnTimeout,
    HwIrSendRequest,
    HwIrSnapshot,
)
from app.modules.ir.service import IrService
from tests.fake_mqtt import FakeMqtt
from tests.helpers import drain, make_settings, next_event

STATE = "zigbee2mqtt/r101_ir"
SET = "zigbee2mqtt/r101_ir/set"
AVAILABILITY = "zigbee2mqtt/r101_ir/availability"
BRIDGE = "zigbee2mqtt/bridge/state"
ONLINE = {"state": "online"}
OFFLINE = {"state": "offline"}
ARMED_MS = 1_760_536_000_000  # the injected clock: learn is armed at this ms timestamp

# A Tuya code is opaque and 444-708 chars long (§2C); this one has the shape and is never altered.
CODE = "C/8hRgHrBkYBgAMH" + "A" * 480 + "+/=="
CACHED = "BbAPsAjmAewE4AFAA8ADQAMB7ARAH+ADAQ=="
SEND = HwIrSendRequest(transport="ir_zs06", code_format="tuya", code=CODE)
LEARN = HwIrLearnRequest(transport="ir_zs06", timeout_s=1)


def capture(code: str, timestamp: int) -> dict[str, object]:
    """The first state message after a capture (§2C "Learn result")."""
    return {
        "learn_ir_code": "OFF",
        "learned_ir_code": code,
        "learned_ir_timings": {
            "modulation": 38000,
            "timestamp": timestamp,
            "timings": [3500, 1700],
        },
        "linkquality": 170,
    }


def repeat(code: str) -> dict[str, object]:
    """Later state messages repeat the cached code with empty timings (§2C "Stale code")."""
    return {"learned_ir_code": code, "learned_ir_timings": "", "linkquality": 171}


async def start(
    online: bool = True, connected: bool = True
) -> tuple[IrService, RealIrDriver, FakeMqtt, Subscription]:
    bus = EventBus(64)
    sub = bus.subscribe()
    mqtt = FakeMqtt(connected=connected)
    driver = RealIrDriver(make_settings(drivers="ir=real"), mqtt, now_ms=lambda: ARMED_MS)
    service = IrService(driver, bus)
    await service.start()
    if online:
        mqtt.deliver(BRIDGE, ONLINE)
        mqtt.deliver(AVAILABILITY, ONLINE)
    return service, driver, mqtt, sub


async def learn_started(sub: Subscription) -> None:
    assert (await next_event(sub, HwIrLearnEvent)).data.status == "listening"


def test_payload_helpers() -> None:
    assert is_online({"state": "online"}) is True
    assert is_online("online") is True
    assert is_online({"state": "offline"}) is False
    assert is_online(None) is False
    assert fresh_capture(capture(CODE, ARMED_MS + 6000), ARMED_MS) == CODE
    assert fresh_capture(capture(CODE, ARMED_MS - 1), ARMED_MS) is None
    assert fresh_capture(repeat(CODE), ARMED_MS) is None
    assert fresh_capture({"learned_ir_timings": {"timestamp": True}}, ARMED_MS) is None


async def test_start_subscribes_and_reports_offline_until_availability() -> None:
    service, _, mqtt, sub = await start(online=False)
    assert set(mqtt.handlers) == {STATE, AVAILABILITY, BRIDGE}
    assert service.snapshot() == HwIrSnapshot(blaster=HwIrBlasterData(online=False, lqi=None))
    mqtt.deliver(BRIDGE, ONLINE)
    mqtt.deliver(AVAILABILITY, ONLINE)
    event = await next_event(sub, HwIrBlasterEvent)
    while not event.data.online:
        event = await next_event(sub, HwIrBlasterEvent)
    assert event.data == HwIrBlasterData(online=True, lqi=None)


async def test_blaster_follows_availability_and_link_quality() -> None:
    service, _, mqtt, sub = await start()
    drain(sub)
    mqtt.deliver(STATE, {"linkquality": 167})
    assert service.snapshot().blaster == HwIrBlasterData(online=True, lqi=167)
    mqtt.deliver(STATE, {"linkquality": 167})  # unchanged → no new event
    mqtt.deliver(AVAILABILITY, OFFLINE)
    assert service.snapshot().blaster == HwIrBlasterData(online=False, lqi=None)
    mqtt.deliver(AVAILABILITY, ONLINE)
    assert service.snapshot().blaster == HwIrBlasterData(online=True, lqi=167)
    events = [e.data for e in drain(sub) if isinstance(e, HwIrBlasterEvent)]
    assert events == [
        HwIrBlasterData(online=True, lqi=167),
        HwIrBlasterData(online=False, lqi=None),
        HwIrBlasterData(online=True, lqi=167),
    ]


async def test_bridge_offline_makes_the_blaster_offline() -> None:
    service, _, mqtt, _ = await start()
    mqtt.deliver(BRIDGE, OFFLINE)
    assert service.snapshot().blaster == HwIrBlasterData(online=False, lqi=None)


async def test_broker_loss_makes_the_blaster_offline_until_retained_state_returns() -> None:
    service, _, mqtt, _ = await start()
    mqtt.set_connected(False)
    assert service.snapshot().blaster == HwIrBlasterData(online=False, lqi=None)
    mqtt.set_connected(True)  # connected, but availability not heard again yet
    assert service.snapshot().blaster == HwIrBlasterData(online=False, lqi=None)
    mqtt.deliver(BRIDGE, ONLINE)
    mqtt.deliver(AVAILABILITY, ONLINE)
    assert service.snapshot().blaster == HwIrBlasterData(online=True, lqi=None)


async def test_send_publishes_the_code_unaltered() -> None:
    service, _, mqtt, _ = await start()
    assert await service.send(SEND) == ACK_OK
    assert mqtt.published == [(SET, {"ir_code_to_send": CODE})]
    assert len(mqtt.published[0][1]["ir_code_to_send"]) == len(CODE)


async def test_send_while_offline_is_device_offline() -> None:
    service, _, mqtt, _ = await start(online=False)
    assert await service.send(SEND) == ack_error("device_offline", "r101_ir is offline")
    assert mqtt.published == []


async def test_send_while_the_broker_is_down_is_transport() -> None:
    service, _, mqtt, _ = await start(connected=False)
    assert await service.send(SEND) == ack_error("transport", "MQTT broker not connected")
    assert mqtt.published == []


async def test_send_publish_failure_is_transport() -> None:
    service, _, mqtt, _ = await start()
    mqtt.fail_publish = TimeoutError("no PUBACK")
    ack = await service.send(SEND)
    assert ack.ok is False
    assert ack.error.code == "transport"


async def test_ir_mcu_is_invalid() -> None:
    service, _, mqtt, sub = await start()
    mcu = HwIrSendRequest(transport="ir_mcu", code_format="tuya", code=CODE)
    ack = await service.send(mcu)
    assert ack.ok is False
    assert ack.error.code == "invalid"
    learn = HwIrLearnRequest(transport="ir_mcu", timeout_s=1)
    assert await service.learn(learn) == HwIrLearnTimeout(status="timeout")
    error = await next_event(sub, HwErrorEvent)
    assert error.data.code == "invalid"
    assert mqtt.published == []


async def test_learn_captures_a_fresh_code_and_ignores_the_cached_one() -> None:
    service, _, mqtt, sub = await start()
    drain(sub)
    learning = asyncio.create_task(
        service.learn(HwIrLearnRequest(transport="ir_zs06", timeout_s=5))
    )
    await learn_started(sub)
    assert mqtt.published == [(SET, {"learn_ir_code": "ON"})]
    mqtt.deliver(STATE, repeat(CACHED))  # cached code repeated: not a capture
    mqtt.deliver(STATE, capture(CACHED, ARMED_MS - 60_000))  # an older capture: not fresh
    assert not learning.done()
    mqtt.deliver(STATE, capture(CODE, ARMED_MS + 6_000))
    result = await asyncio.wait_for(learning, 1)
    assert result == HwIrLearnCaptured(status="captured", code_format="tuya", code=CODE)
    assert (await next_event(sub, HwIrLearnEvent)).data.status == "captured"
    mqtt.deliver(STATE, repeat(CODE))  # the second message after a capture changes nothing
    assert mqtt.published == [(SET, {"learn_ir_code": "ON"})]


async def test_learn_timeout_switches_learn_mode_off() -> None:
    service, _, mqtt, sub = await start()
    drain(sub)
    learning = asyncio.create_task(service.learn(LEARN))
    await learn_started(sub)
    mqtt.deliver(STATE, repeat(CACHED))
    assert await asyncio.wait_for(learning, 2) == HwIrLearnTimeout(status="timeout")
    assert (await next_event(sub, HwIrLearnEvent)).data.status == "timeout"
    assert mqtt.published == [(SET, {"learn_ir_code": "ON"}), (SET, {"learn_ir_code": "OFF"})]


async def test_cancel_resolves_cancelled_and_switches_learn_mode_off() -> None:
    service, _, mqtt, sub = await start()
    drain(sub)
    learning = asyncio.create_task(
        service.learn(HwIrLearnRequest(transport="ir_zs06", timeout_s=5))
    )
    await learn_started(sub)
    assert await service.cancel_learn() == ACK_OK
    assert await asyncio.wait_for(learning, 1) == HwIrLearnCancelled(status="cancelled")
    assert (await next_event(sub, HwIrLearnEvent)).data.status == "cancelled"
    assert mqtt.published == [(SET, {"learn_ir_code": "ON"}), (SET, {"learn_ir_code": "OFF"})]


async def test_a_new_learn_cancels_the_one_in_progress() -> None:
    service, _, mqtt, sub = await start()
    drain(sub)
    first = asyncio.create_task(service.learn(HwIrLearnRequest(transport="ir_zs06", timeout_s=5)))
    await learn_started(sub)
    second = asyncio.create_task(service.learn(HwIrLearnRequest(transport="ir_zs06", timeout_s=5)))
    assert await asyncio.wait_for(first, 1) == HwIrLearnCancelled(status="cancelled")
    mqtt.deliver(STATE, capture(CODE, ARMED_MS + 1))
    assert await asyncio.wait_for(second, 1) == HwIrLearnCaptured(
        status="captured", code_format="tuya", code=CODE
    )


async def test_learn_while_offline_is_device_offline_and_never_arms() -> None:
    service, _, mqtt, sub = await start(online=False)
    assert await service.learn(LEARN) == HwIrLearnTimeout(status="timeout")
    error = await next_event(sub, HwErrorEvent)
    assert (error.data.code, error.data.message) == ("device_offline", "ir: r101_ir is offline")
    assert mqtt.published == []


async def test_learn_while_the_broker_is_down_is_transport() -> None:
    service, _, _, sub = await start(connected=False)
    assert await service.learn(LEARN) == HwIrLearnTimeout(status="timeout")
    error = await next_event(sub, HwErrorEvent)
    assert (error.data.code, error.data.message) == ("transport", "ir: MQTT broker not connected")


async def test_cancel_while_the_broker_is_down_is_transport() -> None:
    service, _, _, _ = await start(connected=False)
    assert await service.cancel_learn() == ack_error("transport", "MQTT broker not connected")
```
4. Patch the wiring and the old stub test (the stub's "hardware intake pending" test becomes a publish-failure test):
```sh
git apply <<'PATCH'
diff --git a/services/hw/app/registry.py b/services/hw/app/registry.py
index a9bbb06..b0897df 100644
--- a/services/hw/app/registry.py
+++ b/services/hw/app/registry.py
@@ -189,7 +189,7 @@ def build_registry(settings: Settings, bus: EventBus) -> Registry:
         if power_fake_driver is not None:
             # The fake projector "sees" every code the fake blaster sends.
             ir_fake_driver.add_listener(power_fake_driver.ir_received)
-    ir = IrService(ir_fake_driver or RealIrDriver(settings), bus)
+    ir = IrService(ir_fake_driver or RealIrDriver(settings, mqtt), bus)
 
     hdmi = HdmiService(
         FakeHdmiDriver(settings) if kinds["hdmi"] == "fake" else RealHdmiDriver(settings), bus
diff --git a/services/hw/tests/test_ir.py b/services/hw/tests/test_ir.py
index ba052d6..02a93f5 100644
--- a/services/hw/tests/test_ir.py
+++ b/services/hw/tests/test_ir.py
@@ -17,6 +17,7 @@ from app.modules.ir.schemas import (
     HwIrSnapshot,
 )
 from app.modules.ir.service import IrRefused, IrService
+from tests.fake_mqtt import FakeMqtt
 from tests.helpers import http_client, make_settings, next_event
 
 SEND = HwIrSendRequest(transport="ir_zs06", code_format="tuya", code="C/8hRgHrBkYBgAMH")
@@ -113,17 +114,19 @@ async def test_a_refused_learn_reports_its_code_and_times_out() -> None:
     assert (error.data.code, error.data.message) == ("invalid", "ir: ir_mcu is not available yet")
 
 
-async def test_real_driver_errors_become_transport_and_timeout() -> None:
+async def test_real_driver_failures_become_transport_and_timeout() -> None:
     bus = EventBus(8)
     sub = bus.subscribe()
-    service = IrService(RealIrDriver(make_settings()), bus)
+    mqtt = FakeMqtt()
+    service = IrService(RealIrDriver(make_settings(), mqtt), bus)
     await service.start()
-    assert await service.send(SEND) == ack_error("transport", "ir: hardware intake pending")
+    mqtt.deliver("zigbee2mqtt/bridge/state", {"state": "online"})
+    mqtt.deliver("zigbee2mqtt/r101_ir/availability", {"state": "online"})
+    mqtt.fail_publish = TimeoutError("no PUBACK")
+    assert await service.send(SEND) == ack_error("transport", "ir: TimeoutError: no PUBACK")
     assert await service.learn(LEARN) == HwIrLearnTimeout(status="timeout")
     error = await next_event(sub, HwErrorEvent)
-    assert error.data.module == "ir"
-    assert error.data.code == "transport"
-    assert service.snapshot() == HwIrSnapshot(blaster=None)
+    assert (error.data.code, error.data.message) == ("transport", "ir: no PUBACK")
 
 
 async def test_routes() -> None:
diff --git a/services/hw/tests/test_registry.py b/services/hw/tests/test_registry.py
index 1c8e287..11cdd34 100644
--- a/services/hw/tests/test_registry.py
+++ b/services/hw/tests/test_registry.py
@@ -2,7 +2,7 @@ import pytest
 from fastapi.routing import APIRoute
 
 from app.events import EventBus
-from app.modules.ir.schemas import HwIrSendRequest
+from app.modules.ir.schemas import HwIrBlasterData, HwIrSendRequest
 from app.modules.projector_power.schemas import HwProjectorPowerReadingEvent
 from app.registry import MODULES, build_registry, driver_kinds, parse_driver_overrides
 from tests.helpers import drain, make_settings, next_event
@@ -80,6 +80,14 @@ def test_mqtt_runs_only_with_a_real_zigbee_driver() -> None:
     assert build_registry(make_settings(mode="real"), EventBus(8)).mqtt is not None
 
 
+async def test_real_ir_starts_offline_without_a_broker() -> None:
+    registry = build_registry(make_settings(drivers="ir=real"), EventBus(64))
+    await registry.start()
+    assert registry.health().modules.ir == "real"
+    assert registry.snapshot().ir.blaster == HwIrBlasterData(online=False, lqi=None)
+    await registry.stop()
+
+
 async def test_fake_ir_send_drives_the_fake_projector() -> None:
     bus = EventBus(256)
     sub = bus.subscribe()
PATCH
```

**Test:** `tests/test_ir_real.py` (17 tests) covers the milestone list: send publishes `{"ir_code_to_send": code}` to
`zigbee2mqtt/r101_ir/set` unaltered; learn captures only a fresh code and ignores the repeated cached one and an older
capture; timeout publishes `learn_ir_code: OFF`; cancel resolves `cancelled` (+ OFF); offline → `device_offline`;
MQTT down → `transport`; `ir.blaster` follows availability, bridge state, broker connection and `linkquality`;
`ir_mcu` → `invalid`. Plus `test_ir.py::test_real_driver_failures_become_transport_and_timeout` and
`test_registry.py::test_real_ir_starts_offline_without_a_broker`.

**Verify:** `uv run --directory services/hw pytest tests/test_ir_real.py tests/test_ir.py tests/test_registry.py -q`
→ all pass; `pnpm verify` green (hw: 165).

**Commit:** `git commit -m "feat(hw): real ZS06 IR driver through zigbee2mqtt"`

### T6 — Hardware tests for the ZS06 (`pytest -m hardware`)
- [x] done

**Files:** `services/hw/tests/test_ir_hardware.py`

**Context:** H01 scope ("blaster online within 5 s; learn with no press times out cleanly"); ARCHITECTURE §8 (marker
`hardware`, excluded from verify). Uses the real broker on this Pi with default settings (`_env_file=None`).

**Do:**
1. Create `services/hw/tests/test_ir_hardware.py`:
```python
"""[ON PI] RealIrDriver against the real broker, zigbee2mqtt and the paired ZS06 `r101_ir`.

Run on the R-101 Pi only: `uv run --directory services/hw pytest -m hardware`. hw-service may run
at the same time (the transport uses no fixed MQTT client id). No remote may be pressed during
the learn test.
"""

import asyncio
import logging
import time

import pytest

from app.config import Settings
from app.contracts import HwErrorEvent
from app.events import EventBus, Subscription
from app.modules.ir.driver_real import RealIrDriver
from app.modules.ir.schemas import HwIrLearnEvent, HwIrLearnRequest, HwIrLearnTimeout
from app.modules.ir.service import IrService
from app.transports.mqtt import MqttTransport
from tests.helpers import drain

pytestmark = pytest.mark.hardware


async def start_real() -> tuple[IrService, MqttTransport, Subscription]:
    settings = Settings(_env_file=None)  # 127.0.0.1:1883, zigbee2mqtt, r101_ir
    bus = EventBus(64)
    sub = bus.subscribe()
    mqtt = MqttTransport(settings)
    service = IrService(RealIrDriver(settings, mqtt), bus)
    await service.start()
    await mqtt.start()
    return service, mqtt, sub


async def stop_real(service: IrService, mqtt: MqttTransport) -> None:
    await mqtt.stop()
    await service.stop()


async def wait_online(service: IrService, within_s: float) -> None:
    async with asyncio.timeout(within_s):
        while True:
            blaster = service.snapshot().blaster
            if blaster is not None and blaster.online:
                return
            await asyncio.sleep(0.05)


async def test_blaster_is_online_within_5_s() -> None:
    service, mqtt, _ = await start_real()
    try:
        await wait_online(service, 5)
        blaster = service.snapshot().blaster
        assert blaster is not None
        assert blaster.lqi is None or 0 <= blaster.lqi <= 255
    finally:
        await stop_real(service, mqtt)


async def test_learn_with_no_press_times_out_cleanly(caplog: pytest.LogCaptureFixture) -> None:
    service, mqtt, sub = await start_real()
    try:
        await wait_online(service, 5)
        drain(sub)
        caplog.set_level(logging.WARNING, logger="hw")
        started = time.monotonic()
        result = await service.learn(HwIrLearnRequest(transport="ir_zs06", timeout_s=3))
        elapsed = time.monotonic() - started
        assert result == HwIrLearnTimeout(status="timeout")
        assert 3 <= elapsed < 6
        events = drain(sub)
        statuses = [e.data.status for e in events if isinstance(e, HwIrLearnEvent)]
        assert statuses == ["listening", "timeout"]
        assert not [e for e in events if isinstance(e, HwErrorEvent)]
        assert "could not switch learn mode off" not in caplog.text
    finally:
        await stop_real(service, mqtt)
```

**Test:** the file above (2 tests, hardware only). Nobody may press a remote at the blaster during the run.

**Verify:**
1. `pnpm verify` green (hw: `165 passed, 2 deselected`).
2. `[ON PI]` `uv run --directory services/hw pytest -m hardware -v` → `2 passed` in ~4 s. If
   `test_blaster_is_online_within_5_s` fails: `mosquitto_sub -h 127.0.0.1 -t zigbee2mqtt/r101_ir/availability -C 1 -W 5 -v`
   must print `{"state":"online"}`; otherwise zigbee2mqtt or the blaster is down — write a Blocker with that output.

**Commit:** `git commit -m "test(hw): ZS06 hardware tests (online, learn timeout)"`

### T7 — Install step 50: mosquitto on 127.0.0.1:1883
- [x] done

**Files:** `deploy/pi/steps/50-zigbee.sh`, `deploy/pi/zigbee/eduscope-local.conf`

**Context:** INTAKE-01 §5C, Observed (mosquitto 2.0.21 from Debian, `listener 1883 127.0.0.1`, anonymous). Helpers
from `deploy/pi/lib.sh` (`install_if_changed`, `changed`, `log`, `EDUSCOPE_CHANGED`). Debian's
`/etc/mosquitto/mosquitto.conf` includes `conf.d/`. `mosquitto-clients` gives `mosquitto_sub` for the checks.

**Do:**
1. Create `deploy/pi/zigbee/eduscope-local.conf`:
```ini
# Eduscope (H01, INTAKE-01 §5C): the broker for zigbee2mqtt and hw-service, reachable from this Pi
# only. Installed by deploy/pi/install.sh to /etc/mosquitto/conf.d/eduscope-local.conf.
listener 1883 127.0.0.1
allow_anonymous true
```
2. Create `deploy/pi/steps/50-zigbee.sh` (not executable; it is sourced, like the other steps):
```sh
# shellcheck shell=bash
# install.sh step 50: mosquitto, the coordinator udev link and zigbee2mqtt (H01, INTAKE-01 §5C).
# Safe on top of the hand install on R-101: /opt/zigbee2mqtt/data/ (network key, paired devices) is
# never written, except configuration.yaml when it does not exist yet.

# mosquitto: broker on 127.0.0.1:1883 only.
zigbee_missing=()
for pkg in mosquitto mosquitto-clients; do
  if ! dpkg-query -W -f='${db:Status-Abbrev}' "$pkg" 2>/dev/null | grep -q '^ii'; then zigbee_missing+=("$pkg"); fi
done
if ((${#zigbee_missing[@]} > 0)); then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${zigbee_missing[@]}"
  changed "installed ${zigbee_missing[*]}"
fi
install_if_changed "$HERE/zigbee/eduscope-local.conf" /etc/mosquitto/conf.d/eduscope-local.conf 644 root root
mosquitto_restart=$EDUSCOPE_CHANGED
if ! systemctl is-enabled -q mosquitto; then
  systemctl enable mosquitto
  changed "enabled mosquitto"
fi
if ((mosquitto_restart)) || ! systemctl is-active -q mosquitto; then
  systemctl restart mosquitto
  log "restarted mosquitto"
fi
```

**Verify:**
1. `pnpm pi:lint` and `pnpm pi:test` pass (both are in `pnpm verify`).
2. `[ON PI · HUMAN]` `! sudo deploy/pi/install.sh` → among the output `==> wrote /etc/mosquitto/conf.d/eduscope-local.conf`
   (the hand-written file differs only in its comment) and `==> restarted mosquitto`; the build stamp changes too
   (T2's `uv.lock`), then `restarted eduscope.target`, `core-api is up`.
3. `[ON PI]` `ss -ltn | grep ':1883 '` → exactly one line, `127.0.0.1:1883`.
4. `[ON PI]` `uv run --directory services/hw pytest -m hardware -q` → `2 passed` (zigbee2mqtt reconnected to the
   restarted broker by itself).

**Commit:** `git commit -m "feat(deploy): install mosquitto on 127.0.0.1:1883"`

### T8 — Install step 50: udev link `/dev/zigbee-coord`
- [ ] done

**Files:** `deploy/pi/zigbee/99-eduscope-zigbee.rules`, `deploy/pi/steps/50-zigbee.sh`

**Context:** INTAKE-01 §2C (CH340 `1a86:7523`, no USB serial number), §5C; Decision D6.

**Do:**
1. Create `deploy/pi/zigbee/99-eduscope-zigbee.rules`:
```text
# Eduscope (H01, INTAKE-01 §5C): /dev/zigbee-coord → the ZG-808Z coordinator (CH340 1a86:7523).
# The CH340 has no USB serial number, so this matches vendor:product only. [ASSUMED] the
# coordinator is the only CH340 adapter on this Pi; a second one would take the same link.
SUBSYSTEM=="tty", ATTRS{idVendor}=="1a86", ATTRS{idProduct}=="7523", SYMLINK+="zigbee-coord"
```
2. Patch `deploy/pi/steps/50-zigbee.sh` (appends the udev block):
```sh
git apply <<'PATCH'
diff --git a/deploy/pi/steps/50-zigbee.sh b/deploy/pi/steps/50-zigbee.sh
index 717709a..4b92b1b 100644
--- a/deploy/pi/steps/50-zigbee.sh
+++ b/deploy/pi/steps/50-zigbee.sh
@@ -23,3 +23,10 @@ if ((mosquitto_restart)) || ! systemctl is-active -q mosquitto; then
   systemctl restart mosquitto
   log "restarted mosquitto"
 fi
+
+# /dev/zigbee-coord for the coordinator (new installs use it; R-101's live config keeps its by-id path).
+install_if_changed "$HERE/zigbee/99-eduscope-zigbee.rules" /etc/udev/rules.d/99-eduscope-zigbee.rules 644 root root
+if ((EDUSCOPE_CHANGED)); then
+  udevadm control --reload
+  udevadm trigger --subsystem-match=tty --action=add
+fi
PATCH
```

**Verify:**
1. `pnpm pi:lint` and `pnpm pi:test` pass.
2. `[ON PI · HUMAN]` `! sudo deploy/pi/install.sh` → `==> wrote /etc/udev/rules.d/99-eduscope-zigbee.rules`.
3. `[ON PI]` `readlink -f /dev/zigbee-coord` and `readlink -f /dev/serial/by-id/usb-1a86_USB_Serial-if00-port0` print the
   same `/dev/ttyUSB…`. zigbee2mqtt keeps running (`systemctl is-active zigbee2mqtt` → `active`).

**Commit:** `git commit -m "feat(deploy): udev link /dev/zigbee-coord for the coordinator"`

### T9 — Install step 50: zigbee2mqtt 2.14.2 in /opt/zigbee2mqtt + configuration template
- [ ] done

**Files:** `deploy/pi/zigbee/configuration.yaml`, `deploy/pi/steps/50-zigbee.sh`

**Context:** INTAKE-01 §2C (zigbee2mqtt 2.14.2, adapter `zstack`, channel 25, frontend 127.0.0.1:8080, availability
on, data in `/opt/zigbee2mqtt/data/`), §5C, Observed (the hand install; the broken-database incident); H01 notes (never
overwrite `data/`; live config not committed); Decision D8. zigbee2mqtt's own install: clone the tag, `pnpm install
--frozen-lockfile`, `pnpm run build`. The live config uses `version: 5` (zigbee2mqtt 2.x config format).

**Do:**
1. Create `deploy/pi/zigbee/configuration.yaml`:
```yaml
# zigbee2mqtt for one Eduscope room (H01, INTAKE-01 §2C/§5C). deploy/pi/install.sh copies this file to
# /opt/zigbee2mqtt/data/configuration.yaml ONLY when that file does not exist yet; zigbee2mqtt then
# replaces each GENERATE with new network keys. The live file holds the network key: never commit
# it, back up /opt/zigbee2mqtt/data/ instead (deploy/pi/README.md §10).
version: 5
homeassistant:
  enabled: false
frontend:
  enabled: true
  host: 127.0.0.1
  port: 8080
mqtt:
  base_topic: zigbee2mqtt
  server: mqtt://127.0.0.1:1883
serial:
  port: /dev/zigbee-coord
  adapter: zstack
  baudrate: 115200
availability:
  enabled: true
advanced:
  channel: 25
  log_level: info
  network_key: GENERATE
  pan_id: GENERATE
  ext_pan_id: GENERATE
```
2. Patch `deploy/pi/steps/50-zigbee.sh` (appends the zigbee2mqtt block):
```sh
git apply <<'PATCH'
diff --git a/deploy/pi/steps/50-zigbee.sh b/deploy/pi/steps/50-zigbee.sh
index 4b92b1b..1acb371 100644
--- a/deploy/pi/steps/50-zigbee.sh
+++ b/deploy/pi/steps/50-zigbee.sh
@@ -30,3 +30,29 @@ if ((EDUSCOPE_CHANGED)); then
   udevadm control --reload
   udevadm trigger --subsystem-match=tty --action=add
 fi
+
+# zigbee2mqtt: the pinned release, cloned and built as the service user. An install of another
+# version is never touched: the run stops (upgrading is a manual step, README §10).
+Z2M_DIR=/opt/zigbee2mqtt
+Z2M_VERSION=2.14.2
+if [[ ! -e $Z2M_DIR ]]; then
+  git clone --depth 1 --branch "$Z2M_VERSION" https://github.com/Koenkk/zigbee2mqtt.git "$Z2M_DIR"
+  chown -R "$SERVICE_USER:$SERVICE_USER" "$Z2M_DIR"
+  changed "cloned zigbee2mqtt $Z2M_VERSION into $Z2M_DIR"
+fi
+z2m_version=$(sed -n 's/^ *"version": *"\([^"]*\)".*/\1/p' "$Z2M_DIR/package.json" | head -n 1)
+[[ $z2m_version == "$Z2M_VERSION" ]] ||
+  die "$Z2M_DIR has zigbee2mqtt '$z2m_version', this installer pins $Z2M_VERSION; upgrade it by hand (deploy/pi/README.md §10)"
+if [[ ! -f $Z2M_DIR/dist/index.js ]]; then
+  z2m_home=$(getent passwd "$SERVICE_USER" | cut -d: -f6)
+  log "building zigbee2mqtt $Z2M_VERSION as $SERVICE_USER"
+  (cd "$Z2M_DIR" && runuser -u "$SERVICE_USER" -- env -i HOME="$z2m_home" PATH=/usr/bin:/bin LANG=C.UTF-8 CI=true \
+    pnpm install --frozen-lockfile)
+  (cd "$Z2M_DIR" && runuser -u "$SERVICE_USER" -- env -i HOME="$z2m_home" PATH=/usr/bin:/bin LANG=C.UTF-8 CI=true \
+    pnpm run build)
+  changed "built zigbee2mqtt $Z2M_VERSION"
+fi
+# Only when missing: the live file holds the network key and the paired devices' names.
+if [[ ! -e $Z2M_DIR/data/configuration.yaml ]]; then
+  install_if_changed "$HERE/zigbee/configuration.yaml" "$Z2M_DIR/data/configuration.yaml" 600 "$SERVICE_USER" "$SERVICE_USER"
+fi
PATCH
```

**Verify:**
1. `pnpm pi:lint` and `pnpm pi:test` pass.
2. `[ON PI]` before: `sha256sum /opt/zigbee2mqtt/data/configuration.yaml > /tmp/h01-z2m.sum` (the file belongs to
   `eduscope`, so no sudo is needed).
3. `[ON PI · HUMAN]` `! sudo deploy/pi/install.sh` → nothing about zigbee2mqtt is logged on R-101 (it exists, reports
   2.14.2, `dist/index.js` exists, `configuration.yaml` exists); the run ends with `No changes.`
4. `[ON PI]` `sha256sum -c /tmp/h01-z2m.sum` → `OK` (the live file was not touched). `grep -c GENERATE
   deploy/pi/zigbee/configuration.yaml` → `3` (the committed template holds no key).

**Commit:** `git commit -m "feat(deploy): pinned zigbee2mqtt install and config template"`

### T10 — Install step 50: `zigbee2mqtt.service` on the system Node
- [ ] done

**Files:** `deploy/pi/systemd/zigbee2mqtt.service`, `deploy/pi/steps/50-zigbee.sh`

**Context:** INTAKE-01 §5C, Observed (hand unit: `Restart=always`, `RestartSec=10`, after/wants mosquitto, nvm Node;
two copies broke the coordinator); D-22 (system Node 24 at `/usr/bin/node`; H01 moves zigbee2mqtt off nvm); H01 scope
("one instance, `Restart=always`, after mosquitto, system Node"). `ProtectSystem=full` as in the hand unit
(zigbee2mqtt writes `data/` and may rebuild `dist/` on start).

**Do:**
1. Create `deploy/pi/systemd/zigbee2mqtt.service`:
```ini
# zigbee2mqtt for the room's Zigbee network (H01, INTAKE-01 §5C). Installed by deploy/pi/install.sh.
# The only way zigbee2mqtt runs on this Pi: a second copy fights over the coordinator port
# ("Cannot lock port") and can corrupt data/database.db (INTAKE-01, Observed). Frontend 127.0.0.1:8080.
[Unit]
Description=zigbee2mqtt (Zigbee coordinator bridge, frontend 127.0.0.1:8080)
Documentation=https://www.zigbee2mqtt.io
After=network.target mosquitto.service
Wants=mosquitto.service

[Service]
Type=simple
User=eduscope
Group=eduscope
SupplementaryGroups=dialout
WorkingDirectory=/opt/zigbee2mqtt
Environment=NODE_ENV=production
# System Node 24 from NodeSource (D-22), not nvm.
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=full

[Install]
WantedBy=multi-user.target
```
2. Patch `deploy/pi/steps/50-zigbee.sh` (appends the unit block):
```sh
git apply <<'PATCH'
diff --git a/deploy/pi/steps/50-zigbee.sh b/deploy/pi/steps/50-zigbee.sh
index 1acb371..f6b9f9e 100644
--- a/deploy/pi/steps/50-zigbee.sh
+++ b/deploy/pi/steps/50-zigbee.sh
@@ -56,3 +56,16 @@ fi
 if [[ ! -e $Z2M_DIR/data/configuration.yaml ]]; then
   install_if_changed "$HERE/zigbee/configuration.yaml" "$Z2M_DIR/data/configuration.yaml" 600 "$SERVICE_USER" "$SERVICE_USER"
 fi
+
+# The only zigbee2mqtt on this Pi (a second copy breaks the coordinator, INTAKE-01 Observed).
+install_if_changed "$HERE/systemd/zigbee2mqtt.service" /etc/systemd/system/zigbee2mqtt.service 644 root root
+z2m_restart=$EDUSCOPE_CHANGED
+if ((z2m_restart)); then systemctl daemon-reload; fi
+if ! systemctl is-enabled -q zigbee2mqtt; then
+  systemctl enable zigbee2mqtt
+  changed "enabled zigbee2mqtt"
+fi
+if ((z2m_restart)) || ! systemctl is-active -q zigbee2mqtt; then
+  systemctl restart zigbee2mqtt
+  log "restarted zigbee2mqtt"
+fi
PATCH
```

**Verify:**
1. `pnpm pi:lint` and `pnpm pi:test` pass; `systemd-analyze verify deploy/pi/systemd/zigbee2mqtt.service` prints nothing
   about `zigbee2mqtt.service`.
2. `[ON PI · HUMAN]` `! sudo deploy/pi/install.sh` → `==> wrote /etc/systemd/system/zigbee2mqtt.service`,
   `==> restarted zigbee2mqtt`.
3. `[ON PI]` `systemctl show -p ExecStart --value zigbee2mqtt | grep -o 'path=[^ ;]*'` → `path=/usr/bin/node`;
   `ps -C node -o args= | grep -c 'index.js'` → `1`; after ~20 s
   `mosquitto_sub -h 127.0.0.1 -t zigbee2mqtt/bridge/state -C 1 -W 5` → `{"state":"online"}`.
4. `[ON PI · HUMAN]` `! sudo deploy/pi/install.sh` again → ends with `No changes.`
5. `[ON PI]` `uv run --directory services/hw pytest -m hardware -q` → `2 passed`.

**Commit:** `git commit -m "feat(deploy): zigbee2mqtt unit on the system Node"`

### T11 — `HW_DRIVERS=ir=real` on the Pi
- [ ] done

**Files:** `deploy/pi/env/hw.env.example`, `services/hw/tests/test_deploy_env.py`

**Context:** H01 scope ("`/etc/eduscope/hw.env` sets `HW_DRIVERS=ir=real` on the Pi"); D-19; M10 D4 (env files are
created once, never rewritten); Decision D7.

**Do:**
1. Patch both files:
```sh
git apply <<'PATCH'
diff --git a/deploy/pi/env/hw.env.example b/deploy/pi/env/hw.env.example
index d7beb87..fcb4b41 100644
--- a/deploy/pi/env/hw.env.example
+++ b/deploy/pi/env/hw.env.example
@@ -1,5 +1,5 @@
 # /etc/eduscope/hw.env (mode 600) — created once by deploy/pi/install.sh from
 # deploy/pi/env/hw.env.example; install.sh never changes it afterwards. Keys: services/hw/app/config.py.
 HW_MODE=fake
-# Per-module override (D-19), e.g. HW_DRIVERS=ir=real. Each Hxx milestone switches its own module.
-HW_DRIVERS=
+# Per-module override (D-19). Each Hxx milestone switches its own module; H01: the ZS06 IR blaster.
+HW_DRIVERS=ir=real
diff --git a/services/hw/tests/test_deploy_env.py b/services/hw/tests/test_deploy_env.py
index 402e402..16c4d5a 100644
--- a/services/hw/tests/test_deploy_env.py
+++ b/services/hw/tests/test_deploy_env.py
@@ -10,18 +10,18 @@ from app.registry import driver_kinds
 EXAMPLE = Path(__file__).resolve().parents[3] / "deploy" / "pi" / "env" / "hw.env.example"
 
 
-def test_hw_env_example_is_all_fake_on_loopback() -> None:
+def test_hw_env_example_is_real_ir_only_on_loopback() -> None:
     settings = Settings(_env_file=EXAMPLE)
     assert settings.mode == "fake"
-    assert settings.drivers == ""
     assert settings.host == "127.0.0.1"
-    assert set(driver_kinds(settings).values()) == {"fake"}
+    real = [module for module, kind in driver_kinds(settings).items() if kind == "real"]
+    assert real == ["ir"]  # H01; every later Hxx adds its own module
 
 
 def test_hw_env_example_has_no_placeholders() -> None:
     assert "@" not in EXAMPLE.read_text(encoding="utf-8")
 
 
-@pytest.mark.parametrize("line", ["HW_MODE=fake", "HW_DRIVERS="])
+@pytest.mark.parametrize("line", ["HW_MODE=fake", "HW_DRIVERS=ir=real"])
 def test_hw_env_example_sets(line: str) -> None:
     assert line in EXAMPLE.read_text(encoding="utf-8").splitlines()
PATCH
```

**Test:** `test_hw_env_example_is_real_ir_only_on_loopback` and the parametrized line test (above).

**Verify:**
1. `uv run --directory services/hw pytest tests/test_deploy_env.py -q` → all pass; `pnpm verify` green.
2. `[ON PI · HUMAN]` `! sudo sed -i 's/^HW_DRIVERS=.*/HW_DRIVERS=ir=real/' /etc/eduscope/hw.env && sudo grep -n '^HW_' /etc/eduscope/hw.env && sudo systemctl restart eduscope.target`
   → prints `HW_MODE=fake` and `HW_DRIVERS=ir=real`.
3. `[ON PI]` `curl -s 127.0.0.1:8081/v1/health` → `"ir":"real"` (every other module `fake`);
   `curl -s 127.0.0.1:8081/v1/snapshot | grep -o '"blaster":{[^}]*}'` → `"blaster":{"online":true,"lqi":…}` (lqi may be
   `null`); `journalctl -u eduscope-hw -n 30 --no-pager | grep mqtt` → `mqtt: connected to 127.0.0.1:1883`.

**Commit:** `git commit -m "feat(deploy): real IR driver on the Pi (HW_DRIVERS=ir=real)"`

### T12 — `deploy/pi/README.md`: Zigbee section
- [ ] done

**Files:** `deploy/pi/README.md`

**Context:** H01 scope ("backup note for `/opt/zigbee2mqtt/data/`"); INTAKE-01 Observed (one instance only; hub drop,
Q-B3); Decisions D6–D8.

**Do:**
1. Patch `deploy/pi/README.md`:
````sh
git apply <<'PATCH'
diff --git a/deploy/pi/README.md b/deploy/pi/README.md
index 29ac734..5bbeab3 100644
--- a/deploy/pi/README.md
+++ b/deploy/pi/README.md
@@ -24,6 +24,8 @@ The installer:
   missing**, with a random cookie secret and the fixed demo PINs room `1234` / technician `123456`);
 - builds the code as the owner of the checkout (`pnpm install --frozen-lockfile`, `pnpm build`,
   `uv sync --frozen`);
+- installs mosquitto (broker on `127.0.0.1:1883` only), the `/dev/zigbee-coord` udev link and
+  zigbee2mqtt 2.14.2 in `/opt/zigbee2mqtt` with `zigbee2mqtt.service` (section 10);
 - installs and enables `eduscope.target`, `eduscope-hw.service`, `eduscope-core.service` and
   `eduscope-restart.path`, makes the journal persistent (max 200 MB) and sets the hostname to `r-101`;
 - with `--kiosk`: desktop autologin, OS screen blanking off, the Chromium launcher in the labwc
@@ -77,9 +79,16 @@ Restart everything: Settings → About → **Restart controller**, or
 
 ## 5 Hardware drivers
 
-`/etc/eduscope/hw.env` starts with `HW_MODE=fake`: every device is simulated. Each hardware
-milestone switches its own module, e.g. `HW_DRIVERS=ir=real`, then
-`sudo systemctl restart eduscope.target`. The installer never overwrites this file.
+`/etc/eduscope/hw.env` has `HW_MODE=fake` (every device simulated) plus a per-module override
+`HW_DRIVERS=`. Each hardware milestone switches its own module. Since H01 the IR blaster is real:
+`HW_DRIVERS=ir=real`. The installer creates this file once and never changes it, so on a Pi that
+was installed earlier set the line by hand, then restart:
+
+```sh
+sudoedit /etc/eduscope/hw.env                       # HW_DRIVERS=ir=real
+sudo systemctl restart eduscope.target
+curl -s 127.0.0.1:8081/v1/health                    # "ir":"real"
+```
 
 ## 6 Backup
 
@@ -120,3 +129,30 @@ sudo systemctl start eduscope.target
 | `eduscope-hw.service` | `services/hw/.venv/bin/uvicorn` as `eduscope` | `127.0.0.1:8081` only |
 | `eduscope-restart.path` | watches `/var/lib/eduscope/restart.request` | — |
 | `eduscope.target` | starts both services at boot | — |
+| `mosquitto.service` | MQTT broker (Debian package) | `127.0.0.1:1883` only |
+| `zigbee2mqtt.service` | `/usr/bin/node index.js` in `/opt/zigbee2mqtt` as `eduscope` | `127.0.0.1:8080` (frontend) |
+
+## 10 Zigbee (mosquitto + zigbee2mqtt)
+
+- **Only one zigbee2mqtt may run.** Never start it by hand (`pnpm start`, `node index.js`) while the
+  unit runs: two copies fight over the coordinator and can break `data/database.db`. Use
+  `sudo systemctl restart zigbee2mqtt` and `journalctl -u zigbee2mqtt -f`.
+- **Back up `/opt/zigbee2mqtt/data/`.** It holds the network key, the coordinator backup and the
+  paired devices. Losing it means re-pairing every device. It is never in git:
+  ```sh
+  sudo systemctl stop zigbee2mqtt
+  sudo tar -czf ~/zigbee2mqtt-data-$(date +%F).tar.gz -C /opt/zigbee2mqtt data
+  sudo systemctl start zigbee2mqtt
+  ```
+  Keep the archive private (network key).
+- The installer writes `data/configuration.yaml` only when it is missing (template:
+  `deploy/pi/zigbee/configuration.yaml`, keys `GENERATE`). It never changes the live file.
+- **Frontend** (pairing, logs): `ssh -L 8080:127.0.0.1:8080 eduscope@<pi>` then open
+  `http://localhost:8080` on the laptop.
+- **Coordinator:** ZG-808Z on a CH340 adapter, `/dev/zigbee-coord` (udev) or
+  `/dev/serial/by-id/usb-1a86_USB_Serial-if00-port0`. Plug it straight into the Pi (USB extension
+  cable), not into the hub with the keyboard: that hub dropped it once (INTAKE-01, Q-B3).
+- **Upgrade:** the installer pins zigbee2mqtt 2.14.2 and stops if `/opt/zigbee2mqtt` has another
+  version. To upgrade: back up `data/` (above), stop the unit, check out the new tag in
+  `/opt/zigbee2mqtt`, run `pnpm install --frozen-lockfile && pnpm run build` as `eduscope`, change
+  `Z2M_VERSION` in `deploy/pi/steps/50-zigbee.sh`, run the installer.
PATCH
````

**Verify:** `grep -n '^## ' deploy/pi/README.md` → sections 1–10, the last `## 10 Zigbee (mosquitto + zigbee2mqtt)`;
`pnpm verify` green.

**Commit:** `git commit -m "docs: deploy/pi README Zigbee section"`

### T13 — Acceptance walk-through (H01 criteria)
- [ ] done

**Files:** this plan file only (tick the box; write any failure under `## Blockers` and stop).

**Context:** every H01 acceptance criterion with its check. **HUMAN** = a person in R-101 (S1/S3 on the kiosk or a
phone, the AC remote, the ZS06 power plug) or root. Technician PIN `123456`, room PIN `1234` unless they were changed.
Write each observed result next to its item in your report. Deviation by decision: none in the criteria; D5 (coordinator
values) is outside them.

Timing notes: zigbee2mqtt marks a mains device offline only after its availability **active timeout** (default 10 min,
not changed in H01; the live config has `availability: enabled: true` only), so AC3's "Offline" can take up to ~10 min.
AC7's 30 s budget relies on zigbee2mqtt reconnecting to mosquitto by itself (systemd restarts it after 10 s if it exits).

**Do:**
1. **AC1 — boot.** `[ON PI · HUMAN]` `! sudo reboot`. After boot: `systemctl is-active mosquitto zigbee2mqtt eduscope-hw eduscope-core`
   → `active` ×4. `ss -ltn | grep -E ':(1883|8080) '` → only `127.0.0.1:1883` and `127.0.0.1:8080`.
   `ps -C node -o args= | grep -c 'index.js'` → `1`.
2. **AC2 — health and snapshot.** `curl -s 127.0.0.1:8081/v1/health` → `"ir":"real"`.
   `timeout 3 curl -sN 127.0.0.1:8081/v1/events | grep -m1 '^data:' | grep -o '"blaster":{[^}]*}'` →
   `"blaster":{"online":true,"lqi":<0–255 or null>}` (the first SSE event is the snapshot). **HUMAN:** Settings →
   technician PIN → Remote configuration (S3): the blaster card (S3.E10) shows **Online**.
3. **AC3 — blaster power.** Note `systemctl show -p NRestarts eduscope-hw eduscope-core zigbee2mqtt`. **HUMAN:** unplug
   the ZS06's power. Watch `mosquitto_sub -h 127.0.0.1 -t zigbee2mqtt/r101_ir/availability -v` (Ctrl-C after) until
   `{"state":"offline"}` (≤ ~10 min) → S3.E10 shows **Offline**, Test and Re-learn are disabled (H25). **HUMAN:** plug it
   back → `{"state":"online"}` → S3.E10 **Online**, buttons enabled. `NRestarts` values unchanged.
4. **AC4 — re-learn + test the AC "22°" command.** **HUMAN:** in S3, AC → "22°" → Re-learn; set the AC remote to 23°,
   point it at the ZS06 and press temperature-down **once** within 20 s → S3 shows **captured · untested**. Tap Test →
   the AC beeps and shows 22 °C → answer **reacted** → **tested ✓**. (INTAKE-01 lesson 2: one step away, one press.)
5. **AC5 — timeout and cancel.** **HUMAN:** note the "22°" row's state, Re-learn, press nothing → after 20 s **timeout**;
   the row's code and state are as before. Then press any AC remote button at the ZS06 → S3 does not change (learn mode
   is off). `journalctl -u eduscope-hw --since -2min --no-pager | grep -c 'could not switch learn mode off'` → `0`.
   **HUMAN:** Re-learn again and tap Cancel while listening → **cancelled**, row unchanged.
6. **AC6 — S1 controls.** **HUMAN:** in S1 (room PIN): AC Power on, setpoint −, setpoint +, Power off — the physical AC
   follows each tap within ~2 s and the AC card shows the values as **assumed (IR)**. Projector Power on, later Power
   off → the Epson projector turns on/off; the projector's power reading stays **Unknown** (S60ZBTPG not paired).
   (The AC/projector codes used are the ones stored in S3; re-learn any that don't react, as in item 4.)
7. **AC7 — broker and bridge restarts.** Note `systemctl show -p NRestarts eduscope-hw`. In a second SSH session run
   `while sleep 1; do date +%T; curl -s 127.0.0.1:8081/v1/snapshot | grep -o '"blaster":{[^}]*}'; done`.
   `[ON PI · HUMAN]` `! sudo systemctl restart zigbee2mqtt` → `"online":false` appears, then `"online":true` within 30 s.
   Then `! sudo systemctl restart mosquitto` → same, within 30 s. `NRestarts` of eduscope-hw unchanged;
   `journalctl -u eduscope-hw --since -5min --no-pager | grep mqtt` shows `reconnecting` then `connected`.
8. **AC8 — tests.** `uv run --directory services/hw pytest -m hardware` → `2 passed`; `pnpm verify` green;
   `git status --short` clean apart from this plan file.

**Verify:** all eight items pass as written. Any failure → `## Blockers` (item, observed output) and stop.

**Commit:** `git commit -m "docs: H01 acceptance walk-through"`

## Checkpoints

- After T7: "Human: nothing to look at — confirm `pnpm verify` is green and the install run ended without errors."
- After T10: "Human: `ssh -L 8080:127.0.0.1:8080 eduscope@<pi-ip>` from a laptop, open `http://localhost:8080` —
  zigbee2mqtt's frontend lists `r101_ir` (TS1201) as online."
- After T11: "Human: open S3 (Remote configuration) on the kiosk at 1280×800 and on a phone at 390px — the blaster card
  shows **Online**; tap Test on any captured command and confirm the device reacts."

## Nice-to-haves (not tasks)

- Ask the ZS06 for its state after start (`zigbee2mqtt/r101_ir/get`) so `lqi` isn't `null` until the first message.
- A shorter `availability.active.timeout` for the blaster (needs a config change on the live file; AC3 then reacts in
  minutes instead of ~10).
- `zigbee_status` real driver from `bridge/info` + `bridge/devices` (the later Hxx; then D5's coordinator values become
  live and the SPEC copy question is settled there).
- Send `learn_ir_code: OFF` when core-api aborts a learn HTTP call (today the device stops by itself after one capture).
- A `[ON PI]` script for the AC1/AC7 checks.

## Blockers

(executor writes here; leave empty)
