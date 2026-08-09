import { NextResponse } from "next/server";
import { type Dedication } from "@/lib/dedicationService";

// Same public Supabase project + anon key as native's DedicationService.swift (already embedded
// client-side in the compiled iOS/Android apps, so not a secret). Fetched server-side, mirroring
// the /api/chapter and /api/dafImage pattern already used elsewhere in this app.
const SUPABASE_URL = "https://zewdazoijdpakugfvnzt.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpld2Rhem9pamRwYWt1Z2Z2bnp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NzIwODYsImV4cCI6MjA5MDA0ODA4Nn0.HJxIG18vEpt-exzoQwRLeXiKLAinWfBl7gMORKjxIz8";

function formatDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function periodPriority(period: string): number {
  switch (period) {
    case "today":
      return 3;
    case "week":
      return 2;
    default:
      return 1;
  }
}

interface Row {
  date: string;
  end_date: string | null;
  dedicated_by: string;
  honoree_name: string | null;
  period: string | null;
  preposition: string | null;
  occasion: string | null;
  display_text: string | null;
  photo_url: string | null;
}

function decode(row: Row): Dedication | null {
  if (!row.date || !row.dedicated_by) return null;
  return {
    date: row.date,
    endDate: row.end_date ?? row.date,
    dedicatedBy: row.dedicated_by,
    honoreeName: row.honoree_name ?? "",
    period: (row.period as Dedication["period"]) ?? "today",
    preposition: row.preposition ?? "",
    occasion: row.occasion ?? "",
    displayText: row.display_text || null,
    photoUrl: row.photo_url || null,
  };
}

// "Active" means today falls in [date, end_date] — checked directly by the query filters below
// rather than fetched broadly and filtered client-side. When more than one dedication is active
// at once (an admin-acknowledged overlap — see dedication-form.html's approval-time warning),
// picks by `period`'s display tier (today > week > month), then most-recently-created.
export async function GET() {
  const todayStr = formatDate(new Date());

  const url =
    `${SUPABASE_URL}/rest/v1/dedications` +
    `?date=lte.${todayStr}` +
    `&end_date=gte.${todayStr}` +
    `&status=eq.approved` +
    `&for_anytorah_web=eq.true` +
    `&select=date,end_date,dedicated_by,honoree_name,period,preposition,occasion,display_text,photo_url` +
    `&order=date.desc,id.desc` +
    `&limit=10`;

  let rows: Row[];
  try {
    const res = await fetch(url, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ dedication: null });
    rows = await res.json();
  } catch {
    return NextResponse.json({ dedication: null });
  }

  const picked = rows
    .map(decode)
    .filter((d): d is Dedication => d !== null)
    .sort((a, b) => periodPriority(b.period) - periodPriority(a.period))[0];

  return NextResponse.json({ dedication: picked ?? null });
}
