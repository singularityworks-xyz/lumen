import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app.tsx";
import "./index.css";
import { SmoothScroll } from "./animations/smooth-scroll.tsx";

// biome-ignore lint/style/noNonNullAssertion: vite handles this
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SmoothScroll>
      <App />
    </SmoothScroll>
  </StrictMode>
);
