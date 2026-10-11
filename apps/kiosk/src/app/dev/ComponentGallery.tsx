import type { ReactNode } from "react";
import { Card } from "@/components/Card";
import { CommandButton } from "@/components/CommandButton";
import { DashedAddButton } from "@/components/DashedAddButton";
import { InlineError } from "@/components/InlineError";
import { KeyValueRow } from "@/components/KeyValueRow";
import { LevelSlider } from "@/components/LevelSlider";
import { LockBadge } from "@/components/LockBadge";
import { MetricTile } from "@/components/MetricTile";
import { ObservedLine } from "@/components/ObservedLine";
import { SectionLabel } from "@/components/SectionLabel";
import { SensorTile } from "@/components/SensorTile";
import { StateDot } from "@/components/StateDot";
import { ToggleRow } from "@/components/ToggleRow";
import type { StateTone } from "@/components/state-styles";
import { LiveDemo } from "./LiveDemo";

// Temporary dev-only page (`/dev/components`, M02 AC6): every shared component in every SPEC
// §3.4 state. Removed when M04–M06 use the components for real.

const TONES: StateTone[] = ["confirmed", "selected", "assumed", "off", "unknown", "offline"];
const noop = (): void => undefined;

function Demo({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-3">
      <SectionLabel>{title}</SectionLabel>
      {children}
    </Card>
  );
}

export function ComponentGallery() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <h1 className="text-title font-bold text-text-1">Components</h1>
      <LiveDemo />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Demo title="StateDot">
          <ul className="flex flex-col gap-2">
            {TONES.map((tone) => (
              <li key={tone} className="flex items-center gap-2 text-caption text-text-2">
                <StateDot tone={tone} /> {tone}
              </li>
            ))}
            <li className="flex items-center gap-2 text-caption text-text-2">
              <StateDot tone="confirmed" stale /> stale
            </li>
          </ul>
        </Demo>

        <Demo title="ObservedLine">
          <ObservedLine tone="confirmed" text="On · confirmed by draw" />
          <ObservedLine tone="selected" text="Selected, confirmed" />
          <ObservedLine tone="assumed" text="On · assumed" />
          <ObservedLine tone="off" text="Standby · confirmed by draw" />
          <ObservedLine tone="unknown" text="Unknown" />
          <ObservedLine tone="confirmed" text="26.4°" staleAgo="14 min ago" />
          <ObservedLine tone="offline" text="Switch offline · last known state" />
          <ObservedLine tone="confirmed" text="" loading />
        </Demo>

        <Demo title="Card">
          <Card>solid</Card>
          <Card variant="dashed">dashed (assumed / unknown)</Card>
          <Card variant="danger">danger (offline)</Card>
        </Demo>

        <Demo title="CommandButton">
          <div className="grid grid-cols-2 gap-3">
            <CommandButton label="Power on" size="primary" active="confirmed" onPress={noop} />
            <CommandButton label="Power off" size="primary" onPress={noop} />
            <CommandButton label="Podium PC" active="selected" onPress={noop} />
            <CommandButton label="Power on" active="assumed" onPress={noop} />
            <CommandButton label="Power off" active="neutral" onPress={noop} />
            <CommandButton label="Pending" pending onPress={noop} />
            <CommandButton label="Disabled" disabled onPress={noop} />
            <CommandButton label="Offline" disabled active="confirmed" onPress={noop} />
          </div>
        </Demo>

        <Demo title="ToggleRow">
          <ToggleRow label="On" on onToggle={noop} />
          <ToggleRow label="Off" on={false} onToggle={noop} />
          <ToggleRow label="Unknown" on={null} onToggle={noop} />
          <ToggleRow label="Pending" on={false} pending onToggle={noop} />
          <ToggleRow label="Disabled (offline)" on disabled onToggle={noop} />
        </Demo>

        <Demo title="LevelSlider">
          <LevelSlider label="Normal" value={62} onChange={noop} />
          <LevelSlider label="Muted" value={38} muted onChange={noop} />
          <LevelSlider label="Pending" value={50} pending onChange={noop} />
          <LevelSlider label="Disabled" value={20} disabled onChange={noop} />
          <LevelSlider label="Unknown" value={null} onChange={noop} />
        </Demo>

        <Demo title="SensorTile">
          <div className="grid grid-cols-2 gap-4">
            <SensorTile label="Temperature" value="26.4°" caption="SNZB-02P" />
            <SensorTile label="Occupancy" value="Detected" tone="accent" caption="SNZB-03P" />
            <SensorTile label="Door" value="Open" tone="warn" caption="SNZB-04PR2" />
            <SensorTile label="Humidity" value="61%" caption="SNZB-02P" staleAgo="14 min ago" />
            <SensorTile label="No data" value={null} caption="SNZB-02P" />
            <SensorTile label="Loading" value={null} caption="SNZB-02P" loading />
          </div>
        </Demo>

        <Demo title="MetricTile">
          <div className="grid grid-cols-2 gap-4">
            <MetricTile label="Power" value="287 W" tone="accent" />
            <MetricTile label="Voltage" value="231 V" />
            <MetricTile label="Today" value={null} />
            <MetricTile label="Loading" value={null} loading />
          </div>
        </Demo>

        <Demo title="KeyValueRow">
          <KeyValueRow label="Chipset" value="CC2652P1" />
          <KeyValueRow label="Routers" value="2" tone="accent" />
          <KeyValueRow label="Joining" value={null} />
          <KeyValueRow label="Loading" value={null} loading />
        </Demo>

        <Demo title="InlineError · LockBadge · DashedAddButton">
          <InlineError message="Couldn't reach the blaster" />
          <InlineError message="No response · tap to retry" />
          <p className="flex items-center gap-2 text-card-title font-semibold text-text-1">
            Lights <LockBadge />
          </p>
          <DashedAddButton label="Add device" onPress={noop} />
          <DashedAddButton label="Disabled" disabled onPress={noop} />
        </Demo>
      </div>
    </div>
  );
}
