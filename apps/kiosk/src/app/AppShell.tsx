import { Outlet } from "react-router";
import { GREYED_CLASS } from "@/components/state-styles";
import { useConnectionStatus } from "@/data/hooks";
import { cn } from "@/lib/utils";
import { Toaster } from "@/ui/sonner";
import { ConnectionBanner } from "./ConnectionBanner";
import { Header } from "./Header";
import { MockPanel } from "./dev/MockPanel";
import { mockPanelEnabled } from "./mock-panel-flag";

const showMockPanel = mockPanelEnabled();

/** ARCHITECTURE §4.1 frame: header, banner, page; no horizontal page scroll. */
export function AppShell() {
  const status = useConnectionStatus();
  const greyed = status === "reconnecting" || status === "unreachable";
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <Header />
      <ConnectionBanner />
      <main className={cn("flex-1 px-4 py-4 transition-[filter,opacity] lg:px-6 lg:py-6", greyed && GREYED_CLASS)}>
        <Outlet />
      </main>
      <Toaster />
      {showMockPanel && <MockPanel />}
    </div>
  );
}
