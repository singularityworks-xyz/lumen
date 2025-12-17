"use client";

import { useEffect } from "react";

export function ConsoleBranding() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const { console: originalConsole } = window;

    if (process.env.NODE_ENV === "development") {
      originalConsole.clear();
    }

    const s = {
      ascii:
        "color: #A78BFA; font-weight: 800; line-height: 1.2; text-shadow: 0 0 15px rgba(167, 139, 250, 0.6);",
      title:
        "color: #F3F4F6; font-family: sans-serif; font-weight: 700; font-size: 14px; padding-top: 15px;",
      body: "color: #C084FC; font-family: sans-serif; font-size: 12px; padding-bottom: 10px;",
      link: "color: #EC4899; font-weight: bold; text-decoration: underline; cursor: pointer;",
      hud: "color: #6B7280; font-family: monospace; font-size: 10px; margin-top: 5px;",
    };

    const region = Intl.DateTimeFormat().resolvedOptions().timeZone;
    originalConsole.log(
      `%c:: SYSTEM ONLINE :: Region: ${region} :: Want something built? Contact us at work@singularityworks.xyz`,
      s.hud
    );

    const blackHoleAscii = `
    ████████████████████████████████████████
    ████████████████████████████████████████
    ██████████████─────────────█████████████
    ███████████───────────────────██████████
    █████████───────────────────────████████
    ███████─────██─────────────██─────██████
    ██████─────████───────────████─────█████
    █████─────██████─────────█████──────████
    ████──────██████────────███████──────███
    ███──────██████████████████████──────███
    ███──────███─────███████─────███──────██
    ██───────█─────█───███───█─────█──────██
    ██──────██─────█────█────█─────██─────██
    ██──────█──────█────█────█─────██─────██
    ███─────██─────█────█────█─────██─────██
    ███─▄▄▄▄███────█───███───█────███▄▄▄▄─██
    ████─▄▄▄▄████────███████────████▄▄▄▄─███
    ████─▄▄▄▄▄▄███████████████████▄▄▄▄▄▄─███
    █████─────────█████████████─────────████
    ██████─────────────███─────────────█████
    ███████────────────███────────────██████
    █████████──────────███──────────████████
    ███████████───────█████───────██████████
    ██████████████────█████────█████████████
    ████████████████████████████████████████
    `;

    originalConsole.log(
      `%c${blackHoleAscii}\n` +
        "%cSingularity Works\n" +
        "%cEngineered with design–level precision.\n" +
        "Built with %c<3%c by the team.",
      s.ascii,
      s.title,
      s.body,
      "color: #EC4899; font-weight: bold; text-shadow: 0 0 5px rgba(236,72,153,0.5);",
      s.body
    );
  }, []);

  return null;
}
