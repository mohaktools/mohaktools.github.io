#!/usr/bin/env node
/**
 * MohakTools — bulk page upgrader
 * File: update-tool-pages.mjs
 *
 * Brings legacy tool pages in line with the current site shell:
 *   1. removes dead /assets/css/main.css + tool.css links
 *   2. ensures /assets/css/global.css and /assets/css/themes.css are linked
 *   3. removes duplicate themes.css links
 *   4. adds <script src="/assets/js/theme.js" defer> before header.js
 *   5. normalises mount ids: header-mount -> site-header, footer-mount -> site-footer
 *   6. adds <meta name="theme-color"> when missing
 *   7. writes a CSV report of remaining dark-mode risks (hardcoded colours, inline styles)
 *
 * Usage (from the repo root, i.e. the folder that contains tools/ and assets/):
 *   node update-tool-pages.mjs                  # dry run, prints what would change
 *   node update-tool-pages.mjs --apply           # writes files, keeps a backup
 *   node update-tool-pages.mjs --apply --include-root
 *   node update-tool-pages.mjs --dir "C:\path\to\repo" --apply
 *
 * Every write is preceded by a copy into _backup_<timestamp>/. Nothing is deleted.
 */

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const has = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i > -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};

const ROOT = path.resolve(opt("dir", process.cwd()));
const APPLY = has("apply");
const INCLUDE_ROOT = has("include-root");
const SHARED_CSS = has("shared-css");
const STAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const BACKUP_DIR = path.join(ROOT, `_backup_${STAMP}`);

const CSS_TAG = (name) => `  <link rel="stylesheet" href="/assets/css/${name}">\n`;
const THEME_JS_TAG = `  <script src="/assets/js/theme.js" defer></script>\n`;

/* ---------- small helpers ---------- */

