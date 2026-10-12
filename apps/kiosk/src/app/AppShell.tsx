import { Outlet } from "react-router";
import { GREYED_CLASS } from "@/components/state-styles";
import { useConnectionStatus, useSession } from "@/data/hooks";
import { KioskBehaviour } from "@/features/kiosk/KioskBehaviour";
import { PinOverlay } from "@/features/pin/PinOverlay";
import { useSessionWatcher } from "@/features/session/use-session-watcher";
import { cn } from "@/lib/utils";
import { Toaster } from "@/ui/sonner";
import { ConnectionBanner } from "./ConnectionBanner";
import { Header } from "./Header";
import { MockPanel } from "./dev/MockPanel";
import { mockPanelEnabled } from "./mock-panel-flag";

const showMockPanel = mockPanelEnabled();

/** ARCHITECTURE §4.1 frame: header, banner, page; S4 overlay; kiosk behaviour (kiosk only). */
export function AppShell() {
  const status = useConnectionStatus();
  const clientType = useSession()?.client_type;
  useSessionWatcher();
  const greyed = status === "reconnecting" || status === "unreachable";
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <Header />
      <ConnectionBanner />
      <main className={cn("flex-1 px-4 py-4 transition-[filter,opacity] lg:px-6 lg:py-6", greyed && GREYED_CLASS)}>
        <Outlet />
      </main>
      <Toaster />
      <PinOverlay />
      {clientType === "kiosk" && <KioskBehaviour />}
      {showMockPanel && <MockPanel />}
    </div>
  );
}
