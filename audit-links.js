const fs = require("fs");
const path = require("path");

const root = process.cwd();
const langs = ["en", "de", "fr", "zh"];

function getHtmlFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);

    if (item.isDirectory()) {
      results = results.concat(getHtmlFiles(full));
    } else if (item.isFile() && item.name.toLowerCase().endsWith(".html")) {
      results.push(full);
    }
  }

  return results;
}

const htmlFiles = langs.flatMap(lang =>
  getHtmlFiles(path.join(root, lang))
);

const existing = new Set(
  htmlFiles.map(file =>
    "/" + path.relative(root, file).replace(/\\/g, "/")
  )
);

const missing = [];
const checked = new Set();

for (const file of htmlFiles) {
  const text = fs.readFileSync(file, "utf8");
  const matches = text.matchAll(/href\s*=\s*["']([^"']+)["']/gi);

  for (const match of matches) {
    const href = match[1].trim();

    if (!href.startsWith("/")) continue;
    if (href.startsWith("//")) continue;
    if (href.startsWith("/api/")) continue;

    const clean = href.split("#")[0].split("?")[0];

    if (
      clean.endsWith(".css") ||
      clean.endsWith(".js") ||
      clean.endsWith(".xml") ||
      clean.endsWith(".json") ||
      clean.endsWith(".png") ||
      clean.endsWith(".jpg") ||
      clean.endsWith(".jpeg") ||
      clean.endsWith(".webp") ||
      clean.endsWith(".svg") ||
      clean.endsWith(".mp4")
    ) {
      continue;
    }

    let target = clean;

    if (target.endsWith("/")) {
      target += "index.html";
    }

    if (!target.endsWith(".html")) {
      target += ".html";
    }

    const key = `${path.relative(root, file)} -> ${href}`;

    if (!checked.has(key)) {
      checked.add(key);

      if (!existing.has(target)) {
        missing.push({
          file: path.relative(root, file),
          href,
          expected: target
        });
      }
    }
  }
}

console.log("");
console.log("LIAPLIAS Internal Link Audit");
console.log("============================");
console.log("");

if (missing.length === 0) {
  console.log("PASS: No missing internal HTML targets found.");
} else {
  console.log(`FOUND: ${missing.length} possible broken internal links`);
  console.log("");

  for (const item of missing) {
    console.log(`FILE:     ${item.file}`);
    console.log(`HREF:     ${item.href}`);
    console.log(`EXPECTED: ${item.expected}`);
    console.log("----------------------------------------");
  }
}

console.log("");