import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { ControlPage } from "@/features/control/ControlPage";
import { DevicesPage } from "@/features/devices/DevicesPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { AppShell } from "./AppShell";
import { RouteErrorBoundary } from "./ErrorBoundary";

// ARCHITECTURE §4.3. Settings guards arrive in M03.
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
      { path: "settings", element: <Navigate to="/settings/remote" replace /> },
      { path: "settings/remote", element: <SettingsPage tab="remote" /> },
      { path: "settings/remote/:deviceId", element: <SettingsPage tab="remote" /> },
      { path: "settings/network", element: <SettingsPage tab="network" /> },
      { path: "settings/schedule", element: <SettingsPage tab="schedule" /> },
      { path: "settings/devices", element: <SettingsPage tab="devices" /> },
      { path: "settings/about", element: <SettingsPage tab="about" /> },
      ...devRoutes,
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
