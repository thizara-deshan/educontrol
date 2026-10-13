import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/Card";
import { DashedAddButton } from "@/components/DashedAddButton";
import { InlineError } from "@/components/InlineError";
import { SectionLabel } from "@/components/SectionLabel";
import { DISABLED_CONTROL_CLASS, PENDING_CONTROL_CLASS } from "@/components/state-styles";
import { ToggleRow } from "@/components/ToggleRow";
import { queryKeys } from "@/data/query-keys";
import { useSchedule, useServerMutation } from "@/data/settings/hooks";
import { cn } from "@/lib/utils";
import { QueryStatus } from "../shared/QueryStatus";
import { useWritable } from "../shared/use-writable";
import { AddActionSheet } from "./AddActionSheet";
import { AddBlockSheet } from "./AddBlockSheet";
import { actionRows, blockRows, withEnabled, type ActionRow, type BlockRow } from "./schedule.view";

const SAVE_FAILED = "Couldn't save · try again";

function DeleteButton({ label, pending, disabled, onPress }: { label: string; pending: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-busy={pending}
      disabled={disabled}
      onClick={() => {
        if (!pending) onPress();
      }}
      className={cn(
        "flex size-14 shrink-0 items-center justify-center rounded-btn border-2 border-border-strong bg-control text-text-2 active:brightness-125",
        pending && PENDING_CONTROL_CLASS,
        disabled && DISABLED_CONTROL_CLASS,
      )}
    >
      <Trash2 aria-hidden="true" className="size-5" />
    </button>
  );
}

function BlockItem({ row }: { row: BlockRow }) {
  const writable = useWritable();
  const remove = useServerMutation((api, id: string) => api.schedule.deleteBlock(id), [queryKeys.schedule()]);
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <div className="flex min-h-14 flex-1 flex-col justify-center rounded-btn bg-surface-2 px-4">
          <span className="font-mono text-button text-text-1">{row.time}</span>
          <span className="text-caption text-text-2">{row.days}</span>
        </div>
        <DeleteButton label={`Delete block ${row.time} ${row.days}`} pending={remove.isPending} disabled={!writable} onPress={() => remove.mutate(row.id)} />
      </div>
      <InlineError message={remove.isError ? SAVE_FAILED : null} />
    </li>
  );
}

function ActionItem({ row }: { row: ActionRow }) {
  const writable = useWritable();
  const toggle = useServerMutation((api, enabled: boolean) => api.schedule.updateAction(row.id, withEnabled(row.action, enabled)), [queryKeys.schedule()]);
  const remove = useServerMutation((api, id: string) => api.schedule.deleteAction(id), [queryKeys.schedule()]);
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        {/* The switch shows the server value; the row pulses until the refetch lands (never optimistic). */}
        <ToggleRow label={row.label} on={row.enabled} pending={toggle.isPending} disabled={!writable} onToggle={() => toggle.mutate(!row.enabled)} className="flex-1" />
        <DeleteButton label={`Delete ${row.label}`} pending={remove.isPending} disabled={!writable} onPress={() => remove.mutate(row.id)} />
      </div>
      <InlineError message={toggle.isError || remove.isError ? SAVE_FAILED : null} />
    </li>
  );
}

/** S3c: class blocks (end control sessions, §2.3) and timed actions (toggle, delete). lg: side by side. */
export function ScheduleTab() {
  const query = useSchedule();
  const writable = useWritable();
  const [adding, setAdding] = useState<"block" | "action" | null>(null);
  const schedule = query.data;
  const loading = schedule === undefined && (
    <QueryStatus status={query.isError ? "error" : "pending"} what="the schedule" onRetry={() => void query.refetch()} rows={2} />
  );
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
      <Card className="flex flex-col gap-3">
        <SectionLabel>Class blocks</SectionLabel>
        <p className="text-caption text-text-2">Room PIN sessions end when the current block ends.</p>
        {loading}
        {schedule !== undefined && schedule.class_blocks.length === 0 && <p className="text-caption text-text-3">No class blocks</p>}
        {schedule !== undefined && (
          <ul className="flex flex-col gap-2">
            {blockRows(schedule.class_blocks).map((row) => (
              <BlockItem key={row.id} row={row} />
            ))}
          </ul>
        )}
        <DashedAddButton label="Add block" disabled={!writable} onPress={() => setAdding("block")} className="h-14" />
      </Card>
      <Card className="flex flex-col gap-3">
        <SectionLabel>Timed actions</SectionLabel>
        <p className="text-caption text-text-2">Changes they make show as “· by schedule”.</p>
        {loading}
        {schedule !== undefined && schedule.actions.length === 0 && <p className="text-caption text-text-3">No timed actions</p>}
        {schedule !== undefined && (
          <ul className="flex flex-col gap-2">
            {actionRows(schedule.actions).map((row) => (
              <ActionItem key={row.id} row={row} />
            ))}
          </ul>
        )}
        <DashedAddButton label="Add action" disabled={!writable} onPress={() => setAdding("action")} className="h-14" />
      </Card>
      <AddBlockSheet open={adding === "block"} onOpenChange={(open) => setAdding(open ? "block" : null)} />
      <AddActionSheet open={adding === "action"} onOpenChange={(open) => setAdding(open ? "action" : null)} />
    </div>
  );
}
