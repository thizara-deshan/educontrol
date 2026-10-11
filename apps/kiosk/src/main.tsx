import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("index.html is missing #root");
}
createRoot(rootElement).render(
  <StrictMode>
    <main>eduscope</main>
  </StrictMode>,
);
