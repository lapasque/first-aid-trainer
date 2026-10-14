import { validateManifest } from "../domain.js";
import { runTests } from "./suite.js";

try {
  const fetchJson = async path => {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  };
  const manifest = validateManifest(await fetchJson("../data/locales.json"));
  const catalogs = await Promise.all(manifest.locales.filter(locale => locale.available)
    .map(locale => fetchJson(`../data/${locale.id}.json`)));
  const results = runTests(manifest, catalogs);
  for (const result of results) {
    const item = document.createElement("li");
    item.className = result.pass ? "pass" : "fail";
    item.textContent = `${result.pass ? "PASS" : "FAIL"} ${result.name}${result.error ? ` — ${result.error}` : ""}`;
    document.getElementById("results").append(item);
  }
  const failures = results.filter(result => !result.pass).length;
  document.getElementById("status").textContent = `${results.length - failures} / ${results.length} tests réussis ; ${failures} échec(s).`;
  document.body.dataset.result = failures ? "fail" : "pass";
} catch (error) {
  console.error(error);
  document.getElementById("status").textContent = `Échec de la suite : ${error.message}`;
  document.body.dataset.result = "fail";
}
