// One-off: parse the old Jekyll _projects/*.md front matter into a JSON file.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const projectsDir = fileURLToPath(new URL("../../_projects", import.meta.url));
const outFile = fileURLToPath(new URL("../src/data/projects.json", import.meta.url));

function parseFrontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split("\n")) {
    const mm = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (mm) fm[mm[1]] = mm[2].trim().replace(/^["']|["']$/g, "");
  }
  return fm;
}

const files = readdirSync(projectsDir).filter((f) => f.endsWith(".md"));
const projects = [];
for (const f of files) {
  const fm = parseFrontMatter(readFileSync(`${projectsDir}/${f}`, "utf8"));
  if (!fm.title) continue;
  projects.push({
    title: fm.title.trim(),
    description: (fm.description || "").trim(),
    category: (fm.category || "Other").trim(),
    importance: Number(fm.importance || 99),
  });
}
projects.sort((a, b) => a.importance - b.importance || a.title.localeCompare(b.title));
writeFileSync(outFile, JSON.stringify(projects, null, 2));
console.log(`Wrote ${projects.length} projects to projects.json`);
