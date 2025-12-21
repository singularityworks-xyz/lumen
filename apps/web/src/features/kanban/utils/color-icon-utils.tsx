"use client";

import {
  AlertCircle,
  Archive,
  ArrowRight,
  Beaker,
  Bell,
  Bookmark,
  BookOpen,
  Box,
  Bug,
  Calendar,
  Check,
  CheckCircle,
  Circle,
  Clock,
  Code,
  Coffee,
  Cog,
  Compass,
  Database,
  Eye,
  FileText,
  Filter,
  Flag,
  Flame,
  Folder,
  FolderOpen,
  Gift,
  Globe,
  Heart,
  Home,
  Inbox,
  Info,
  Layers,
  Layout,
  Lightbulb,
  Link,
  List,
  Lock,
  type LucideIcon,
  Mail,
  MapIcon,
  MessageCircle,
  MessageSquare,
  Minus,
  Moon,
  MoreHorizontal,
  Package,
  Pause,
  Pencil,
  Play,
  Plus,
  Rocket,
  Search,
  Send,
  Settings,
  Shield,
  ShoppingCart,
  Sparkles,
  Star,
  Sun,
  Tag,
  Target,
  Terminal,
  ThumbsUp,
  Timer,
  Trash,
  TrendingUp,
  Trophy,
  Truck,
  Upload,
  User,
  Users,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { cn } from "@/src/lib/utils";

export const ACCENT_COLORS = [
  { name: "None", value: "", class: "bg-muted-foreground/30" },
  { name: "Rose", value: "#f43f5e", class: "bg-rose-500" },
  { name: "Red", value: "#ef4444", class: "bg-red-500" },
  { name: "Orange", value: "#f97316", class: "bg-orange-500" },
  { name: "Amber", value: "#f59e0b", class: "bg-amber-500" },
  { name: "Yellow", value: "#eab308", class: "bg-yellow-500" },
  { name: "Lime", value: "#84cc16", class: "bg-lime-500" },
  { name: "Green", value: "#22c55e", class: "bg-green-500" },
  { name: "Emerald", value: "#10b981", class: "bg-emerald-500" },
  { name: "Teal", value: "#14b8a6", class: "bg-teal-500" },
  { name: "Cyan", value: "#06b6d4", class: "bg-cyan-500" },
  { name: "Sky", value: "#0ea5e9", class: "bg-sky-500" },
  { name: "Blue", value: "#3b82f6", class: "bg-blue-500" },
  { name: "Indigo", value: "#6366f1", class: "bg-indigo-500" },
  { name: "Violet", value: "#8b5cf6", class: "bg-violet-500" },
  { name: "Purple", value: "#a855f7", class: "bg-purple-500" },
  { name: "Fuchsia", value: "#d946ef", class: "bg-fuchsia-500" },
  { name: "Pink", value: "#ec4899", class: "bg-pink-500" },
] as const;

export type AccentColor = (typeof ACCENT_COLORS)[number];

export const COLUMN_ICONS: { name: string; value: string; Icon: LucideIcon }[] =
  [
    { name: "None", value: "", Icon: Circle },
    // Status & Progress
    { name: "Star", value: "star", Icon: Star },
    { name: "Flag", value: "flag", Icon: Flag },
    { name: "Target", value: "target", Icon: Target },
    { name: "CheckCircle", value: "check-circle", Icon: CheckCircle },
    { name: "Check", value: "check", Icon: Check },
    { name: "AlertCircle", value: "alert-circle", Icon: AlertCircle },
    { name: "Info", value: "info", Icon: Info },
    { name: "Pause", value: "pause", Icon: Pause },
    { name: "Play", value: "play", Icon: Play },
    // Energy & Action
    { name: "Rocket", value: "rocket", Icon: Rocket },
    { name: "Zap", value: "zap", Icon: Zap },
    { name: "Flame", value: "flame", Icon: Flame },
    { name: "Sparkles", value: "sparkles", Icon: Sparkles },
    { name: "TrendingUp", value: "trending-up", Icon: TrendingUp },
    { name: "Trophy", value: "trophy", Icon: Trophy },
    // Ideas & Creation
    { name: "Lightbulb", value: "lightbulb", Icon: Lightbulb },
    { name: "Pencil", value: "pencil", Icon: Pencil },
    { name: "Beaker", value: "beaker", Icon: Beaker },
    // Development
    { name: "Bug", value: "bug", Icon: Bug },
    { name: "Code", value: "code", Icon: Code },
    { name: "Terminal", value: "terminal", Icon: Terminal },
    { name: "Wrench", value: "wrench", Icon: Wrench },
    { name: "Cog", value: "cog", Icon: Cog },
    { name: "Settings", value: "settings", Icon: Settings },
    { name: "Database", value: "database", Icon: Database },
    // Documents & Files
    { name: "FileText", value: "file-text", Icon: FileText },
    { name: "BookOpen", value: "book-open", Icon: BookOpen },
    { name: "Folder", value: "folder", Icon: Folder },
    { name: "FolderOpen", value: "folder-open", Icon: FolderOpen },
    { name: "Archive", value: "archive", Icon: Archive },
    { name: "Inbox", value: "inbox", Icon: Inbox },
    { name: "Layers", value: "layers", Icon: Layers },
    // Communication
    { name: "MessageSquare", value: "message-square", Icon: MessageSquare },
    { name: "MessageCircle", value: "message-circle", Icon: MessageCircle },
    { name: "Mail", value: "mail", Icon: Mail },
    { name: "Send", value: "send", Icon: Send },
    { name: "Bell", value: "bell", Icon: Bell },
    // Time & Calendar
    { name: "Clock", value: "clock", Icon: Clock },
    { name: "Timer", value: "timer", Icon: Timer },
    { name: "Calendar", value: "calendar", Icon: Calendar },
    // People & Teams
    { name: "User", value: "user", Icon: User },
    { name: "Users", value: "users", Icon: Users },
    { name: "ThumbsUp", value: "thumbs-up", Icon: ThumbsUp },
    { name: "Heart", value: "heart", Icon: Heart },
    // Navigation & Location
    { name: "Home", value: "home", Icon: Home },
    { name: "Compass", value: "compass", Icon: Compass },
    { name: "Map", value: "map", Icon: MapIcon },
    { name: "Globe", value: "globe", Icon: Globe },
    { name: "ArrowRight", value: "arrow-right", Icon: ArrowRight },
    // Objects
    { name: "Gift", value: "gift", Icon: Gift },
    { name: "Coffee", value: "coffee", Icon: Coffee },
    { name: "Package", value: "package", Icon: Package },
    { name: "Box", value: "box", Icon: Box },
    { name: "ShoppingCart", value: "shopping-cart", Icon: ShoppingCart },
    { name: "Truck", value: "truck", Icon: Truck },
    // Misc
    { name: "Tag", value: "tag", Icon: Tag },
    { name: "Bookmark", value: "bookmark", Icon: Bookmark },
    { name: "Link", value: "link", Icon: Link },
    { name: "Eye", value: "eye", Icon: Eye },
    { name: "Lock", value: "lock", Icon: Lock },
    { name: "Shield", value: "shield", Icon: Shield },
    { name: "Search", value: "search", Icon: Search },
    { name: "Filter", value: "filter", Icon: Filter },
    { name: "List", value: "list", Icon: List },
    { name: "Layout", value: "layout", Icon: Layout },
    { name: "Sun", value: "sun", Icon: Sun },
    { name: "Moon", value: "moon", Icon: Moon },
    { name: "Upload", value: "upload", Icon: Upload },
    { name: "Plus", value: "plus", Icon: Plus },
    { name: "Minus", value: "minus", Icon: Minus },
    { name: "X", value: "x", Icon: X },
    { name: "MoreHorizontal", value: "more-horizontal", Icon: MoreHorizontal },
    { name: "Trash", value: "trash", Icon: Trash },
  ];

export const ICON_MAP: Record<string, LucideIcon> = COLUMN_ICONS.reduce(
  (acc, icon) => {
    if (icon.value) {
      acc[icon.value] = icon.Icon;
    }
    return acc;
  },
  {} as Record<string, LucideIcon>
);

export function getAccentColor(
  value: string | undefined
): AccentColor | undefined {
  if (!value) {
    return;
  }
  return ACCENT_COLORS.find((c) => c.value === value);
}

export function getIconComponent(value: string | undefined): LucideIcon | null {
  if (!value) {
    return null;
  }
  return ICON_MAP[value] ?? null;
}

const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
export function isValidHexColor(color: string): boolean {
  return HEX_COLOR_REGEX.test(color);
}

type ColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
  customColors?: string[];
  onAddCustomColor?: (color: string) => void;
  className?: string;
};

