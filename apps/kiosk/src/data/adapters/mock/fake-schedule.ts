import { ClassBlockInput, TimedActionInput, type ClassBlock, type Schedule, type TimedAction } from "@eduscope/contracts";
import { ApiRequestError } from "@/data/api-client";
import type { MockHost } from "./mock-host";

// S3c in the mock: class blocks and timed actions, kept for the page session. The mock never
// runs the actions or ends sessions at block end (core-api's scheduler does that, M09).

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"] as const;

function seededSchedule(): Schedule {
  return {
    class_blocks: [
      { id: "blk-1", days: [...WEEKDAYS], start: "08:00", end: "10:00" },
      { id: "blk-2", days: [...WEEKDAYS], start: "10:15", end: "12:15" },
      { id: "blk-3", days: ["mon", "wed"], start: "13:00", end: "15:00" },
    ],
    actions: [
      {
        id: "act-1", name: "All off", time: "18:00", days: [...WEEKDAYS], enabled: true,
        steps: [
          { kind: "projector.power", on: false },
          { kind: "ac.power", on: false },
          { kind: "lights.set", gang: "front", on: false },
          { kind: "lights.set", gang: "rear", on: false },
        ],
      },
    ],
  };
}

export class FakeSchedule {
  private schedule: Schedule = seededSchedule();
  private seq = 0;

  constructor(private readonly host: MockHost) {}

  async get(): Promise<Schedule> {
    await this.host.delay();
    return this.schedule;
  }

  async createBlock(input: ClassBlockInput): Promise<ClassBlock> {
    const parsed = ClassBlockInput.parse(input);
    await this.host.delay();
    const block: ClassBlock = { id: `mock-blk-${++this.seq}`, ...parsed };
    this.save({ ...this.schedule, class_blocks: [...this.schedule.class_blocks, block] });
    return block;
  }

  async deleteBlock(id: string): Promise<void> {
    await this.host.delay();
    if (!this.schedule.class_blocks.some((block) => block.id === id)) throw notFound();
    this.save({ ...this.schedule, class_blocks: this.schedule.class_blocks.filter((block) => block.id !== id) });
  }

  async createAction(input: TimedActionInput): Promise<TimedAction> {
    const parsed = TimedActionInput.parse(input);
    await this.host.delay();
    const action: TimedAction = { id: `mock-act-${++this.seq}`, ...parsed };
    this.save({ ...this.schedule, actions: [...this.schedule.actions, action] });
    return action;
  }

  async updateAction(id: string, input: TimedActionInput): Promise<TimedAction> {
    const parsed = TimedActionInput.parse(input);
    await this.host.delay();
    if (!this.schedule.actions.some((action) => action.id === id)) throw notFound();
    const action: TimedAction = { id, ...parsed };
    this.save({ ...this.schedule, actions: this.schedule.actions.map((candidate) => (candidate.id === id ? action : candidate)) });
    return action;
  }

  async deleteAction(id: string): Promise<void> {
    await this.host.delay();
    if (!this.schedule.actions.some((action) => action.id === id)) throw notFound();
    this.save({ ...this.schedule, actions: this.schedule.actions.filter((action) => action.id !== id) });
  }

  private save(next: Schedule): void {
    this.schedule = next;
    this.host.emit({ type: "invalidate", keys: [["schedule"]] });
  }
}

const notFound = (): ApiRequestError => new ApiRequestError("not_found", "Not found", 404);
