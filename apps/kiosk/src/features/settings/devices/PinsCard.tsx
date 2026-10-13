import { useState } from "react";
import { Card } from "@/components/Card";
import { CommandButton } from "@/components/CommandButton";
import { SectionLabel } from "@/components/SectionLabel";
import { SettingsRow } from "../shared/SettingsRow";
import { useWritable } from "../shared/use-writable";
import type { PinLevel } from "./pin-change";
import { PinChangeSheet } from "./PinChangeSheet";

/** S3d PIN management: "Room PIN" / "Technician PIN" with "Change". PINs are never shown. */
export function PinsCard() {
  const [changing, setChanging] = useState<{ level: PinLevel; key: number } | null>(null);
  const writable = useWritable();
  const open = (level: PinLevel): void => setChanging({ level, key: Date.now() });
  return (
    <Card className="flex flex-col gap-2">
      <SectionLabel>PINs</SectionLabel>
      <div>
        <SettingsRow label="Room PIN" value="4 digits">
          <CommandButton label="Change" disabled={!writable} onPress={() => open("room")} />
        </SettingsRow>
        <SettingsRow label="Technician PIN" value="6 digits">
          <CommandButton label="Change" disabled={!writable} onPress={() => open("technician")} />
        </SettingsRow>
      </div>
      {changing !== null && <PinChangeSheet key={changing.key} level={changing.level} onClose={() => setChanging(null)} />}
    </Card>
  );
}
