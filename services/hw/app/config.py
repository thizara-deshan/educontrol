"""hw-service settings (ARCHITECTURE §7.1). Env prefix `HW_`, optional `.env` in services/hw.

Every friendly name, node and coordinator detail lives here, never in a driver.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

DriverKind = Literal["fake", "real"]


class ZigbeeNodeConfig(BaseModel):
    """One paired Zigbee device. The fake reports these; real drivers will read the bridge."""

    model_config = ConfigDict(extra="forbid")

    ieee: str
    friendly_name: str
    model: str
    role: Literal["router", "end_device"]
    power_source: Literal["mains", "battery"]
    lqi: int | None = Field(ge=0, le=255)
    battery_pct: int | None = Field(ge=0, le=100)


class CoordinatorConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: str
    chipset: str
    firmware: str
    channel: int = Field(ge=11, le=26)
    tx_power_dbm: float
    port: str
    antenna: str


# R-101 as in screenshot 02 and fixtures/hw/response.snapshot.json. [ASSUMED] until intake, except
# the ieee and model of r101_temp (H03), r101_motion and r101_door (H04), paired on the R-101 Pi
# 2026-10-16; their lqi/battery stay fake.
DEFAULT_NODES = [
    ZigbeeNodeConfig(
        ieee="0xa4c1380f2b9e0001",
        friendly_name="r101_lights",
        model="ZBM5-2C-86W",
        role="router",
        power_source="mains",
        lqi=214,
        battery_pct=None,
    ),
    ZigbeeNodeConfig(
        ieee="0xa4c1380f2b9e0002",
        friendly_name="r101_proj_plug",
        model="S60ZBTPG",
        role="router",
        power_source="mains",
        lqi=231,
        battery_pct=None,
    ),
    ZigbeeNodeConfig(
        ieee="0xb0e8e8fffe985dcd",
        friendly_name="r101_temp",
        model="SNZB-02P",
        role="end_device",
        power_source="battery",
        lqi=168,
        battery_pct=98,
    ),
    ZigbeeNodeConfig(
        ieee="0x18690afffe1ca686",
        friendly_name="r101_motion",
        model="SNZB-03P",
        role="end_device",
        power_source="battery",
        lqi=142,
        battery_pct=91,
    ),
    ZigbeeNodeConfig(
        ieee="0xa4c138128a8fffff",
        friendly_name="r101_door",
        model="SNZB-04PR2",
        role="end_device",
        power_source="battery",
        lqi=155,
        battery_pct=87,
    ),
]

DEFAULT_COORDINATOR = CoordinatorConfig(
    model="ZG-808Z",
    chipset="CC2652P1",
    firmware="Z-Stack 3.x.0",
    channel=25,
    tx_power_dbm=20,
    port="zigbee-coord",
    antenna="SMA, external",
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="HW_", env_file=".env", extra="ignore")

    mode: DriverKind = "fake"
    # Per-module override, e.g. "lights=real,ir=fake" (D-19). Parsed by app/registry.py.
    drivers: str = ""
    # Checked by app/main.py: must be a loopback address (hw-service never listens on the LAN).
    host: str = "127.0.0.1"
    heartbeat_s: float = Field(default=5.0, gt=0)
    # Events buffered per SSE subscriber; a subscriber that falls this far behind is dropped.
    subscriber_queue: int = Field(default=256, ge=1)

    # zigbee2mqtt broker (INTAKE-01 §2C: mosquitto on this Pi, 127.0.0.1:1883, anonymous).
    mqtt_host: str = "127.0.0.1"
    mqtt_port: int = Field(default=1883, ge=1, le=65535)
    z2m_base_topic: str = "zigbee2mqtt"
    # Reconnect backoff doubles from min to max seconds (INTAKE-01 §5B: 1 → 30 s).
    mqtt_reconnect_min_s: float = Field(default=1.0, gt=0)
    mqtt_reconnect_max_s: float = Field(default=30.0, gt=0)
    # A QoS 1 publish the broker has not accepted after this long fails (core-api waits 3 s).
    mqtt_publish_timeout_s: float = Field(default=2.0, gt=0)

    # Friendly names [ASSUMED] (ARCHITECTURE §7.1); confirmed on hardware: ir_node (INTAKE-01 §2C),
    # temp_node (H03), motion_node and door_node (H04).
    lights_node: str = "r101_lights"
    proj_plug_node: str = "r101_proj_plug"
    ir_node: str = "r101_ir"
    temp_node: str = "r101_temp"
    motion_node: str = "r101_motion"
    door_node: str = "r101_door"
    # PLAN-H05 D4: the SNZB-03P's "no motion" delay, re-applied when a report shows another value
    # (a factory reset for re-pairing puts it back to 60 s). zigbee2mqtt allows 5-60.
    motion_timeout_s: int = Field(default=15, ge=5, le=60)

    # Podium MCU (ESP32, USB serial, PLAN-H06 D1). Opening the port resets the board (T0), so
    # nothing is sent until its `evt ready`, or until boot_wait_s passes without one.
    podium_port: str = "/dev/podium-mcu"
    podium_baud: int = Field(default=115200, gt=0)
    podium_boot_wait_s: float = Field(default=2.0, gt=0)
    podium_cmd_timeout_s: float = Field(default=1.0, gt=0)
    # `src <n>` presses and re-reads up to 4 times (fw:setSource, about 3.3 s); core-api waits 5 s.
    podium_src_timeout_s: float = Field(default=4.5, gt=0)
    # Below the firmware's 60 s host_silent limit (fw:loop).
    podium_ping_s: float = Field(default=20.0, gt=0)
    podium_reconnect_min_s: float = Field(default=1.0, gt=0)
    podium_reconnect_max_s: float = Field(default=30.0, gt=0)
    # HDMI switch input (1 or 2) wired to the podium PC; the other one is the smart board.
    # [ASSUMED] until PLAN-H06 AC5.
    hdmi_podium_pc_input: Literal[1, 2] = 1
    # Digipot pair per audio channel: CS A = U3+U4 "PC stereo", CS B = U5+U6 "Mic stereo"
    # (firmware pin map). [ASSUMED] until PLAN-H06 AC3.
    podium_pc_ch: Literal["a", "b"] = "a"
    podium_mic_ch: Literal["a", "b"] = "b"
    # Levels set when the MCU has not homed its digipots, i.e. after every boot (D-30, PLAN-H06 D5).
    audio_start_mic: int = Field(default=60, ge=0, le=100)
    audio_start_pc: int = Field(default=40, ge=0, le=100)

    zigbee_nodes: list[ZigbeeNodeConfig] = Field(default_factory=lambda: list(DEFAULT_NODES))
    coordinator: CoordinatorConfig = DEFAULT_COORDINATOR

    # Fake drivers only
    # Divides simulated durations (ramps, IR learn, screen travel, permit join). 60 = 60x faster.
    fake_time_scale: float = Field(default=1.0, gt=0)
    fake_seed: int = 101
    # Seconds between periodic power and climate readings (not scaled).
    fake_report_interval_s: float = Field(default=10.0, gt=0)
    fake_energy_kwh_total: float = Field(default=412.67, ge=0)
    # IR codes the fake projector reacts to. The on code equals fixtures/hw/request.ir.send.json.
    fake_projector_on_code: str = "C/8hRgHrBkYBgAMH"
    fake_projector_off_code: str = "C/8hRgHrBkYBgAMP"
