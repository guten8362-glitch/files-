/**
 * Priority Utility - 7-Level Numeric Priority System
 *
 * Rank  | Issue Type              | Band
 * ------+--------------------------+-----------
 *   1   | No Paper / Error Codes  | Critical (Red)
 *   2   | Service Requested       | Critical (Red)
 *   3   | Printer Jammed          | Warning  (Orange)
 *   4   | Door Opened             | Warning  (Orange)
 *   5   | No Ink / Low Ink        | Info     (Blue)
 *   6   | Printer Offline         | Info     (Blue)
 *   7   | Others / Initializing   | Low      (Green)
 */

export type PriorityColors = {
  bg: string;
  text: string;
  dot: string;
  border: string;
};

export type PriorityBand = "critical" | "warning" | "info" | "low";

export function getPriorityBand(rank: number): PriorityBand {
  if (rank <= 2) return "critical";
  if (rank <= 4) return "warning";
  if (rank <= 6) return "info";
  return "low";
}

export function getPriorityLabel(rank: number): string {
  if (rank <= 2) return `P${rank} · Critical`;
  if (rank <= 4) return `P${rank} · Warning`;
  if (rank <= 6) return `P${rank} · Info`;
  return `P${rank} · Low`;
}

export function getPriorityColors(rank: number): PriorityColors {
  const band = getPriorityBand(rank);
  switch (band) {
    case "critical":
      return { bg: "#fef2f2", text: "#ef4444", dot: "#ef4444", border: "#fecaca" };
    case "warning":
      return { bg: "#fffbeb", text: "#f59e0b", dot: "#f59e0b", border: "#fde68a" };
    case "info":
      return { bg: "#eff6ff", text: "#3b82f6", dot: "#3b82f6", border: "#bfdbfe" };
    case "low":
    default:
      return { bg: "#f0fdf4", text: "#10b981", dot: "#10b981", border: "#bbf7d0" };
  }
}

/** Returns true for ranks 1–3, triggering push notifications on the backend */
export function isHighAlertPriority(rank: number): boolean {
  return rank <= 3;
}
