#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { XMLParser } = require("fast-xml-parser");

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), "..");
const OUT = resolve(ROOT, "src/data/bgg.json");

const TOKEN = process.env.BGG_TOKEN;
if (!TOKEN) {
  console.error(
    "BGG_TOKEN not set. Add the bearer token from your BGG app registration to .env.local then re-run.",
  );
  process.exit(1);
}

const TYPES = "boardgame";
const BOARDGAME_CATEGORY = "GIOCHI DA TAVOLO";
const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function bggSearch(query, exact) {
  const url = `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(query)}${exact ? "&exact=1" : ""}&type=${TYPES}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "User-Agent": "listoneplay2026/1.0 (https://github.com/Faith89Personal/listoneplay2026)",
      Accept: "application/xml,text/xml",
    },
  });
  if (res.status === 429) {
    await sleep(5000);
    return bggSearch(query, exact);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${body.slice(0, 120)}`);
  }
  const text = await res.text();
  const data = xml.parse(text);
  const raw = data?.items?.item ?? [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr
    .map((i) => ({
      id: Number(i.id),
      type: i.type ?? "",
      name:
        typeof i.name === "object"
          ? (i.name.value ?? "")
          : typeof i.name === "string"
            ? i.name
            : "",
      year:
        i.yearpublished && typeof i.yearpublished === "object"
          ? Number(i.yearpublished.value)
          : i.yearpublished
            ? Number(i.yearpublished)
            : null,
    }))
    .filter((x) => Number.isFinite(x.id));
}

// Among the search results, keep board games and pick the most recent
// year published (the catalog often lists recent reprints/new editions).
function pickMostRecent(results) {
  const games = results.filter((x) => x.type === "boardgame");
  const pool = games.length > 0 ? games : results;
  if (pool.length === 0) return null;
  return pool
    .slice()
    .sort((a, b) => (b.year ?? -Infinity) - (a.year ?? -Infinity))[0];
}

async function lookup(name) {
  let r = await bggSearch(name, true);
  let pick = pickMostRecent(r);
  if (pick) return { ...pick, source: "exact" };
  await sleep(400);
  r = await bggSearch(name, false);
  pick = pickMostRecent(r);
  if (pick) return { ...pick, source: "fuzzy" };
  return null;
}

async function main() {
  const items = JSON.parse(
    await readFile(resolve(ROOT, "src/data/items.json"), "utf8"),
  );
  let aliases = {};
  try {
    aliases = JSON.parse(
      await readFile(resolve(ROOT, "src/data/bgg-aliases.json"), "utf8"),
    );
  } catch {
    // ok
  }
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
  let failed = 0;
  let notFound = 0;
  let nonBoardgame = 0;

  for (const it of items) {
    const idStr = String(it.id);
    if (it?.category?.name !== BOARDGAME_CATEGORY) {
      nonBoardgame += 1;
      continue;
    }
    if (!force && games[idStr]) {
      skipped += 1;
      continue;
    }
    if (
      !force &&
      typeof aliases?.[it.name] === "number" &&
      Number.isFinite(aliases[it.name])
    ) {
      skipped += 1;
      continue;
    }
    process.stdout.write(`[${idStr.padStart(4)}] ${it.name} … `);
    try {
      const hit = await lookup(it.name);
      if (hit) {
        games[idStr] = {
          bggId: hit.id,
          bggName: hit.name,
          year: hit.year,
          type: hit.type,
          source: hit.source,
        };
        console.log(`#${hit.id} ${hit.name} (${hit.source})`);
        added += 1;
      } else {
        console.log("not found");
        notFound += 1;
      }
    } catch (err) {
      console.log(`error: ${err.message}`);
      failed += 1;
    }
    await sleep(600);
  }

  const out = {
    updatedAt: new Date().toISOString(),
    games,
  };
  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(
    `\nDone. Added ${added}, kept ${skipped}, not found ${notFound}, failed ${failed}, skipped non-boardgame ${nonBoardgame}. Total mapped: ${Object.keys(games).length}.`,
  );
}

main().catch((err) => {
  console.error("bgg-fetch failed:", err.stack || err.message);
  process.exit(1);
});
