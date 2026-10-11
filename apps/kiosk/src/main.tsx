import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@/styles/index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TokenSwatches } from "@/app/TokenSwatches";

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("index.html is missing #root");
}
createRoot(rootElement).render(
  <StrictMode>
    <TokenSwatches />
  </StrictMode>,
);
