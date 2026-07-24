// Shared types + pure formatting helpers for the daily learning dedication banner, ported from
// native's Dedication struct (AnyTorah/API/DedicationService.swift). The actual Supabase fetch
// lives server-side in app/api/dedication/route.ts (see that file for why).

export interface Dedication {
  date: string; // yyyy-MM-dd
  dedicatedBy: string;
  honoreeName: string;
  period: "today" | "week" | "month";
  preposition: string;
  occasion: string;
  displayText: string | null;
  photoUrl: string | null;
}

export function periodTitle(period: Dedication["period"]): string {
  switch (period) {
    case "week":
      return "This Week's Learning";
    case "month":
      return "This Month's Learning";
    default:
      return "Today's Learning";
  }
}

export function formattedMessage(d: Dedication): string {
  if (d.displayText) return d.displayText;
  const periodPhrase =
    d.period === "week" ? "This week's learning" : d.period === "month" ? "This month's learning" : "Today's learning";
  const parts = [`${periodPhrase} with AnyTorah is dedicated by ${d.dedicatedBy}`];
  if (d.preposition) parts.push(d.preposition);
  if (d.honoreeName) parts.push(d.honoreeName);
  if (d.occasion) parts.push(d.occasion);
  return parts.join(" ") + ".";
}