export function ColorPicker({
  value,
  onChange,
  customColors = [],
  onAddCustomColor,
  className,
}: ColorPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerColor, setPickerColor] = useState(value || "#3b82f6");

  const handleAddCustomColor = useCallback(() => {
    if (isValidHexColor(pickerColor) && onAddCustomColor) {
      onAddCustomColor(pickerColor);
      onChange(pickerColor);
      setShowPicker(false);
    }
  }, [pickerColor, onAddCustomColor, onChange]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-1">
        {ACCENT_COLORS.map((color) => (
          <button
            className={cn(
              "h-5 w-5 rounded-full transition-all hover:scale-110",
              color.class,
              value === color.value &&
                "ring-2 ring-foreground/50 ring-offset-1 ring-offset-background"
            )}
            key={color.value}
            onClick={() => onChange(color.value)}
            title={color.name}
            type="button"
          />
        ))}
        {customColors.map((color) => (
          <button
            className={cn(
              "h-5 w-5 rounded-full transition-all hover:scale-110",
              value === color &&
                "ring-2 ring-foreground/50 ring-offset-1 ring-offset-background"
            )}
            key={color}
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            title={color}
            type="button"
          />
        ))}
        {onAddCustomColor && (
          <button
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full border border-border border-dashed transition-all hover:border-primary hover:bg-primary/10",
              showPicker && "border-primary bg-primary/10"
            )}
            onClick={() => setShowPicker(!showPicker)}
            title="Add custom color"
            type="button"
          >
            <Plus className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>

      {showPicker && (
        <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
          <HexColorPicker
            color={pickerColor}
            onChange={setPickerColor}
            style={{ width: "100%" }}
          />
          <div className="mt-2 flex items-center gap-2">
            <div
              className="h-6 w-6 rounded border border-border"
              style={{ backgroundColor: pickerColor }}
            />
            <input
              className="flex-1 rounded border border-border bg-muted px-2 py-1 font-mono text-xs"
              maxLength={7}
              onChange={(e) => {
                const val = e.target.value;
                if (val.startsWith("#") || val === "") {
                  setPickerColor(val || "#");
                }
              }}
              placeholder="#000000"
              type="text"
              value={pickerColor}
            />
            <button
              className="rounded bg-primary px-2 py-1 text-primary-foreground text-xs transition-colors hover:bg-primary/90 disabled:opacity-50"
              disabled={!isValidHexColor(pickerColor)}
              onClick={handleAddCustomColor}
              type="button"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type IconPickerProps = {
  value: string;
  onChange: (icon: string) => void;
  accentColor?: string;
  className?: string;
};

export function IconPicker({
  value,
  onChange,
  accentColor,
  className,
}: IconPickerProps) {
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {COLUMN_ICONS.map((icon) => (
        <button
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded transition-all hover:bg-muted",
            value === icon.value &&
              "bg-primary/20 text-primary ring-1 ring-primary/30"
          )}
          key={icon.value}
          onClick={() => onChange(icon.value)}
          title={icon.name}
          type="button"
        >
          <icon.Icon
            className="h-3.5 w-3.5"
            style={
              value === icon.value && accentColor
                ? { color: accentColor }
                : undefined
            }
          />
        </button>
      ))}
    </div>
  );
}

