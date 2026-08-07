#!/usr/bin/env node
// Builds the animated ontology graph on the profile README.
// Two files, one per GitHub theme; the README picks between them with <picture>.
//
//   node scripts/build-ontology.mjs
//
// Edit NODES / EDGES below to change what the graph says. Everything else —
// curve geometry, animation stagger, ambient field — is derived.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const W = 900;
const H = 480;

// ── the ontology ────────────────────────────────────────────────────────────
// kind: core | domain | leaf.  place: where the label sits relative to the dot.

const NODES = [
  // The core carries no label — it's a mark, not a name. GitHub already prints
  // the name directly above the README.
  { id: "core", label: null, x: 450, y: 240, kind: "core" },

  { id: "sys",  label: "SYSTEMS",          x: 452, y: 104, kind: "domain", place: "above", n: "01" },
  { id: "ios",  label: "iOS",              x: 258, y: 166, kind: "domain", place: "left",  n: "02" },
  // `focus` marks the one domain the graph is really about — it gets the accent
  // halo, so it reads a step above its four siblings without rivalling the core.
  { id: "onto", label: "ONTOLOGY",         x: 648, y: 172, kind: "domain", place: "right", n: "03", focus: true },
  { id: "ml",   label: "MACHINE LEARNING", x: 302, y: 348, kind: "domain", place: "left",  n: "04" },
  { id: "data", label: "DATA",             x: 612, y: 352, kind: "domain", place: "right", n: "05" },

  { id: "next",   label: "NEXT.JS",         x: 330, y: 66,  kind: "leaf", place: "above" },
  { id: "docker", label: "DOCKER",          x: 566, y: 62,  kind: "leaf", place: "above" },
  { id: "swift",  label: "SWIFT",           x: 148, y: 92,  kind: "leaf", place: "above" },
  { id: "swiftui",label: "SWIFTUI",         x: 122, y: 250, kind: "leaf", place: "left"  },
  { id: "kg",     label: "KNOWLEDGE GRAPH", x: 792, y: 104, kind: "leaf", place: "above" },
  { id: "sem",    label: "SEMANTIC LAYER",  x: 806, y: 232, kind: "leaf", place: "below" },
  { id: "python", label: "PYTHON",          x: 168, y: 388, kind: "leaf", place: "left"  },
  { id: "tf",     label: "TENSORFLOW",      x: 342, y: 434, kind: "leaf", place: "below" },
  { id: "gql",    label: "GRAPHQL",         x: 748, y: 404, kind: "leaf", place: "right" },
  { id: "neo",    label: "NEO4J",           x: 552, y: 438, kind: "leaf", place: "below" },
];

// tier 1 — core out to the domains. These draw first.
const SPINE = [
  ["core", "sys"], ["core", "ios"], ["core", "onto"], ["core", "ml"], ["core", "data"],
];

// tier 2 — domains out to what they're made of.
const BRANCH = [
  ["sys", "next"], ["sys", "docker"],
  ["ios", "swift"], ["ios", "swiftui"],
  ["onto", "kg"], ["onto", "sem"],
  ["ml", "python"], ["ml", "tf"],
  ["data", "gql"], ["data", "neo"],
];

// tier 3 — the links that make it a graph instead of a tree. Dashed, and they
// keep moving after the intro settles.
const CROSS = [
  ["onto", "data"], ["ml", "onto"], ["ios", "sys"], ["data", "ml"], ["sem", "gql"],
];

const THEMES = {
  dark: {
    file: "assets/ontology-dark.svg",
    accent: "#ff4444",
    core: "#ff4444",
    coreText: "#e6edf3",
    domain: "#c9d1d9",
    domainText: "#e6edf3",
    leaf: "#7d8590",
    leafText: "#8b949e",
    edge: "#484f58",
    cross: "#6e7681",
    ambient: "#8b949e",
    glow: 3.4, // accent bloom; carries the red on #0d1117
  },
  light: {
    file: "assets/ontology-light.svg",
    accent: "#e5342f",
    core: "#e5342f",
    coreText: "#1f2328",
    domain: "#424a53",
    domainText: "#1f2328",
    leaf: "#818b98",
    leafText: "#636c76",
    edge: "#c8d1da",
    cross: "#aeb9c4",
    ambient: "#b6c0cb",
    glow: 0, // a bloom on white just reads as mud
  },
};

const R = { core: 11, domain: 7, leaf: 4.2 };
const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));

// ── geometry ────────────────────────────────────────────────────────────────

