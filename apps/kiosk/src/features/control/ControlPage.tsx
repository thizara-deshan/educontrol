import { SectionLabel } from "@/components/SectionLabel";
import { SourceTiles } from "./display/SourceTiles";
import { ProjectorCard } from "./display/ProjectorCard";
import { ScreenCard } from "./display/ScreenCard";
import { LevelCard } from "./audio/LevelCard";
import { MuteAllBar } from "./audio/MuteAllBar";
import { LightsCard } from "./environment/LightsCard";

// SPEC §2.2 / ARCHITECTURE §4.1: one grid. Phone: Display → Audio → Environment. 600–1023:
// Display + Audio stacked left, Environment right. ≥1024: three columns, no scroll at 1280×800.
// scroll-mt-18 = sticky 56px header + 16px, so BottomNav jumps land below the header.
const SECTION = "flex min-w-0 scroll-mt-18 flex-col gap-3";

export function ControlPage() {
  return (
    <div className="grid grid-cols-1 gap-4 pb-14 sm:grid-cols-2 sm:grid-rows-[auto_1fr] sm:pb-0 lg:grid-cols-3 lg:grid-rows-1">
      <section id="display" aria-label="Display" className={SECTION}>
        <SectionLabel>Display</SectionLabel>
        <SourceTiles />
        <ProjectorCard />
        <ScreenCard />
      </section>
      <section id="audio" aria-label="Audio" className={`${SECTION} sm:col-start-1 lg:col-start-2 lg:row-start-1`}>
        <SectionLabel>Audio</SectionLabel>
        <LevelCard channel="mic" />
        <LevelCard channel="pc" />
        <MuteAllBar />
      </section>
      <section
        id="environment"
        aria-label="Environment"
        className={`${SECTION} sm:col-start-2 sm:row-span-2 sm:row-start-1 lg:col-start-3 lg:row-span-1`}
      >
        <SectionLabel>Environment</SectionLabel>
        <LightsCard />
      </section>
    </div>
  );
}
