import { CommandButton } from "@/components/CommandButton";
import { InlineError } from "@/components/InlineError";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog";

/** "Restart controller?", "Remove {device}?": Cancel · confirm (48px), pending while the request runs. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm, pending, error = null }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  pending: boolean;
  error?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <InlineError message={error} />
        <DialogFooter>
          <CommandButton label="Cancel" onPress={() => onOpenChange(false)} />
          <CommandButton label={confirmLabel} className="border-danger text-danger" pending={pending} onPress={onConfirm} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
