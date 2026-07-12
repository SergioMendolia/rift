import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { formatDate, formatRelative } from "../src/composables/useFormatDate";

beforeEach(() => {
  setActivePinia(createPinia());
});

describe("formatRelative", () => {
  it("returns 'just now' for recent dates", () => {
    const now = new Date().toISOString();
    expect(formatRelative(now)).toBe("just now");
  });

  it("returns minutes ago", () => {
    const d = new Date(Date.now() - 5 * 60000).toISOString();
    expect(formatRelative(d)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    const d = new Date(Date.now() - 3 * 3600000).toISOString();
    expect(formatRelative(d)).toBe("3h ago");
  });

  it("returns days ago", () => {
    const d = new Date(Date.now() - 2 * 86400000).toISOString();
    expect(formatRelative(d)).toBe("2d ago");
  });
});

describe("formatDate", () => {
  const dateStr = "2026-07-04T15:30:00Z";

  it("relative format delegates to formatRelative", () => {
    const now = new Date().toISOString();
    expect(formatDate(now, "relative")).toBe(formatRelative(now));
  });

  it("iso format produces YYYY-MM-DD HH:MM", () => {
    const result = formatDate(dateStr, "iso");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it("short format produces a string with year digits", () => {
    const result = formatDate(dateStr, "short");
    expect(result).toContain("26");
  });

  it("medium format produces a month abbreviation", () => {
    const result = formatDate(dateStr, "medium");
    expect(result).toMatch(/Jul/);
  });

  it("long format includes time", () => {
    const result = formatDate(dateStr, "long");
    expect(result.length).toBeGreaterThan(10);
    expect(result).toMatch(/July/);
  });

  it("returns empty string for invalid dates", () => {
    expect(formatDate("not-a-date", "iso")).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(formatDate("", "relative")).toBe("");
  });
});