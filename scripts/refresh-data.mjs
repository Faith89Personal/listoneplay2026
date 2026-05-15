#!/usr/bin/env node
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), "..");
const OUT = resolve(ROOT, "src/data");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const ITEMS_URL = "https://list.giochisulnostrotavolo.it/be/public/api/items";
const VOTES_URL = "https://list.giochisulnostrotavolo.it/be/public/api/votes";
const PDF_URL = "https://www.play-festival.it/assets/Uploads/Mappa-Play-2026.pdf";

const STAND_TRAIL_RE = /^(.*?)\s+([A-Z]{1,2})\s*(\d{1,3})\s*$/;
const STAND_ONLY_RE = /^([A-Z]{1,2})\s*(\d{1,3})\s*$/;

const FILLER_TOKENS = new Set([
  "game", "games", "studio", "studios", "italia", "italy", "edizioni",
  "edizione", "edizion", "edition", "ed", "srl", "srls", "ltd", "inc",
  "spa", "the", "il", "la", "le", "i", "gli", "del", "della", "dei",
  "degli", "delle", "and", "e", "&", "publishing", "press", "books",
  "book", "by", "associazione", "asd", "aps", "ets",
]);

function normalizeName(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['"`’´]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function significantTokens(name) {
  return normalizeName(name)
    .split(" ")
    .filter((t) => t.length > 0 && !FILLER_TOKENS.has(t));
}
function matchKey(name) {
  const t = significantTokens(name);
  if (t.length === 0) return normalizeName(name).split(" ")[0] ?? "";
  return t.slice(0, 2).join(" ");
}
function firstSignificantToken(name) {
  return significantTokens(name)[0] ?? "";
}
function compactKey(name) {
  return normalizeName(name).replace(/\s+/g, "");
}
function parensContent(name) {
  const m = name.match(/\(([^)]+)\)/);
  return m ? m[1].trim() : null;
}
function stripParens(name) {
  return name.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeListingText(text) {
  return text.replace(/\t/g, " ").replace(/([A-Z])\s*\n\s*(\d+)/g, "$1 $2");
}

function parseLine(raw) {
  const stands = [];
  let s = raw.trim();
  while (s) {
    const trail = s.match(STAND_TRAIL_RE);
    if (trail) {
      stands.unshift(`${trail[2]}${trail[3]}`);
      s = trail[1].trim();
      continue;
    }
    const only = s.match(STAND_ONLY_RE);
    if (only) {
      stands.unshift(`${only[1]}${only[2]}`);
      s = "";
      continue;
    }
    break;
  }
  return { name: s, stands };
}

function isListingPage(text) {
  if (/ELENCO ESPOSITORI/i.test(text)) return true;
  let entryLines = 0;
  for (const line of text.split(/\r?\n/)) {
    const t = line.replace(/\t/g, " ").trim();
    const m = t.match(STAND_TRAIL_RE);
    if (m && /[A-Z]{3}/.test(m[1])) entryLines += 1;
  }
  return entryLines >= 3;
}

function parseListingPage(text) {
  const normalized = normalizeListingText(text);
  const lines = normalized.split(/\r?\n/);
  const elencoIdx = lines.findIndex((l) => /ELENCO ESPOSITORI/i.test(l));
  const startIdx = elencoIdx >= 0 ? elencoIdx + 1 : 0;
  const entries = [];
  let nameBuf = "";
  let standsBuf = [];
  const flush = () => {
    const name = nameBuf.trim();
    if (name && standsBuf.length > 0) entries.push({ name, stands: standsBuf });
    nameBuf = "";
    standsBuf = [];
  };
  for (let i = startIdx; i < lines.length; i++) {
    const raw = lines[i].replace(/\t/g, " ").trim();
    if (!raw) continue;
    if (/^PAD\s+\d+/i.test(raw)) continue;
    if (/^ELENCO ESPOSITORI/i.test(raw)) continue;
    const { name, stands } = parseLine(raw);
    if (stands.length > 0) {
      if (name) {
        if (standsBuf.length > 0) flush();
        nameBuf = nameBuf ? `${nameBuf} ${name}` : name;
      }
      standsBuf.push(...stands);
    } else {
      if (standsBuf.length > 0) flush();
      nameBuf = nameBuf ? `${nameBuf} ${raw}` : raw;
    }
  }
  flush();
  return entries;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.json();
}
async function fetchBuffer(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function parsePdf(buffer) {
  const result = await new PDFParse({ data: buffer }).getText();
  const pages = result.pages ?? [];
  const all = [];
  for (const p of pages) {
    const txt = typeof p === "string" ? p : (p.text ?? "");
    if (isListingPage(txt)) all.push(...parseListingPage(txt));
  }
  return all;
}

function addToIndex(map, key, entry) {
  if (!key) return;
  const list = map.get(key) ?? [];
  list.push(entry);
  map.set(key, list);
}

function buildEditorIndex(pdfEntries) {
  const byKey = new Map();
  const byFirst = new Map();
  const byCompact = new Map();
  for (const e of pdfEntries) {
    const name = e.name.replace(/\s+/g, " ").trim();
    if (!name) continue;
    const stands = [...new Set(e.stands.map((s) => s.toUpperCase()))];
    const entry = { pdfName: name, stands };
    addToIndex(byKey, matchKey(name), entry);
    addToIndex(byFirst, firstSignificantToken(name), entry);
    addToIndex(byCompact, compactKey(name), entry);
    const inParens = parensContent(name);
    if (inParens) {
      addToIndex(byKey, matchKey(inParens), entry);
      addToIndex(byFirst, firstSignificantToken(inParens), entry);
      addToIndex(byCompact, compactKey(inParens), entry);
    }
    const stripped = stripParens(name);
    if (stripped && stripped !== name) {
      addToIndex(byKey, matchKey(stripped), entry);
      addToIndex(byCompact, compactKey(stripped), entry);
    }
  }
  return { byKey, byFirst, byCompact };
}

function mergeStands(entries) {
  return [...new Set(entries.flatMap((e) => e.stands))];
}

function lookupSubstring(apiName, index) {
  const ck = compactKey(apiName);
  if (!ck || ck.length < 6) return null;
  let bestKey = null;
  for (const key of index.byCompact.keys()) {
    if (key.length < 5) continue;
    if (key.includes(ck) || (ck.length >= key.length + 3 && ck.includes(key))) {
      if (!bestKey || Math.abs(key.length - ck.length) < Math.abs(bestKey.length - ck.length)) {
        bestKey = key;
      }
    }
  }
  if (bestKey) {
    return { via: "substring", entries: index.byCompact.get(bestKey) };
  }
  return null;
}

function lookupStands(apiEditorName, index) {
  const variants = [apiEditorName];
  const inside = parensContent(apiEditorName);
  if (inside) variants.push(inside);
  const stripped = stripParens(apiEditorName);
  if (stripped && stripped !== apiEditorName) variants.push(stripped);

  for (const v of variants) {
    const ck = compactKey(v);
    if (ck && index.byCompact.has(ck)) {
      const entries = index.byCompact.get(ck);
      return { stands: mergeStands(entries), matched: entries.map(e => e.pdfName), via: "compact" };
    }
  }
  for (const v of variants) {
    const k = matchKey(v);
    if (k && index.byKey.has(k)) {
      const entries = index.byKey.get(k);
      return { stands: mergeStands(entries), matched: entries.map(e => e.pdfName), via: "key" };
    }
  }
  for (const v of variants) {
    const f = firstSignificantToken(v);
    if (f && f.length >= 2 && index.byFirst.has(f)) {
      const entries = index.byFirst.get(f);
      return { stands: mergeStands(entries), matched: entries.map(e => e.pdfName), via: "first" };
    }
  }
  for (const v of variants) {
    const hit = lookupSubstring(v, index);
    if (hit) {
      return { stands: mergeStands(hit.entries), matched: hit.entries.map(e => e.pdfName), via: hit.via };
    }
  }
  return null;
}

async function main() {
  await mkdir(OUT, { recursive: true });

  process.stdout.write(`Fetching items … `);
  const items = await fetchJson(ITEMS_URL);
  await writeFile(resolve(OUT, "items.json"), JSON.stringify(items, null, 2) + "\n", "utf8");
  console.log(`${items.length} items saved`);

  process.stdout.write(`Fetching votes … `);
  const votes = await fetchJson(VOTES_URL);
  await writeFile(resolve(OUT, "votes.json"), JSON.stringify(votes, null, 2) + "\n", "utf8");
  console.log(`${votes.length} vote entries saved`);

  process.stdout.write(`Fetching PDF map … `);
  const pdf = await fetchBuffer(PDF_URL);
  console.log(`${pdf.length} bytes`);

  process.stdout.write(`Parsing PDF … `);
  const pdfEntries = await parsePdf(pdf);
  console.log(`${pdfEntries.length} listing entries`);

  const index = buildEditorIndex(pdfEntries);
  const apiEditors = new Map();
  for (const it of items) if (it.editor?.name) apiEditors.set(it.editor.name, it.editor);

  const editorsOut = {};
  let matchedCount = 0;
  const unmatched = [];
  for (const [name] of apiEditors) {
    const hit = lookupStands(name, index);
    if (hit && hit.stands.length > 0) {
      editorsOut[name] = { stands: hit.stands, pdfName: hit.matched[0] };
      matchedCount += 1;
    } else {
      unmatched.push(name);
    }
  }
  const payload = {
    source: PDF_URL,
    generatedAt: new Date().toISOString(),
    editors: editorsOut,
  };
  await writeFile(resolve(OUT, "editors.json"), JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`editors.json saved: ${matchedCount}/${apiEditors.size} editors matched`);
  if (unmatched.length > 0) {
    console.log(`Unmatched (${unmatched.length}):`);
    for (const n of unmatched.slice(0, 30)) console.log(`  - ${n}`);
    if (unmatched.length > 30) console.log(`  … +${unmatched.length - 30} more`);
  }
}

main().catch((err) => {
  console.error("refresh-data failed:", err.stack || err.message);
  process.exit(1);
});
