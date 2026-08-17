import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app.tsx";
import "./index.css";

// Start every load at the top: ignore the browser's stored scroll position
// and any #hash fragment target so a refresh never opens mid-page.
if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}
window.scrollTo({ top: 0, behavior: "instant" });
window.addEventListener("load", () => {
  window.scrollTo({ top: 0, behavior: "instant" });
});

// biome-ignore lint/style/noNonNullAssertion: vite handles this
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
