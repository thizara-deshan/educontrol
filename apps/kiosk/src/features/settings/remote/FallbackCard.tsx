import { Card } from "@/components/Card";
import { SectionLabel } from "@/components/SectionLabel";

/** S3.E11 (static, R8). */
export function FallbackCard() {
  return (
    <Card className="flex flex-col gap-2">
      <SectionLabel>Fallback</SectionLabel>
      <p className="text-caption text-text-2">
        The ESP32 emitter heads on GPIO 16 and 17 stay wired. Switch a device to them by setting its transport to mcu in
        the room config.
      </p>
    </Card>
  );
}
