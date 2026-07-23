import { NextRequest, NextResponse } from "next/server";

// Proxies Google Drive's thumbnail endpoint server-side rather than pointing <img> at it
// directly. Loading the Drive URL straight from the browser was failing far more often than
// the native app's experience (which hits Drive from a bare URLSession request, no browser
// context at all) — the likely cause is the browser's own Google account cookies/session
// interfering with an anonymous "anyone with the link" thumbnail request. A server-side fetch
// carries none of that, so it should behave like the native app's request rather than the
// user's browser's.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1600`, {
      headers: {
        // Some Drive endpoints treat obviously non-browser User-Agents differently; send a
        // realistic one rather than Node's default `undici`.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
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
      // Immutable — a given Drive file ID always points at the same scanned page.
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
}
