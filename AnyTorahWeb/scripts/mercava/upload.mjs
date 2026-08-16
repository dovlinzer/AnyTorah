// Pushes scripts/mercava/output/*.json (written by scrape.mjs) into the `mercava_daf_ids`
// Supabase table — the table the running app actually reads (lib/mercava.ts), not the JSON files
// themselves, which are kept only as a human-diffable local record of each scrape run.
//
// Per-tractate delete-then-insert, one tractate at a time: only tractates present in output/ this
// run are touched, so a tractate that failed to scrape in a given run (seed-click flakiness — see
// scrape.mjs) simply leaves its last-known-good Supabase rows alone instead of being wiped.
//
// Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (service-role: this writes past RLS,
// which only grants public *read*). Reads them from the main app's .env.local by default so local
// runs need no separate setup; CI (.github/workflows/refresh-mercava-ids.yml) sets them directly
// as env vars instead, and .env.local won't exist there, so the load is best-effort.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ENV_LOCAL = new URL("../../.env.local", import.meta.url).pathname;
if (existsSync(ENV_LOCAL)) {
  for (const line of readFileSync(ENV_LOCAL, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const OUT_DIR = new URL("./output/", import.meta.url).pathname;
const files = readdirSync(OUT_DIR).filter((f) => f.endsWith(".json"));

let totalRows = 0;
for (const file of files) {
  const { tractate, amudim } = JSON.parse(readFileSync(`${OUT_DIR}${file}`, "utf8"));
  const rows = Object.entries(amudim).map(([daf_amud, mercava_id]) => ({ tractate, daf_amud, mercava_id }));

  const { error: delErr } = await supabase.from("mercava_daf_ids").delete().eq("tractate", tractate);
  if (delErr) {
    console.error(`[${tractate}] delete failed: ${delErr.message}`);
    continue;
  }
  const { error: insErr } = await supabase.from("mercava_daf_ids").insert(rows);
  if (insErr) {
    console.error(`[${tractate}] insert failed: ${insErr.message}`);
    continue;
  }
  totalRows += rows.length;
  console.log(`[${tractate}] upserted ${rows.length} amudim`);
}

console.log(`Done: ${files.length} tractates, ${totalRows} total rows -> mercava_daf_ids`);
