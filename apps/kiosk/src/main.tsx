import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@/styles/index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("index.html is missing #root");
}
createRoot(rootElement).render(
  <StrictMode>
    <main className="p-4 font-mono text-clock">eduscope</main>
  </StrictMode>,
);
