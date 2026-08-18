import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ConsoleBranding } from "../components/dev/console-branding";
import { NativeTitlebar } from "../components/native-titlebar";
import { UmamiAnalytics } from "../components/umami-analytics";
import { AppProviders } from "./providers/app-providers";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const APP_NAME = "Lumen";
const APP_DESCRIPTION = "Shedding light on the singularity";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: "Lumen — Work, illuminated",
    template: "%s — Lumen",
  },
  description: APP_DESCRIPTION,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: {
      default: APP_NAME,
      template: "%s — Lumen",
    },
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0c" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${manrope.variable} ${manrope.className} bg-background font-sans text-foreground`}
      >
        <NativeTitlebar />
        <ConsoleBranding />
        <AppProviders>{children}</AppProviders>
        <Analytics />
        <SpeedInsights />
        <UmamiAnalytics />
      </body>
    </html>
  );
}
