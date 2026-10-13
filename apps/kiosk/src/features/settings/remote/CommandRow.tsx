import type { IrCommand, IrDevice } from "@eduscope/contracts";
import { CommandButton } from "@/components/CommandButton";
import { InlineError } from "@/components/InlineError";
import { VALUE_TONE_CLASS } from "@/components/state-styles";
import { cn } from "@/lib/utils";
import type { RowButton } from "./command-row";
import { useCommandRow } from "./use-command-row";

function RowAction({ button, onPress, className }: { button: RowButton; onPress: () => void; className?: string }) {
  return (
    <CommandButton
      label={button.label}
      onPress={onPress}
      pending={button.pending}
      disabled={!button.enabled}
      active={button.highlighted === true ? "confirmed" : null}
      className={cn("w-full sm:w-auto sm:min-w-20", className)}
    />
  );
}

/**
 * S3.E14/E15. ≥600: name | capture | buttons on one line (screenshot 03). <600: line 1 name +
 * capture, line 2 the buttons at half width each, 48px (SPEC §2.2 S3).
 */
export function CommandRow({ command, device }: { command: IrCommand; device: IrDevice }) {
  const { view, error, learn, cancel, test, answer } = useCommandRow(command, device);
  const { actions } = view;
  return (
    <li className="border-t border-border bg-surface-2 px-4 py-3">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_12.5rem]">
        <span className="text-card-title font-semibold text-text-1">{command.name}</span>
        <div className="flex min-w-0 flex-col gap-1 text-right sm:text-left">
          <span className={cn("font-mono text-caption", VALUE_TONE_CLASS[view.status.tone])}>
            {view.status.text}
            {view.countdown !== null && <span className="ml-2 whitespace-nowrap text-text-1">{view.countdown}</span>}
          </span>
          {view.note !== null && <span className={cn("text-caption font-semibold", VALUE_TONE_CLASS[view.note.tone])}>{view.note.text}</span>}
        </div>
        <div className="col-span-2 grid grid-cols-2 gap-2 sm:col-span-1 sm:flex sm:justify-end">
          {actions.kind === "default" && (
            <>
              <RowAction button={actions.test} onPress={() => void test()} />
              <RowAction button={actions.learn} onPress={() => void learn()} />
            </>
          )}
          {actions.kind === "listening" && <RowAction button={actions.cancel} onPress={() => void cancel()} className="col-span-2" />}
          {actions.kind === "asking" && (
            <>
              <RowAction button={actions.yes} onPress={() => void answer(true)} />
              <RowAction button={actions.no} onPress={() => void answer(false)} />
            </>
          )}
        </div>
      </div>
      <InlineError message={error} className="mt-2" />
    </li>
  );
}
