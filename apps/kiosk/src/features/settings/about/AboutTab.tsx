import { Card } from "@/components/Card";
import { SectionLabel } from "@/components/SectionLabel";
import { useAboutInfo } from "@/data/settings/hooks";
import { Skeleton } from "@/ui/skeleton";
import { QueryStatus } from "../shared/QueryStatus";
import { SettingsRow } from "../shared/SettingsRow";
import { formatUptime } from "./about.view";
import { QrCode } from "./QrCode";
import { RestartButton } from "./RestartButton";

/** S3e: room, version, uptime, Pi model, QR for the room URL (from AboutInfo.url), Restart. lg: two columns. */
export function AboutTab() {
  const query = useAboutInfo();
  const about = query.data;
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-6">
      <Card className="flex flex-col gap-3">
        <SectionLabel>About</SectionLabel>
        {about === undefined ? (
          <QueryStatus status={query.isError ? "error" : "pending"} what="controller details" onRetry={() => void query.refetch()} rows={4} />
        ) : (
          <div>
            <SettingsRow label="Room" value={about.room} mono />
            <SettingsRow label="Software version" value={about.version} mono />
            <SettingsRow label="Controller uptime" value={formatUptime(about.uptime_s)} />
            <SettingsRow label="Pi model" value={about.pi_model} />
          </div>
        )}
        <RestartButton />
      </Card>
      <Card className="flex flex-col items-center gap-3">
        <SectionLabel className="self-start">Open on a phone</SectionLabel>
        {about === undefined ? <Skeleton className="size-48 lg:size-56" /> : <QrCode url={about.url} />}
        <p className="font-mono text-button text-text-1">{about?.url ?? "—"}</p>
      </Card>
    </div>
  );
}
