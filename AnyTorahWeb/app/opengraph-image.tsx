import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "AnyTorah — Browse Tanakh, Mishnah, Talmud, Rambam, and Shulchan Arukh";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Branded share-preview card (iMessage/Slack/Twitter link unfurls) — reuses the native apps'
// actual AppIcon (three colored bars + YCT spiral mark), not the header's wide wordmark lockup,
// since that one isn't square-friendly. Colors match the app's own dark theme (see globals.css).
export default async function Image() {
  const iconData = await readFile(join(process.cwd(), "public/app-icon.png"), "base64");
  const iconSrc = `data:image/png;base64,${iconData}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 48,
          background: "#0f1c47",
        }}
      >
        <img src={iconSrc} alt="" width={220} height={220} style={{ borderRadius: 40 }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 96, fontWeight: 600, color: "#f0cc73", letterSpacing: -2 }}>
            AnyTorah
          </div>
          <div style={{ fontSize: 32, color: "#ffffff", opacity: 0.7, fontStyle: "italic" }}>
            Powered by YCT and Sefaria
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