export const DEFAULT_TOP_COLORS = ACCENT_COLORS.slice(0, 11);
export const DEFAULT_TOP_ICONS = COLUMN_ICONS.slice(0, 11);

export function getTopColors(
  usage: Record<string, number> | undefined,
  count = 10
): AccentColor[] {
  const noneColor = ACCENT_COLORS.find((c) => c.value === "");
  const result: AccentColor[] = noneColor ? [noneColor] : [];

  const usedColors = usage
    ? Object.entries(usage)
        .sort((a, b) => b[1] - a[1])
        .map(([value]) => ACCENT_COLORS.find((c) => c.value === value))
        .filter((c): c is AccentColor => c !== undefined && c.value !== "")
    : [];

  for (const color of usedColors) {
    if (result.length >= count + 1) {
      break;
    }
    if (!result.some((c) => c.value === color.value)) {
      result.push(color);
    }
  }

  for (const color of ACCENT_COLORS.slice(1)) {
    if (result.length >= count + 1) {
      break;
    }
    if (!result.some((c) => c.value === color.value)) {
      result.push(color);
    }
  }

  return result;
}

export function getTopIcons(
  usage: Record<string, number> | undefined,
  count = 10
): typeof COLUMN_ICONS {
  const noneIcon = COLUMN_ICONS.find((i) => i.value === "");
  const result: (typeof COLUMN_ICONS)[number][] = noneIcon ? [noneIcon] : [];

  const usedIcons = usage
    ? Object.entries(usage)
        .sort((a, b) => b[1] - a[1])
        .map(([value]) => COLUMN_ICONS.find((i) => i.value === value))
        .filter(
          (i): i is (typeof COLUMN_ICONS)[number] =>
            i !== undefined && i.value !== ""
        )
    : [];

  for (const icon of usedIcons) {
    if (result.length >= count + 1) {
      break;
    }
    if (!result.some((i) => i.value === icon.value)) {
      result.push(icon);
    }
  }

  for (const icon of COLUMN_ICONS.slice(1)) {
    if (result.length >= count + 1) {
      break;
    }
    if (!result.some((i) => i.value === icon.value)) {
      result.push(icon);
    }
  }

  return result;
}

