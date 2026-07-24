import { NextRequest, NextResponse } from "next/server";

// Proxies the dedication photo server-side with the anon key as bearer auth, mirroring native's
// SupabaseStorageImage (DedicationBannerView.swift) — the storage bucket isn't fetchable
// anonymously via the plain "public" URL, so this converts it to the authenticated object
// endpoint and attaches the same headers, same as native does.
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpld2Rhem9pamRwYWt1Z2Z2bnp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NzIwODYsImV4cCI6MjA5MDA0ODA4Nn0.HJxIG18vEpt-exzoQwRLeXiKLAinWfBl7gMORKjxIz8";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  if (!path) return NextResponse.json({ error: "Missing path" }, { status: 400 });

  const authedUrl = path.replace("/storage/v1/object/public/", "/storage/v1/object/");

  let upstream: Response;
  try {
    upstream = await fetch(authedUrl, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
  } catch {
    return NextResponse.json({ error: "Image unavailable" }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Image unavailable" }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
