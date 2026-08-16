// Merges scripts/mercava/output/*.json (one file per tractate, written by scrape.mjs) into the
// single static data file the Next.js app actually reads: lib/data/mercavaDafIds.json, keyed by
// the same tractate name textCatalog.ts's sefariaName/getTalmudSefariaName uses (see
// tractates.mjs's ourName field) so lib/mercava.ts's lookup is a direct key match, no name
// reconciliation needed at runtime.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { TRACTATES } from "./tractates.mjs";

const OUT_DIR = new URL("./output/", import.meta.url).pathname;
const DEST = new URL("../../lib/data/mercavaDafIds.json", import.meta.url).pathname;

const files = readdirSync(OUT_DIR).filter((f) => f.endsWith(".json"));
const merged = {};
let totalAmudim = 0;
const missing = [];

for (const t of TRACTATES) {
  const path = `${OUT_DIR}${t.ourName}.json`;
  if (!files.includes(`${t.ourName}.json`)) {
    missing.push(t.ourName);
    continue;
  }
  const data = JSON.parse(readFileSync(path, "utf8"));
  merged[t.ourName] = data.amudim;
  totalAmudim += Object.keys(data.amudim).length;
}

if (missing.length) {
  console.log(`NOTE: ${missing.length} tractate(s) not yet scraped: ${missing.join(", ")}`);
}

const destDir = new URL("../../lib/data/", import.meta.url).pathname;
if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
writeFileSync(DEST, JSON.stringify(merged, null, 0));
console.log(`Wrote ${Object.keys(merged).length} tractates, ${totalAmudim} total amudim -> ${DEST}`);
