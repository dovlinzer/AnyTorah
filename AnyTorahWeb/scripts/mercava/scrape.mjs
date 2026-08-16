// One-time data-collection script: builds a (tractate, daf, amud) -> Mercava internal page id
// table by walking themercava.com/app's own metanav/frameless API.
//
// Not part of the shipped app — output is a static JSON file the Next.js app reads.
//
// How this works: every metanav/frameless response (the API behind each daf/amud page) includes
// `nextPageId` and `seqNum` (e.g. "3a", "3b") directly — confirmed live by capturing full
// (untruncated) response bodies. So there is no need to guess an id formula or click through the
// picker's grid tiles one by one: get a single seed id per tractate (its own "2a", found via one
// UI click into that tractate's picker — this part of the UI is reliable; it's re-clicking many
// *different* tiles across full page reloads that proved flaky and was abandoned), then simply
// follow nextPageId links to the tractate's end. This is both simpler AND more accurate than an
// id-formula/sampling approach — confirmed live on Eiruvin (207 amudim) that the local "+4 per
// amud" pattern actually has a single silent 1-unit deviation partway through, which a sparse
// sampling+interpolation approach could easily have missed but an exhaustive walk catches for
// free, since every id comes directly from the server, never computed.
import { chromium } from "playwright";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { TRACTATES } from "./tractates.mjs";

const OUT_DIR = new URL("./output/", import.meta.url).pathname;
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const WALK_DELAY_MS = 120; // politeness pacing between sequential page fetches
const onlyTractate = process.argv[2]; // optional: node scrape.mjs Eruvin

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Finds the leaf DOM element whose exact text is `label` and returns its center coordinates —
// a real coordinate-based mouse click (rather than Playwright's locator/actionability APIs,
// which proved unreliable against this app's custom rendering) matches what was confirmed to
// work manually.
async function findAndCenterTile(page, label) {
  return page.evaluate((label) => {
    const all = document.querySelectorAll("body *");
    for (const el of all) {
      if (el.children.length > 0) continue;
      if (el.getClientRects().length === 0) continue;
      const t = (el.textContent || "").trim();
      if (t === label) {
        el.scrollIntoView({ block: "center", inline: "center" });
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }
    }
    return null;
  }, label);
}

// Gets the seed id (the tractate's own first daf/amud, e.g. "2a") by driving the real picker UI
// once: hamburger icon -> Talmud tab -> (climb to Seder list via breadcrumb if needed) ->
// tractate name -> click its first tile. Viewport is pinned to 800x450 because Mercava renders a
// materially different (and for our purposes, non-working) layout at wider/desktop viewports —
// confirmed live, no hamburger icon at the same coordinate at 1280x720.
async function getSeedId(page, tractate) {
  await page.goto("https://www.themercava.com/app/books/metanav/3427", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2200);
  await page.mouse.click(16, 15);
  await page.waitForTimeout(1000);

  const talmudTab = page.locator('text="Talmud" >> visible=true').first();
  await talmudTab.click({ timeout: 5000, force: true }).catch(() => {});
  await page.waitForTimeout(700);

  const breadcrumb = page.locator('text="Talmud Bavli" >> visible=true').first();
  if (await breadcrumb.isVisible().catch(() => false)) {
    await breadcrumb.click({ force: true });
    await page.waitForTimeout(700);
  }

  const tractateLink = page.locator(`text="${tractate.mercavaName}" >> visible=true`).first();
  await tractateLink.click({ timeout: 8000, force: true });
  await page.waitForTimeout(1200);

  const firstLabel = `${tractate.startDaf}a`;
  const seen = [];
  const onReq = (req) => {
    if (req.method() === "POST" && req.url().includes("torah/metanav/frameless")) {
      const body = req.postData() || "";
      const m = body.match(/(?:^|&)id=(\d+)/);
      if (m) seen.push(parseInt(m[1], 10));
    }
  };
  page.on("request", onReq);
  try {
    const center = await findAndCenterTile(page, firstLabel);
    if (!center) return null;
    await page.waitForTimeout(150);
    await page.mouse.click(center.x, center.y);
    await page.waitForTimeout(1200);
  } finally {
    page.off("request", onReq);
  }
  if (seen.length === 0) return null;
  // The clicked tile's own id — for the very first daf there's no "previous" neighbor to
  // prefetch, so this is usually the smallest (or only) id seen; take the min to be safe.
  return Math.min(...seen);
}

async function walkForward(page, seedId, log) {
  const result = {};
  let currentId = seedId;
  let steps = 0;
  while (currentId != null) {
    const data = await page.evaluate(async (id) => {
      const res = await fetch("https://www.themercava.com/torah/metanav/frameless", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `parentType=metanav&id=${id}&lang=en`,
        credentials: "include",
      });
      const d = await res.json();
      return { seqNum: d.seqNum, serverNodeId: d.serverNodeId, nextPageId: d.nextPageId, title_en: d.title_en };
    }, currentId);

    if (!data.seqNum || !data.serverNodeId) {
      log(`  WARNING: malformed response at id ${currentId}: ${JSON.stringify(data)}`);
      break;
    }
    result[data.seqNum] = parseInt(data.serverNodeId, 10);
    steps++;
    if (steps % 25 === 0) log(`  ...${steps} pages walked, at ${data.seqNum}`);

    currentId = data.nextPageId ? parseInt(data.nextPageId, 10) : null;
    await sleep(WALK_DELAY_MS);
  }
  return result;
}

async function scrapeTractate(page, tractate) {
  const log = (msg) => console.log(`[${tractate.ourName}] ${msg}`);
  log(`getting seed id (Mercava name: "${tractate.mercavaName}")...`);
  const seedId = await getSeedId(page, tractate);
  if (seedId == null) {
    log("ERROR: could not resolve seed id. Skipping.");
    return null;
  }
  log(`seed ${tractate.startDaf}a -> ${seedId}, walking forward...`);
  const amudim = await walkForward(page, seedId, log);
  const count = Object.keys(amudim).length;
  log(`walked ${count} amudim, last: ${Object.keys(amudim).slice(-1)[0]}`);
  return { tractate: tractate.ourName, mercavaName: tractate.mercavaName, amudim };
}

async function main() {
  const targets = onlyTractate
    ? TRACTATES.filter((t) => t.ourName === onlyTractate)
    : TRACTATES;
  if (targets.length === 0) {
    console.error(`No tractate matching "${onlyTractate}"`);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });

  for (const tractate of targets) {
    const outPath = `${OUT_DIR}${tractate.ourName}.json`;
    if (existsSync(outPath)) {
      console.log(`[${tractate.ourName}] already scraped, skipping (delete ${outPath} to redo)`);
      continue;
    }
    try {
      const data = await scrapeTractate(page, tractate);
      if (data) {
        writeFileSync(outPath, JSON.stringify(data, null, 2));
        console.log(`[${tractate.ourName}] saved ${Object.keys(data.amudim).length} amudim -> ${outPath}`);
      }
    } catch (err) {
      console.error(`[${tractate.ourName}] FAILED: ${err.message}`);
    }
  }

  await browser.close();
}

main();
