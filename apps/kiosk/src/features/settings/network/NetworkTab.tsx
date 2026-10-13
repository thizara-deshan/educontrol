import { Card } from "@/components/Card";
import { SectionLabel } from "@/components/SectionLabel";
import { useNetworkInfo } from "@/data/settings/hooks";
import { QueryStatus } from "../shared/QueryStatus";
import { SettingsRow } from "../shared/SettingsRow";
import { clientsSummary, networkRows } from "./network.view";

/** S3b: read-only rows (no editing in v1, Q25), one column at every width. */
export function NetworkTab() {
  const query = useNetworkInfo();
  const info = query.data;
  return (
    <Card className="flex max-w-3xl flex-col gap-2">
      <SectionLabel>Network</SectionLabel>
      {info === undefined ? (
        <QueryStatus status={query.isError ? "error" : "pending"} what="network details" onRetry={() => void query.refetch()} rows={5} />
      ) : (
        <div>
          {networkRows(info).map((row) => (
            <SettingsRow key={row.label} label={row.label} value={row.value} mono={row.mono} tone={row.tone} />
          ))}
          {info.clients.length > 0 && <p className="pb-2 text-right text-caption text-text-2">{clientsSummary(info.clients)}</p>}
        </div>
      )}
    </Card>
  );
}
