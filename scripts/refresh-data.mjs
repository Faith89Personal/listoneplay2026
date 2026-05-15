#!/usr/bin/env node
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), "..");
const OUT = resolve(ROOT, "src/data");

const TARGETS = [
  { url: "https://list.giochisulnostrotavolo.it/be/public/api/items", file: "items.json" },
  { url: "https://list.giochisulnostrotavolo.it/be/public/api/votes", file: "votes.json" },
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.json();
}

async function main() {
  await mkdir(OUT, { recursive: true });
  for (const { url, file } of TARGETS) {
    process.stdout.write(`Fetching ${url} … `);
    const data = await fetchJson(url);
    const dest = resolve(OUT, file);
    await writeFile(dest, JSON.stringify(data, null, 2) + "\n", "utf8");
    const count = Array.isArray(data) ? data.length : Object.keys(data).length;
    console.log(`saved ${count} entries → src/data/${file}`);
  }
}

main().catch((err) => {
  console.error("refresh-data failed:", err.message);
  process.exit(1);
});