// Bow each edge out perpendicular to itself so nothing reads as a straight
// spoke. Direction is hashed off the endpoints, so it's stable across builds.
function curve(a, b, bow = 0.1) {
  const [p, q] = [byId[a], byId[b]];
  const [dx, dy] = [q.x - p.x, q.y - p.y];
  const len = Math.hypot(dx, dy) || 1;
  const sign = (a.charCodeAt(0) + b.charCodeAt(b.length - 1)) % 2 ? 1 : -1;
  const off = len * bow * sign;
  const cx = (p.x + q.x) / 2 + (-dy / len) * off;
  const cy = (p.y + q.y) / 2 + (dx / len) * off;
  return `M${p.x} ${p.y}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${q.x} ${q.y}`;
}

// Stop edges short of the dots they connect, so the line never runs under a node.
function trimmed(a, b, bow) {
  const [p, q] = [byId[a], byId[b]];
  // core clears its outer shell (r=27) so no edge is drawn across the mark
  const pad = { core: 32, domain: 11, leaf: 8 };
  const [dx, dy] = [q.x - p.x, q.y - p.y];
  const len = Math.hypot(dx, dy) || 1;
  const [ux, uy] = [dx / len, dy / len];
  const s = { x: p.x + ux * pad[p.kind], y: p.y + uy * pad[p.kind] };
  const e = { x: q.x - ux * pad[q.kind], y: q.y - uy * pad[q.kind] };
  const sign = (a.charCodeAt(0) + b.charCodeAt(b.length - 1)) % 2 ? 1 : -1;
  const off = len * bow * sign;
  const cx = (s.x + e.x) / 2 + (-uy) * off;
  const cy = (s.y + e.y) / 2 + ux * off;
  return `M${s.x.toFixed(1)} ${s.y.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
}

const LABEL = {
  above: (n) => ({ x: n.x, y: n.y - R[n.kind] - 9, anchor: "middle" }),
  below: (n) => ({ x: n.x, y: n.y + R[n.kind] + 16, anchor: "middle" }),
  left:  (n) => ({ x: n.x - R[n.kind] - 9, y: n.y + 3.5, anchor: "end" }),
  right: (n) => ({ x: n.x + R[n.kind] + 9, y: n.y + 3.5, anchor: "start" }),
};

// A faint field of unlabelled dots behind the graph — depth, not data.
// Seeded so every build produces the identical file.
function ambientField() {
  let seed = 1618;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const dots = [];
  for (let i = 0; dots.length < 30 && i < 600; i++) {
    const x = 40 + rand() * (W - 80);
    const y = 40 + rand() * (H - 80);
    const r = 1.5 + rand() * 4;
    // keep clear of anything that carries a label
    const clash = NODES.some((n) => Math.hypot(n.x - x, n.y - y) < 68 + r);
    if (clash) continue;
    dots.push({ x: +x.toFixed(1), y: +y.toFixed(1), r: +r.toFixed(1), o: +(0.05 + rand() * 0.1).toFixed(2) });
  }
  return dots;
}

// ── build ───────────────────────────────────────────────────────────────────

const t = (n) => +n.toFixed(2);

function svg(theme) {
  const c = THEMES[theme];
  const out = [];

  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Farhad — an ontology of what he builds: iOS, machine learning, ontology, data and systems, with the tools under each.">`
  );

  // Animation.
  //
  // The resting state — what you get with no animation at all — is the finished
  // graph, fully drawn. Every keyframe hides its element at `from` and hands it
  // back at `to`, and `animation-fill-mode: both` holds that hidden state through
  // the delay. So the reveal is a subtraction from a complete picture, never an
  // addition to an empty one: a renderer that ignores CSS animation (a feed
  // reader, an email digest, a cache that strips it) still shows the whole thing
  // rather than a blank rectangle.
  out.push(`<style>
  .e,.x{fill:none;stroke-linecap:round}
  .n,.ring{transform-box:fill-box;transform-origin:center}
  text{font-family:ui-monospace,"SF Mono",SFMono-Regular,"JetBrains Mono",Menlo,Consolas,monospace;letter-spacing:.12em}

  @keyframes draw{from{stroke-dashoffset:1;opacity:0}to{stroke-dashoffset:0;opacity:var(--o,1)}}
  @keyframes pop{from{opacity:0;transform:scale(.2)}60%{opacity:1;transform:scale(1.18)}to{opacity:var(--o,1);transform:scale(1)}}
  @keyframes rise{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
  @keyframes ghost{from{opacity:0}to{opacity:var(--o,1)}}
  @keyframes ants{to{stroke-dashoffset:-14}}
  @keyframes ring{0%{opacity:.45;transform:scale(1)}70%,100%{opacity:0;transform:scale(3.4)}}
  @keyframes drift{0%,100%{opacity:var(--o,1)}50%{opacity:calc(var(--o,1)*1.7)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes spinBack{to{transform:rotate(-360deg)}}
  @keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.22)}}
  /* a signal leaving the core and arriving somewhere. Decorative, so unlike
     everything else it rests hidden — a renderer with no motion should show
     the structure, not a pile of dots parked at the origin. */
  @keyframes flow{
    0%{offset-distance:0%;opacity:0}
    14%{opacity:1}
    82%{opacity:1}
    100%{offset-distance:100%;opacity:0}
  }

  .e{stroke:${c.edge};stroke-width:1.15;stroke-dasharray:1;animation:draw .9s cubic-bezier(.4,0,.2,1) both}
  .x{stroke:${c.cross};stroke-width:1;stroke-dasharray:1.5 5;animation:ghost 1s ease-out both,ants 1.9s linear infinite}
  .n{animation:pop .55s cubic-bezier(.34,1.4,.5,1) both}
  .l{animation:rise .6s ease-out both}
  .amb{animation:ghost 1s ease-out both,drift 7s ease-in-out infinite}
  .ring{fill:none;stroke:${c.accent};stroke-width:1.5;opacity:0;animation:ring 3.6s cubic-bezier(.2,.6,.3,1) 3.2s infinite}
  .halo{--o:.55;fill:none;stroke:${c.accent};stroke-width:1.1;stroke-dasharray:2 3.4;opacity:.55;transform-box:fill-box;transform-origin:center;animation:ghost .7s ease-out both,spin 24s linear infinite}

  /* the core: two counter-rotating dashed shells around a solid centre */
  .shell{--o:.5;fill:none;stroke:${c.accent};opacity:.5;transform-box:fill-box;transform-origin:center}
  .shell-a{stroke-width:1.1;stroke-dasharray:14 9;animation:ghost .9s ease-out .5s both,spin 34s linear infinite}
  .shell-b{--o:.34;opacity:.34;stroke-width:.9;stroke-dasharray:2 5;animation:ghost .9s ease-out .7s both,spinBack 21s linear infinite}
  .pulse{opacity:0;fill:${c.accent};animation:flow var(--d,2.6s) cubic-bezier(.55,0,.45,1) var(--t,0s) infinite}
  .leaf-b{transform-box:fill-box;transform-origin:center;animation:breathe 5.5s ease-in-out var(--t,0s) infinite}
  .recv{fill:none;stroke:${c.accent};stroke-width:1.2;opacity:0;transform-box:fill-box;transform-origin:center;animation:ring 2.7s cubic-bezier(.2,.6,.3,1) var(--t,0s) infinite}
  .num{fill:${c.accent};opacity:.75;font-size:6.4px;letter-spacing:.18em}

  @media (prefers-reduced-motion:reduce){
    .n,.l,.e,.x,.amb,.halo,.shell{animation-duration:1ms!important;animation-delay:0ms!important;animation-iteration-count:1!important}
    .ring,.pulse,.recv{display:none}
    .leaf-b{animation:none}
  }
</style>`);

  if (c.glow) {
    out.push(
      `<defs><filter id="glow" x="-120%" y="-120%" width="340%" height="340%"><feGaussianBlur stdDeviation="${c.glow}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`
    );
  }
  const glow = c.glow ? ' filter="url(#glow)"' : "";

  // ambient field
  out.push(`<g fill="${c.ambient}">`);
  ambientField().forEach((d, i) => {
    out.push(
      `<circle class="amb" cx="${d.x}" cy="${d.y}" r="${d.r}" opacity="${d.o}" style="--o:${d.o};animation-delay:${t(i * 0.028)}s,${t(2 + i * 0.19)}s"/>`
    );
  });
  out.push(`</g>`);

  // tier 3 first so the dashed cross-links sit behind everything
  CROSS.forEach(([a, b], i) => {
    out.push(
      `<path class="x" d="${trimmed(a, b, 0.16)}" opacity=".5" style="--o:.5;animation-delay:${t(2.9 + i * 0.14)}s,0s"/>`
    );
  });

  // tier 1 + tier 2 edges
  const spineAt = (i) => 0.45 + i * 0.13;
  const spinePaths = SPINE.map(([a, b]) => trimmed(a, b, 0.1));
  spinePaths.forEach((d, i) => {
    out.push(`<path class="e" d="${d}" pathLength="1" style="animation-delay:${t(spineAt(i))}s"/>`);
  });

  const branchAt = (i) => 1.5 + i * 0.09;
  const branchPaths = BRANCH.map(([a, b]) => trimmed(a, b, 0.13));
  branchPaths.forEach((d, i) => {
    out.push(
      `<path class="e" d="${d}" pathLength="1" opacity=".75" style="--o:.75;stroke-width:.9;animation-delay:${t(branchAt(i))}s"/>`
    );
  });

  // Signals. One rides each spine out of the core on a rolling stagger, so the
  // procession never bunches; the branches carry smaller, sparser ones. They
  // ride the same geometry the edges are drawn from, so they track the curves
  // exactly rather than approximating them.
  const INTRO = 3.1;
  spinePaths.forEach((d, i) => {
    out.push(
      `<circle class="pulse" r="2.4"${glow} style="offset-path:path('${d}');--d:2.7s;--t:${t(INTRO + i * 0.54)}s"/>`
    );
  });
  branchPaths.forEach((d, i) => {
    out.push(
      `<circle class="pulse" r="1.5" style="offset-path:path('${d}');--d:2.1s;--t:${t(INTRO + 1.1 + i * 0.63)}s"/>`
    );
  });

  // nodes + labels, each following the edge that reaches it
  const delayFor = (n) => {
    if (n.kind === "core") return 0.15;
    if (n.kind === "domain") return spineAt(SPINE.findIndex(([, b]) => b === n.id)) + 0.6;
    return branchAt(BRANCH.findIndex(([, b]) => b === n.id)) + 0.55;
  };

  for (const n of NODES) {
    const d = delayFor(n);
    const fill = n.kind === "core" ? c.core : n.kind === "domain" ? c.domain : c.leaf;

    if (n.kind === "core") {
      // two counter-rotating shells and an expanding ring, around a solid centre
      out.push(`<circle class="shell shell-a" cx="${n.x}" cy="${n.y}" r="27"/>`);
      out.push(`<circle class="shell shell-b" cx="${n.x}" cy="${n.y}" r="18"/>`);
      out.push(`<circle class="ring" cx="${n.x}" cy="${n.y}" r="${R.core}"/>`);
      out.push(
        `<circle class="n" cx="${n.x}" cy="${n.y}" r="${R.core}" fill="${fill}"${glow} style="animation-delay:${t(d)}s"/>`
      );
      // the bloom above is blurred through and through, so lay a clean copy over
      // it — otherwise the centre reads as a smudge rather than a solid mark
      if (glow) {
        out.push(
          `<circle class="n" cx="${n.x}" cy="${n.y}" r="${R.core}" fill="${fill}" style="animation-delay:${t(d)}s"/>`
        );
      }
      continue;
    }

    if (n.focus) {
      out.push(
        `<circle class="halo" cx="${n.x}" cy="${n.y}" r="${R[n.kind] + 5.5}" style="animation-delay:${t(d + 0.2)}s"/>`
      );
    }

    // A domain answers the signal that reaches it. Same 2.7s cycle as the spine
    // pulse, offset by the flight time, so the ring breaks exactly on arrival.
    if (n.kind === "domain") {
      const leg = SPINE.findIndex(([, b]) => b === n.id);
      out.push(
        `<circle class="recv" cx="${n.x}" cy="${n.y}" r="${R.domain}" style="--t:${t(INTRO + leg * 0.54 + 2.55)}s"/>`
      );
    }

    const dot = `<circle class="n" cx="${n.x}" cy="${n.y}" r="${R[n.kind]}" fill="${fill}"${
      n.kind === "leaf" ? ' opacity=".9"' : ""
    } style="${n.kind === "leaf" ? "--o:.9;" : ""}animation-delay:${t(d)}s"/>`;

    // Leaves breathe. The wrapper exists because `.n` already owns a transform
    // animation and the two would clobber each other on one element — nesting
    // composes them instead.
    out.push(
      n.kind === "leaf"
        ? `<g class="leaf-b" style="--t:${t(d + (n.x % 7) * 0.31)}s">${dot}</g>`
        : dot
    );

    const pos = LABEL[n.place](n);
    const textFill = n.kind === "domain" ? c.domainText : c.leafText;
    const size = n.kind === "domain" ? 9.5 : 7.6;
    const weight = n.kind === "leaf" ? 400 : 600;
    // nbsp, not spaces — SVG collapses runs of ordinary whitespace
    const num = n.n ? `<tspan class="num">${n.n}</tspan>&#160;&#160;` : "";
    out.push(
      `<text class="l" x="${pos.x}" y="${pos.y}" text-anchor="${pos.anchor}" fill="${textFill}" font-size="${size}" font-weight="${weight}" style="animation-delay:${t(d + 0.14)}s">${num}${n.label}</text>`
    );
  }

  out.push(`</svg>`);
  return out.join("\n");
}

for (const theme of Object.keys(THEMES)) {
  const path = resolve(ROOT, THEMES[theme].file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, svg(theme) + "\n");
  console.log(`wrote ${THEMES[theme].file}`);
}
