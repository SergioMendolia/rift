import { computed } from "vue";
import { useSettingsStore } from "../stores/settings";
import type { DateFormat } from "@rift/shared";

export function formatRelative(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 0) return d.toLocaleDateString();
  const diffM = diffMs / 60000;
  if (diffM < 1) return "just now";
  if (diffM < 60) return `${Math.floor(diffM)}m ago`;
  const diffH = diffM / 60;
  if (diffH < 1) return `${Math.floor(diffM)}m ago`;
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  const diffDays = diffH / 24;
  if (diffDays < 7) return `${Math.floor(diffDays)}d ago`;
  return d.toLocaleDateString();
}

const FORMAT_OPTIONS: Record<Exclude<DateFormat, "relative" | "iso">, Intl.DateTimeFormatOptions> = {
  short: { year: "2-digit", month: "numeric", day: "numeric" },
  medium: { year: "numeric", month: "short", day: "numeric" },
  long: {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },
};

export function formatDate(dateStr: string, format: DateFormat): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  if (format === "relative") return formatRelative(dateStr);
  if (format === "iso") {
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0") +
      " " +
      String(d.getHours()).padStart(2, "0") +
      ":" +
      String(d.getMinutes()).padStart(2, "0")
    );
  }
  return d.toLocaleString(undefined, FORMAT_OPTIONS[format]);
}

export function useFormatDate() {
  const settings = useSettingsStore();
  const format = computed(() => settings.dateFormat);

  function fmt(dateStr: string): string {
    return formatDate(dateStr, format.value);
  }

  return { formatDate: fmt, format };
}