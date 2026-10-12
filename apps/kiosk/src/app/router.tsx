import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { ControlPage } from "@/features/control/ControlPage";
import { DevicesPage } from "@/features/devices/DevicesPage";
import { SettingsGuard } from "@/features/settings/SettingsGuard";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { AppShell } from "./AppShell";
import { RouteErrorBoundary } from "./ErrorBoundary";

// ARCHITECTURE §4.3. Every /settings/* route sits under SettingsGuard (technician).
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: "dev/components",
        lazy: async () => ({ Component: (await import("./dev/ComponentGallery")).ComponentGallery }),
      },
    ]
  : [];

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <ControlPage /> },
      { path: "devices", element: <DevicesPage /> },
      {
        path: "settings",
        element: <SettingsGuard />,
        children: [
          { index: true, element: <Navigate to="/settings/remote" replace /> },
          { path: "remote", element: <SettingsPage tab="remote" /> },
          { path: "remote/:deviceId", element: <SettingsPage tab="remote" /> },
          { path: "network", element: <SettingsPage tab="network" /> },
          { path: "schedule", element: <SettingsPage tab="schedule" /> },
          { path: "devices", element: <SettingsPage tab="devices" /> },
          { path: "about", element: <SettingsPage tab="about" /> },
        ],
      },
      ...devRoutes,
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
