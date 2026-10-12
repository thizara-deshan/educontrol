import { useState } from "react";
import { fakeRoom } from "@/data/adapters/mock/mock-client";
import { cn } from "@/lib/utils";

const ACTIONS: { label: string; run: () => void }[] = [
  { label: "Drop connection", run: () => fakeRoom.dropConnection() },
  { label: "Make unreachable", run: () => fakeRoom.makeUnreachable() },
  { label: "Restore", run: () => fakeRoom.restore() },
  { label: "Change from phone", run: () => fakeRoom.changeFromPhone() },
  { label: "Change by hand", run: () => fakeRoom.changeByHand() },
  { label: "Toggle lights offline", run: () => fakeRoom.toggleDeviceOffline("lights") },
  { label: "Toggle audio offline", run: () => fakeRoom.toggleDeviceOffline("audio") },
  { label: "Fail next command", run: () => fakeRoom.failNextCommand() },
  { label: "Time out next command", run: () => fakeRoom.timeOutNextCommand() },
  { label: "Expire session", run: () => fakeRoom.expireSession() },
  { label: "Be kiosk", run: () => fakeRoom.setClientType("kiosk") },
  { label: "Be remote", run: () => fakeRoom.setClientType("remote") },
  { label: "Occupancy detected", run: () => fakeRoom.occupancyDetected() },
];

/**
 * Dev-only panel (`?mock-panel`) that drives the FakeRoom directly. It sits above the kiosk sleep
 * overlay and is exempt from the wake guard, so "Occupancy detected" can be tested while dimmed.
 */
export function MockPanel() {
  const [open, setOpen] = useState(true);
  return (
    <aside
      data-wake-exempt
      className="fixed right-4 bottom-4 z-[1000000001] max-h-[calc(100dvh-2rem)] w-64 overflow-y-auto rounded-card border border-border-strong bg-surface p-2 shadow-lg"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-full items-center justify-between px-2 text-section font-bold uppercase text-text-2"
      >
        Mock panel <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <div className={cn("flex-col gap-1", open ? "flex" : "hidden")}>
        {ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.run}
            className="h-12 rounded-btn border border-border-strong bg-control px-3 text-left text-caption font-semibold text-text-1 active:brightness-125"
          >
            {action.label}
          </button>
        ))}
      </div>
    </aside>
  );
}
