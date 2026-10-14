import { readFile } from "node:fs/promises";
import { validateManifest } from "../domain.js";
import { runTests } from "./suite.js";

const readJson = async file => JSON.parse(await readFile(new URL(file, import.meta.url), "utf8"));
const manifest = validateManifest(await readJson("../data/locales.json"));
const catalogs = await Promise.all(manifest.locales.filter(locale => locale.available)
  .map(locale => readJson(`../data/${locale.id}.json`)));
const results = runTests(manifest, catalogs);
for (const result of results) {
  console.log(`${result.pass ? "PASS" : "FAIL"} ${result.name}${result.error ? `: ${result.error}` : ""}`);
}
const failures = results.filter(result => !result.pass).length;
console.log(`${results.length - failures}/${results.length} passed.`);
if (failures) process.exitCode = 1;
