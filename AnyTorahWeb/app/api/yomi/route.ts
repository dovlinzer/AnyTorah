import { NextResponse } from "next/server";
import { parseCalendarItems, type YomiToday } from "@/lib/yomiService";

const EMPTY: YomiToday = { daf: null, mishnah: null, rambam: null, tanakh929: null, parsha: null };

// Sefaria's calendar rolls over once a day; an hour-old cache is more than fresh enough and
// avoids hitting Sefaria on every page load.
export async function GET() {
  try {
    const res = await fetch("https://www.sefaria.org/api/calendars", { next: { revalidate: 3600 } });
    if (!res.ok) return NextResponse.json(EMPTY);
    const json = await res.json();
    const items = Array.isArray(json.calendar_items) ? json.calendar_items : [];
    return NextResponse.json(parseCalendarItems(items));
  } catch {
    return NextResponse.json(EMPTY);
  }
}
