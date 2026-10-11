import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@/styles/index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { AppProviders } from "@/app/providers";
import { router } from "@/app/router";

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("index.html is missing #root");
}
createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
