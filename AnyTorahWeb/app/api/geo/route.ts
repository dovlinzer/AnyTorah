import { NextRequest, NextResponse } from "next/server";

// Vercel's edge network stamps every request with the visitor's ISO 3166-1 alpha-2 country code
// in this header (no geolocation permission prompt, no third-party lookup). Only present when
// actually served through Vercel's network — local dev and other hosts just get null, which the
// client treats as "unknown" and leaves the existing LTR/English default alone.
export async function GET(request: NextRequest) {
  const country = request.headers.get("x-vercel-ip-country");
  return NextResponse.json({ country });
}
