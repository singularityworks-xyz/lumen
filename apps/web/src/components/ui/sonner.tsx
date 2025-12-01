"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-2xl group-[.toaster]:border-2 group-[.toaster]:border-border/50 group-[.toaster]:bg-card/95 group-[.toaster]:backdrop-blur-md group-[.toaster]:px-4 group-[.toaster]:py-3 group-[.toaster]:shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] dark:group-[.toaster]:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]",
          title: "group-[.toast]:text-foreground group-[.toast]:font-medium group-[.toast]:text-sm",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-xs",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg group-[.toast]:shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)]",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg",
          success:
            "group-[.toaster]:text-foreground [&>svg]:text-primary",
          error:
            "group-[.toaster]:text-foreground [&>svg]:text-destructive",
          warning:
            "group-[.toaster]:text-foreground [&>svg]:text-amber-500",
          info: "group-[.toaster]:text-foreground [&>svg]:text-blue-500",
        },
      }}
      style={
        {
          "--normal-bg": "transparent",
          "--normal-border": "transparent",
          "--normal-text": "var(--card-foreground)",
          "--success-bg": "transparent",
          "--success-border": "transparent",
          "--success-text": "var(--card-foreground)",
          "--error-bg": "transparent",
          "--error-border": "transparent",
          "--error-text": "var(--card-foreground)",
          "--warning-bg": "transparent",
          "--warning-border": "transparent",
          "--warning-text": "var(--card-foreground)",
          "--info-bg": "transparent",
          "--info-border": "transparent",
          "--info-text": "var(--card-foreground)",
          "--width": "360px",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