export function incrementColorUsage(
  currentUsage: Record<string, number> | undefined,
  color: string
): Record<string, number> {
  if (!color) {
    return currentUsage ?? {};
  }
  return {
    ...(currentUsage ?? {}),
    [color]: (currentUsage?.[color] ?? 0) + 1,
  };
}

export function incrementIconUsage(
  currentUsage: Record<string, number> | undefined,
  icon: string
): Record<string, number> {
  if (!icon) {
    return currentUsage ?? {};
  }
  return {
    ...(currentUsage ?? {}),
    [icon]: (currentUsage?.[icon] ?? 0) + 1,
  };
}

type QuickColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
  colorUsage?: Record<string, number>;
  onMoreClick?: () => void;
  className?: string;
};

export function QuickColorPicker({
  value,
  onChange,
  colorUsage,
  onMoreClick,
  className,
}: QuickColorPickerProps) {
  const topColors = getTopColors(colorUsage, 10);

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {topColors.map((color) => (
        <button
          className={cn(
            "h-5 w-5 rounded-full transition-all hover:scale-110",
            color.class,
            value === color.value &&
              "ring-2 ring-foreground/50 ring-offset-1 ring-offset-background"
          )}
          key={color.value}
          onClick={() => onChange(color.value)}
          title={color.name}
          type="button"
        />
      ))}
      {onMoreClick && (
        <button
          className="flex h-5 items-center justify-center rounded-full border border-border border-dashed px-1.5 text-[9px] text-muted-foreground transition-all hover:border-primary hover:bg-primary/10 hover:text-primary"
          onClick={onMoreClick}
          title="More colors..."
          type="button"
        >
          <MoreHorizontal className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

type QuickIconPickerProps = {
  value: string;
  onChange: (icon: string) => void;
  iconUsage?: Record<string, number>;
  accentColor?: string;
  onMoreClick?: () => void;
  className?: string;
};

export function QuickIconPicker({
  value,
  onChange,
  iconUsage,
  accentColor,
  onMoreClick,
  className,
}: QuickIconPickerProps) {
  const topIcons = getTopIcons(iconUsage, 10);

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {topIcons.map((icon) => (
        <button
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded transition-all hover:bg-muted",
            value === icon.value &&
              "bg-primary/20 text-primary ring-1 ring-primary/30"
          )}
          key={icon.value}
          onClick={() => onChange(icon.value)}
          title={icon.name}
          type="button"
        >
          <icon.Icon
            className="h-3.5 w-3.5"
            style={
              value === icon.value && accentColor
                ? { color: accentColor }
                : undefined
            }
          />
        </button>
      ))}
      {onMoreClick && (
        <button
          className="flex h-6 items-center justify-center rounded border border-border border-dashed px-1.5 text-[9px] text-muted-foreground transition-all hover:border-primary hover:bg-primary/10 hover:text-primary"
          onClick={onMoreClick}
          title="More icons..."
          type="button"
        >
          <MoreHorizontal className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
