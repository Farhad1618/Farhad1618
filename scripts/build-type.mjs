#!/usr/bin/env node
// Builds the type declaration on the profile README — the ontology of what I
// build, written as the thing it describes.
//
//   node scripts/build-type.mjs
//
// Two files, one per GitHub theme; the README picks between them with <picture>.
// Edit FIELDS to change what it says. Column alignment is computed, not typed.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ── what it says ────────────────────────────────────────────────────────────

const SUBJECT = "Farhad";
const FILE_LABEL = "farhad.ts";

// `focus` is rendered in the accent — the one coloured value in the block.
const FIELDS = [
  { key: "focus",    values: ["Ontology"], accent: true },
  { key: "builds",   values: ["iOS", "MachineLearning"] },
  { key: "speaks",   values: ["Swift", "Python", "TypeScript"] },
  { key: "persists", values: ["Neo4j", "GraphQL"] },
  { key: "ships",    values: ["Docker", "Next"] },
];

// ── how it looks ────────────────────────────────────────────────────────────

const W = 820;
const H = 392;

const FS = 19;       // font size
const LH = 33;       // line height
const TOP = 118;     // baseline of the first line
const COL = 182;     // left edge of the code block
const GUTTER = COL - 26; // right edge of the line-number column
const RULE = COL - 15;   // the hairline between them

const THEMES = {
  dark: {
    file: "assets/type-dark.svg",
    kw: "#ff4444",
    name: "#e6edf3",
    punct: "#4d545c",
    key: "#7d8590",
    val: "#c9d1d9",
    accent: "#ff4444",
    num: "#3d444d",
    label: "#6e7681",
    rule: "#30363d",
  },
  light: {
    file: "assets/type-light.svg",
    kw: "#e5342f",
    name: "#1f2328",
    punct: "#aeb9c4",
    key: "#818b98",
    val: "#424a53",
    accent: "#e5342f",
    num: "#d1d9e0",
    label: "#818b98",
    rule: "#e4e8ec",
  },
};

// ── build ───────────────────────────────────────────────────────────────────

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const t = (n) => +n.toFixed(2);

// Every line is one <text> with xml:space="preserve", coloured by <tspan>.
// Alignment therefore comes from the font's own advance width rather than from
// x-coordinates I guessed, so the columns hold up whichever mono font resolves.
const pad = Math.max(...FIELDS.map((f) => f.key.length)) + 3;

function lines() {
  const out = [[["kw", "type"], ["punct", " "], ["name", SUBJECT], ["punct", " = {"]]];

  for (const f of FIELDS) {
    const row = [["punct", "  "], ["key", `${f.key}:`.padEnd(pad)]];
    f.values.forEach((v, i) => {
      if (i) row.push(["punct", " | "]);
      row.push([f.accent ? "accent" : "val", v]);
    });
    out.push(row);
  }

  out.push([["punct", "}"]]);
  return out;
}

function svg(theme) {
  const c = THEMES[theme];
  const rows = lines();
  const label = `${SUBJECT} — focus: ontology. Builds iOS and machine learning; speaks Swift, Python and TypeScript; persists to Neo4j and GraphQL; ships on Docker and Next.`;
  const out = [];

  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}">`
  );

  // Animation.
  //
  // Nothing translates and nothing scales — each line simply resolves out of
  // blur, on a stagger. As everywhere else here, the resting state is the
  // finished, sharp block: the keyframes blur and hide at `from` and hand it
  // back at `to`, so a renderer that ignores CSS animation shows the
  // declaration rather than an empty frame.
  out.push(`<style>
  text{font-family:ui-monospace,"SF Mono",SFMono-Regular,"JetBrains Mono",Menlo,Consolas,monospace;font-size:${FS}px;white-space:pre}

  @keyframes resolve{from{opacity:0;filter:blur(7px)}to{opacity:1;filter:blur(0)}}
  @keyframes resolveDim{from{opacity:0;filter:blur(7px)}to{opacity:var(--o,1);filter:blur(0)}}
  @keyframes unroll{from{transform:scaleY(0)}to{transform:scaleY(1)}}
  @keyframes blink{0%,46%{opacity:1}54%,100%{opacity:0}}

  .ln{animation:resolve 1.15s cubic-bezier(.22,.7,.24,1) both}
  .gut{--o:1;animation:resolveDim 1.15s cubic-bezier(.22,.7,.24,1) both}
  .rule{transform-box:fill-box;transform-origin:top;animation:unroll 1.1s cubic-bezier(.22,.7,.24,1) .18s both}
  .label{animation:resolve 1.1s cubic-bezier(.22,.7,.24,1) .04s both}
  .caret{animation:resolve .8s ease-out var(--in) both,blink 1.15s steps(1) var(--on) infinite}

  @media (prefers-reduced-motion:reduce){
    .ln,.gut,.label,.rule{animation-duration:1ms!important;animation-delay:0ms!important}
    .caret{animation:none}
  }
</style>`);

  // file label, then the gutter rule it sits above
  out.push(
    `<text class="label" x="${COL}" y="${TOP - 46}" fill="${c.label}" font-size="12.5" letter-spacing=".14em">${esc(FILE_LABEL)}</text>`
  );
  out.push(
    `<rect class="rule" x="${RULE}" y="${TOP - 24}" width="1" height="${rows.length * LH}" fill="${c.rule}"/>`
  );

  const at = (i) => 0.26 + i * 0.115;

  rows.forEach((row, i) => {
    const y = TOP + i * LH;
    const d = at(i);

    out.push(
      `<text class="gut" x="${GUTTER}" y="${y}" text-anchor="end" fill="${c.num}" font-size="12.5" style="animation-delay:${t(d)}s">${i + 1}</text>`
    );

    const spans = row
      .map(([cls, text]) => `<tspan fill="${c[cls]}">${esc(text)}</tspan>`)
      .join("");
    out.push(
      `<text class="ln" xml:space="preserve" x="${COL}" y="${y}" style="animation-delay:${t(d)}s">${spans}</text>`
    );
  });

  // The caret sits at column 0 of the line after the closing brace — where an
  // editor would leave it. Column 0 needs no character-width arithmetic, so it
  // lands correctly no matter which mono font the reader has.
  const done = at(rows.length - 1) + 1.15;
  out.push(
    `<rect class="caret" x="${COL}" y="${TOP + rows.length * LH - FS + 4}" width="9.5" height="${FS + 1}" fill="${c.accent}" style="--in:${t(done - 0.4)}s;--on:${t(done)}s"/>`
  );

  out.push(`</svg>`);
  return out.join("\n");
}

for (const theme of Object.keys(THEMES)) {
  const path = resolve(ROOT, THEMES[theme].file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, svg(theme) + "\n");
  console.log(`wrote ${THEMES[theme].file}`);
}
