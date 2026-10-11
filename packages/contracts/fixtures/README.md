# Contract fixtures

Golden JSON examples. Vitest parses every file with zod (`packages/contracts/test/`); M07's
`services/hw/tests/test_contract_fixtures.py` parses every `hw/` file with pydantic, re-serialises it
with `model_dump(mode="json")` and compares. A change to a hw schema updates zod, pydantic and these
files **in one commit**.

- `state/room-normal.json` — a `RoomState` reproducing screenshots 01 and 02. The kiosk mock seeds from it.
- `hw/` — one file per hw request, response and event type.

## hw file-name → schema rule

Strip `.json`, split on `.`. `Pascal(x)` = split `x` on `_`, capitalise each part, join.

| Pattern | Schema | Extra check |
|---|---|---|
| `event.<type>.json` (`<type>` may contain dots) | `HwEvent` | parsed `type` equals `<type>` |
| `request.<module>.<action>.json` | `Hw` + Pascal(module) + Pascal(action) + `Request` | — |
| `response.<name>.json` or `response.<name>.<variant>.json` | `Hw` + Pascal(name) | `<variant>` is a label only |

Examples: `event.lights.state.json` → `HwEvent` with `type: "lights.state"`;
`request.zigbee_status.permit_join.json` → `HwZigbeeStatusPermitJoinRequest`;
`response.ack.error.json` → `HwAck`; `response.ir_learn_result.timeout.json` → `HwIrLearnResult`.

Pydantic model class names equal the zod schema names. Timestamps use the `Z` suffix so pydantic
round-trips them unchanged. Every `HwEvent` type and every `Hw*Request` schema must have a fixture
(enforced by `test/hw-fixtures.test.ts`).
