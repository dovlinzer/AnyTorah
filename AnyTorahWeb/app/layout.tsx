import type { Metadata } from "next";
import { Geist, Frank_Ruhl_Libre, Noto_Sans_Hebrew } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Matches the native iOS/Android apps' Hebrew serif (Frank Ruhl Libre) —
// see AnyTorah/CLAUDE.md gotcha #12 on why a custom Hebrew font matters here.
const frankRuhlLibre = Frank_Ruhl_Libre({
  variable: "--font-hebrew",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700"],
});

// Second Hebrew typeface, used only for SA inline commentary-marker brackets — a sans-serif
// contrast to Frank Ruhl Libre so each commentator's slot (font + size + bracket shape) reads
// as visually distinct at a glance, not just by the bracket character.
const notoSansHebrew = Noto_Sans_Hebrew({
  variable: "--font-hebrew-sans",
  subsets: ["hebrew", "latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "AnyTorah",
  description: "Browse Tanakh, Mishnah, Talmud, Rambam, and Shulchan Arukh with classical commentaries.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${frankRuhlLibre.variable} ${notoSansHebrew.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
