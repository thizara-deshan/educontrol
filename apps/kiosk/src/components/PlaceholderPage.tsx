import { Card } from "./Card";
import { SectionLabel } from "./SectionLabel";

/** Temporary page body until the screen's milestone replaces it. */
export function PlaceholderPage({ title, spec, milestone }: { title: string; spec: string; milestone: string }) {
  return (
    <Card className="flex flex-col gap-2">
      <SectionLabel>{spec}</SectionLabel>
      <h1 className="text-title font-bold text-text-1">{title}</h1>
      <p className="text-caption text-text-2">Placeholder · built in {milestone}</p>
    </Card>
  );
}
