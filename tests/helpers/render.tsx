import { type RenderOptions, render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

function Wrapper({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, { wrapper: Wrapper, ...options });
}
