#!/usr/bin/env node
// Scrapes the BGG legacy search results table (#collectionitems) for every
// board-game catalog item and stores the direct link to the result with the
// most recent published year. Uses curl.exe because the corporate proxy
// blocks Node fetch towards boardgamegeek.com but lets curl through.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), "..");
const OUT = resolve(ROOT, "src/data/bgg.json");

const BOARDGAME_CATEGORY = "GIOCHI DA TAVOLO";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function searchUrl(name) {
  return (
    "https://boardgamegeek.com/geeksearch.php?action=search&objecttype=boardgame&q=" +
    encodeURIComponent(name)
  );
}

// Fetches the page, returning { code, html }. BGG throttles bursts with
// HTTP 403/429, so the caller retries those with backoff.
async function fetchOnce(url) {
  const { stdout } = await execFileP(
    "curl.exe",
    [
      "-s",
      "-L",
      "--compressed",
      "--max-time",
      "30",
      "-A",
      UA,
      "-H",
      "Accept-Language: it-IT,it;q=0.9,en;q=0.8",
      "-H",
      "Referer: https://boardgamegeek.com/",
      "-w",
      "\n__HTTP__%{http_code}",
      url,
    ],
    { maxBuffer: 32 * 1024 * 1024 },
  );
  const i = stdout.lastIndexOf("\n__HTTP__");
  if (i === -1) return { code: 0, html: stdout };
  return {
    code: Number(stdout.slice(i + 9).trim()) || 0,
    html: stdout.slice(0, i),
  };
}

async function fetchHtml(url) {
  const backoff = [8000, 16000, 30000];
  for (let attempt = 0; attempt <= backoff.length; attempt++) {
    const { code, html } = await fetchOnce(url);
    const blocked = code === 403 || code === 429 || (code >= 500 && code < 600);
    if (!blocked) return html;
    if (attempt === backoff.length) {
      throw new Error(`blocked HTTP ${code}`);
    }
    process.stdout.write(`(HTTP ${code}, retry in ${backoff[attempt] / 1000}s) `);
    await sleep(backoff[attempt]);
  }
  return "";
}

// Strips Italian helper suffixes so a second search can still match.
function cleanTitle(name) {
  return name
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s[-–—]\s.*$/g, " ")
    .replace(/\b(versione|edizione)\b.*$/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
function norm(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Returns { id, name, year }. Prefers results whose name exactly matches the
// catalog title (then most recent year among them, to catch reprints/new
// editions); otherwise falls back to the most recent year overall.
function parseResults(html, queryName) {
  const m = html.match(/id=['"]collectionitems['"]/);
  if (!m) {
    const canon = html.match(
      /<link rel="canonical" href="https:\/\/boardgamegeek\.com\/boardgame\/(\d+)\/[^"]*"/i,
    );
    if (canon) return { id: Number(canon[1]), name: "", year: null };
    return null;
  }
  const start = m.index;
  const end = html.indexOf("</table>", start);
  const slice = html.slice(start, end === -1 ? undefined : end);

  const anchor =
    /href="\/boardgame\/(\d+)\/[^"]*"\s+class='primary'\s*>([^<]+)<\/a>/g;
  const candidates = [];
  let a;
  while ((a = anchor.exec(slice)) !== null) {
    const id = Number(a[1]);
    const name = a[2].trim();
    const after = slice.slice(a.index, a.index + 400);
    const y = after.match(/smallerfont dull'>\((\d{4})\)/);
    candidates.push({ id, name, year: y ? Number(y[1]) : null });
  }
  if (candidates.length === 0) return null;

  const byYearDesc = (x, y) => (y.year ?? -Infinity) - (x.year ?? -Infinity);
  const q = norm(queryName);
  const exact = candidates.filter((c) => norm(c.name) === q);
  const pool = exact.length > 0 ? exact : candidates;
  pool.sort(byYearDesc);
  return pool[0];
}

async function main() {
  const items = JSON.parse(
    await readFile(resolve(ROOT, "src/data/items.json"), "utf8"),
  );
  let prev = {};
  try {
    const json = JSON.parse(await readFile(OUT, "utf8"));
    prev = json.games ?? {};
  } catch {
    // ok
  }

  const force = process.argv.includes("--force");
  const games = force ? {} : { ...prev };
  let added = 0;
  let skipped = 0;
  let notFound = 0;
  let failed = 0;
  let nonBoardgame = 0;

  const targets = items.filter(
    (it) => it?.category?.name === BOARDGAME_CATEGORY,
  );
  nonBoardgame = items.length - targets.length;

  for (let i = 0; i < targets.length; i++) {
    const it = targets[i];
    const idStr = String(it.id);
    if (!force && games[idStr]) {
      skipped += 1;
      continue;
    }
    process.stdout.write(
      `[${String(i + 1).padStart(3)}/${targets.length}] ${it.name} … `,
    );
    try {
      let hit = parseResults(
        await fetchHtml(searchUrl(it.name)),
        it.name,
      );
      const cleaned = cleanTitle(it.name);
      if ((!hit || !Number.isFinite(hit.id)) && cleaned && cleaned !== it.name) {
        await sleep(1200);
        hit = parseResults(await fetchHtml(searchUrl(cleaned)), cleaned);
      }
      if (hit && Number.isFinite(hit.id)) {
        games[idStr] = {
          bggId: hit.id,
          bggName: hit.name,
          year: hit.year,
          type: "boardgame",
          source: "scrape",
        };
        console.log(`#${hit.id} ${hit.name || ""} (${hit.year ?? "?"})`);
        added += 1;
      } else {
        console.log("not found");
        notFound += 1;
      }
    } catch (err) {
      console.log(`error: ${err.message}`);
      failed += 1;
    }
    await sleep(1500);
  }

  const out = { updatedAt: new Date().toISOString(), games };
  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(
    `\nDone. Added ${added}, kept ${skipped}, not found ${notFound}, ` +
      `failed ${failed}, non-boardgame ${nonBoardgame}. ` +
      `Total mapped: ${Object.keys(games).length}.`,
  );
}

main().catch((err) => {
  console.error("bgg-scrape failed:", err.stack || err.message);
  process.exit(1);
});