function eolOf(text) {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

/** Insert `tag` immediately after the last match of `re`, or before `</head>`. */
function insertAfterLast(html, re, tag) {
  const eol = eolOf(html);
  const withEol = tag.replace(/\n$/, eol === "\r\n" ? "\r\n" : "\n");
  let last = null;
  for (const m of html.matchAll(re)) last = m;
  if (last) {
    const at = last.index + last[0].length;
    return html.slice(0, at) + withEol + html.slice(at);
  }
  const head = html.search(/<\/head>/i);
  if (head === -1) return null;
  return html.slice(0, head) + withEol + html.slice(head);
}

function insertBefore(html, re, tag) {
  const eol = eolOf(html);
  const withEol = tag.replace(/\n$/, eol === "\r\n" ? "\r\n" : "\n");
  const m = html.match(re);
  if (m) {
    const at = m.index;
    return html.slice(0, at) + withEol + html.slice(at);
  }
  return null;
}

/* ---------- the transform ---------- */

function transform(input) {
  let html = input;
  const changes = [];

  /* 1. dead legacy stylesheet links (main.css / tool.css do not exist in /assets/css) */
  const legacy = /[ \t]*<link\b[^>]*href=["']\/assets\/css\/(?:main|tool)\.css["'][^>]*>[ \t]*(?:\r?\n)?/gi;
  if (legacy.test(html)) {
    legacy.lastIndex = 0;
    html = html.replace(legacy, "");
    changes.push("removed dead main.css/tool.css link");
  }

  /* 2. global.css */
  if (!/href=["']\/assets\/css\/global\.css["']/i.test(html)) {
    const next = insertAfterLast(html, /[ \t]*<link\b[^>]*href=["']\/assets\/css\/[^"']+["'][^>]*>[ \t]*(?:\r?\n)?/gi, CSS_TAG("global.css"));
    if (next) {
      html = next;
      changes.push("added global.css");
    }
  }

  /* 3. themes.css — add once, drop duplicates */
  const themeLinkRe = /[ \t]*<link\b[^>]*href=["']\/assets\/css\/themes\.css["'][^>]*>[ \t]*(?:\r?\n)?/gi;
  const themeLinks = [...html.matchAll(themeLinkRe)];
  if (themeLinks.length === 0) {
    const next = insertAfterLast(html, /[ \t]*<link\b[^>]*href=["']\/assets\/css\/[^"']+["'][^>]*>[ \t]*(?:\r?\n)?/gi, CSS_TAG("themes.css"));
    if (next) {
      html = next;
      changes.push("added themes.css");
    }
  } else if (themeLinks.length > 1) {
    let seen = 0;
    html = html.replace(themeLinkRe, (match) => {
      seen += 1;
      return seen === 1 ? match : "";
    });
    changes.push(`removed ${themeLinks.length - 1} duplicate themes.css link(s)`);
  }

  /* 4. theme.js — must load before header.js so the toggle responds */
  if (!/\/assets\/js\/theme\.js/i.test(html)) {
    const next =
      insertBefore(html, /[ \t]*<script\b[^>]*src=["']\/assets\/js\/header\.js["'][^>]*>[ \t]*<\/script>[ \t]*(?:\r?\n)?/i, THEME_JS_TAG) ??
      insertBefore(html, /<\/body>/i, THEME_JS_TAG);
    if (next) {
      html = next;
      changes.push("added theme.js");
    }
  }

  /* 5. mount ids that header.js / footer.js look for */
  if (/id=["']header-mount["']/i.test(html)) {
    html = html.replace(/id=["']header-mount["']/gi, 'id="site-header"');
    changes.push("header-mount -> site-header");
  }
  if (/id=["']footer-mount["']/i.test(html)) {
    html = html.replace(/id=["']footer-mount["']/gi, 'id="site-footer"');
    changes.push("footer-mount -> site-footer");
  }

  /* 5b. optional shared component sheet, linked last so it wins over the inline <style> */
  if (SHARED_CSS && !/href=["']\/assets\/css\/tool-page\.css["']/i.test(html)) {
    const next = insertBefore(html, /<\/head>/i, CSS_TAG("tool-page.css"));
    if (next) {
      html = next;
      changes.push("added tool-page.css");
    }
  }

  /* 6. theme-color */
  if (!/<meta\b[^>]*name=["']theme-color["']/i.test(html)) {
    const next = insertAfterLast(
      html,
      /[ \t]*<meta\b[^>]*name=["']viewport["'][^>]*>[ \t]*(?:\r?\n)?/gi,
      `  <meta name="theme-color" content="#2563eb">\n`
    );
    if (next) {
      html = next;
      changes.push("added theme-color meta");
    }
  }

  return { html, changes };
}

/* ---------- dark-mode risk report ---------- */

function risks(html) {
  const hardcoded = [
    ...html.matchAll(/#(?:fff|ffffff|000|000000|f8fafc|ffffff)\b/gi),
  ].length;
  const inlineStyles = [...html.matchAll(/\bstyle=["']/gi)].length;
  const hexAny = [...html.matchAll(/#[0-9a-f]{3,8}\b/gi)].length;
  return { hardcoded, inlineStyles, hexAny };
}

/* ---------- run ---------- */

function findPages() {
  const pages = [];
  const toolsDir = path.join(ROOT, "tools");
  if (fs.existsSync(toolsDir)) {
    for (const entry of fs.readdirSync(toolsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const file = path.join(toolsDir, entry.name, "index.html");
      if (fs.existsSync(file)) pages.push(file);
    }
    const listing = path.join(toolsDir, "index.html");
    if (fs.existsSync(listing)) pages.push(listing);
  }
  if (INCLUDE_ROOT) {
    for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith("_") || entry.name === "assets" || entry.name === "tools") continue;
      const file = path.join(ROOT, entry.name, "index.html");
      if (fs.existsSync(file)) pages.push(file);
    }
    const home = path.join(ROOT, "index.html");
    if (fs.existsSync(home)) pages.push(home);
  }
  return pages;
}

const pages = findPages();
if (!pages.length) {
  console.error(`No pages found under ${path.join(ROOT, "tools")} — pass --dir <repo root>`);
  process.exit(1);
}

const rows = [];
let changedCount = 0;

for (const file of pages) {
  const original = fs.readFileSync(file, "utf8");
  const { html, changes } = transform(original);
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  const r = risks(html);

  if (changes.length && APPLY) {
    const backup = path.join(BACKUP_DIR, rel);
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.copyFileSync(file, backup);
    fs.writeFileSync(file, html, "utf8");
  }
  if (changes.length) changedCount += 1;

  rows.push({ page: rel, changed: changes.length ? "yes" : "no", changes: changes.join("; "), hardcoded_whites: r.hardcoded, inline_styles: r.inlineStyles, hex_colors: r.hexAny });
}

/* CSV report */
const header = ["page", "changed", "changes", "hardcoded_whites", "inline_styles", "hex_colors"];
const csv = [header.join(",")]
  .concat(rows.map((row) => header.map((k) => `"${String(row[k] ?? "").replace(/"/g, '""')}"`).join(",")))
  .join("\n");
const reportPath = path.join(ROOT, `_theme-report_${STAMP}.csv`);
fs.writeFileSync(reportPath, csv + "\n", "utf8");

/* console summary */
const touched = rows.filter((r) => r.changed === "yes");
console.log(`\nMohakTools page upgrader — ${APPLY ? "APPLY" : "DRY RUN"}`);
console.log(`root:      ${ROOT}`);
console.log(`pages:     ${rows.length}`);
console.log(`to change: ${touched.length}`);
console.log(`report:    ${path.basename(reportPath)}`);

for (const r of touched.slice(0, 40)) console.log(`  ~ ${r.page}  [${r.changes}]`);
if (touched.length > 40) console.log(`  … and ${touched.length - 40} more (see the CSV)`);

const risky = rows.filter((r) => r.hardcoded_whites > 0).sort((a, b) => b.hardcoded_whites - a.hardcoded_whites);
if (risky.length) {
  console.log(`\nDark-mode risks (hardcoded white/black literals that ignore the theme):`);
  for (const r of risky.slice(0, 15)) console.log(`  ! ${r.page}  ${r.hardcoded_whites} literal(s)`);
}

if (SHARED_CSS && !fs.existsSync(path.join(ROOT, "assets", "css", "tool-page.css"))) {
  console.log(`\nWARNING: assets/css/tool-page.css does not exist yet — copy it in before you ship, or the link will 404.`);
}

if (!APPLY) {
  console.log(`\nNothing written. Re-run with --apply to save the changes (a backup is created first).\n`);
} else {
  console.log(`\nBackup of every modified file: ${path.basename(BACKUP_DIR)}/`);
  console.log(`Now open a few pages and click the header theme toggle to confirm.\n`);
}
