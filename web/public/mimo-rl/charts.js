// Small, dependency-free chart helpers for the MiMo-V2.6 RL atlas.
// Marks follow one spec: thin bars (<= 22px), 4px rounded data ends, 2px surface gaps,
// hairline axes, a hover tooltip on every mark, and a table view for every chart.

export const DOMAINS = [
  // fixed categorical order (validated palette slots 1..6, ordered by task count)
  { key: "code", label: "Code", color: "#2a78d6" },
  { key: "webdev", label: "Webdev", color: "#eb6834" },
  { key: "cyber", label: "Cyber", color: "#1baf7a" },
  { key: "music", label: "Music", color: "#eda100" },
  { key: "general", label: "General", color: "#e87ba4" },
  { key: "terminal", label: "Terminal", color: "#008300" },
];
export const DOMAIN = Object.fromEntries(DOMAINS.map((d) => [d.key, d]));

export const fmt = (n) => (n == null || Number.isNaN(n) ? "–" : Number(n).toLocaleString("en-US"));
export const pct = (x, d = 1) => `${(100 * x).toFixed(d)}%`;
export const bytes = (b) => {
  if (b == null) return "–";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = b;
  while (v >= 1000 && i < u.length - 1) {
    v /= 1000;
    i += 1;
  }
  return `${v >= 100 || i === 0 ? v.toFixed(0) : v.toFixed(1)} ${u[i]}`;
};

export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "style" && typeof v === "object") {
      for (const [sk, sv] of Object.entries(v)) {
        if (sv == null) continue;
        if (sk.startsWith("--")) e.style.setProperty(sk, sv);
        else e.style[sk] = sv;
      }
    } else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else if (k === "text") e.textContent = v;
    else if (k === "html")
      e.innerHTML = v; // only ever used with our own static strings
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    e.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return e;
}

// ------------------------------------------------------------------ tooltip
let tipEl = null;
function tip() {
  if (!tipEl) {
    tipEl = h("div", { class: "tip", role: "tooltip" });
    document.body.appendChild(tipEl);
  }
  return tipEl;
}
export function showTip(ev, value, label, extra) {
  const t = tip();
  t.replaceChildren(
    ...[
      h("div", { class: "tip-v" }, value),
      label ? h("div", { class: "tip-l" }, label) : null,
      extra ? h("div", { class: "tip-x" }, extra) : null,
    ].filter(Boolean)
  );
  t.style.display = "block";
  const r = t.getBoundingClientRect();
  let x = ev.clientX + 14;
  let y = ev.clientY + 14;
  if (x + r.width > window.innerWidth - 8) x = ev.clientX - r.width - 14;
  if (y + r.height > window.innerHeight - 8) y = ev.clientY - r.height - 14;
  t.style.left = `${x}px`;
  t.style.top = `${y}px`;
}
export function hideTip() {
  if (tipEl) tipEl.style.display = "none";
}
function hoverable(node, valueFn, labelFn, extraFn) {
  node.addEventListener("pointermove", (ev) => showTip(ev, valueFn(), labelFn && labelFn(), extraFn && extraFn()));
  node.addEventListener("pointerleave", hideTip);
  node.addEventListener("focus", () => {
    const r = node.getBoundingClientRect();
    showTip({ clientX: r.right, clientY: r.top }, valueFn(), labelFn && labelFn(), extraFn && extraFn());
  });
  node.addEventListener("blur", hideTip);
}

// ------------------------------------------------------------------ card with table view
export function card({ title, sub, note, wide, id }) {
  const body = h("div", { class: "card-body" });
  const table = h("div", { class: "card-table", hidden: true });
  const toggle = h("button", { class: "tbl-toggle", type: "button", "aria-pressed": "false" }, "Table");
  toggle.addEventListener("click", () => {
    const on = table.hidden;
    table.hidden = !on;
    body.hidden = on;
    toggle.setAttribute("aria-pressed", String(on));
    toggle.textContent = on ? "Chart" : "Table";
  });
  const root = h(
    "figure",
    { class: `chart-card${wide ? " wide" : ""}`, id },
    h(
      "figcaption",
      { class: "card-head" },
      h("div", {}, h("div", { class: "card-title" }, title), sub ? h("div", { class: "card-sub" }, sub) : null),
      toggle
    ),
    body,
    table,
    note ? h("div", { class: "card-note" }, note) : null
  );
  return {
    root,
    body,
    setTable(headers, rows) {
      renderTable(table, headers, rows);
    },
  };
}

export function renderTable(container, headers, rows) {
  const t = h(
    "table",
    { class: "data-table" },
    h(
      "thead",
      {},
      h(
        "tr",
        {},
        headers.map((x) => h("th", {}, x))
      )
    ),
    h(
      "tbody",
      {},
      rows.map((r) =>
        h(
          "tr",
          {},
          r.map((c) => h("td", {}, c instanceof Node ? c : c == null ? "–" : String(c)))
        )
      )
    )
  );
  container.replaceChildren(h("div", { class: "table-wrap" }, t));
}

// ------------------------------------------------------------------ horizontal bars
// rows: [{label, value, sub, href, color, title}]
export function hbars(container, rows, opts = {}) {
  const max = opts.max ?? Math.max(...rows.map((r) => r.value), 1);
  const total = opts.total ?? rows.reduce((s, r) => s + r.value, 0);
  const wrap = h("div", { class: "hbars", style: { "--lw": opts.labelWidth || "38%" } });
  for (const r of rows) {
    const w = Math.max(0.4, (100 * r.value) / max);
    const bar = h(r.href ? "a" : "div", {
      class: "hb-bar",
      href: r.href,
      tabindex: r.href ? null : "0",
      style: { width: `${w}%`, background: r.color || opts.color || "var(--ink-2)" },
      "aria-label": `${r.label}: ${fmt(r.value)}`,
    });
    const row = h(
      "div",
      { class: "hb-row" },
      h("div", { class: "hb-label", title: r.title || r.label }, r.label, r.sub ? h("span", { class: "hb-sub" }, r.sub) : null),
      h("div", { class: "hb-track" }, bar, h("span", { class: "hb-val" }, opts.valueFmt ? opts.valueFmt(r.value, r) : fmt(r.value)))
    );
    hoverable(
      row,
      () => (opts.valueFmt ? opts.valueFmt(r.value, r) : fmt(r.value)),
      () => r.label,
      () => (total ? `${pct(r.value / total)} of ${opts.unit || "tasks"}${r.href ? " · click to browse" : ""}` : null)
    );
    wrap.appendChild(row);
  }
  container.replaceChildren(wrap);
  return wrap;
}

// ------------------------------------------------------------------ columns (histogram)
// bins: [{label, value, href}]
export function columns(container, bins, opts = {}) {
  const max = Math.max(...bins.map((b) => b.value), 1);
  const wrap = h("div", { class: "cols", style: { height: `${opts.height || 180}px` } });
  bins.forEach((b) => {
    const col = h(b.href ? "a" : "div", {
      class: "col",
      href: b.href,
      tabindex: b.href ? null : "0",
      style: { height: `${Math.max(0.6, (100 * b.value) / max)}%`, background: opts.color || "var(--ink-2)" },
      "aria-label": `${b.label}: ${fmt(b.value)}`,
    });
    const cell = h("div", { class: "col-cell" }, h("div", { class: "col-val" }, b.value ? fmt(b.value) : ""), col);
    hoverable(
      cell,
      () => fmt(b.value),
      () => b.label,
      () => opts.unit || null
    );
    wrap.appendChild(cell);
  });
  const axis = h(
    "div",
    { class: "cols-axis" },
    bins.map((b) => h("div", { class: "cols-tick" }, b.short ?? b.label))
  );
  container.replaceChildren(h("div", { class: "cols-wrap" }, wrap, axis, opts.xTitle ? h("div", { class: "axis-title" }, opts.xTitle) : null));
}

// ------------------------------------------------------------------ 100% stacked bar
// parts: [{label, value, color, href}]
export function stack(container, parts, opts = {}) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const bar = h("div", { class: "stack", style: { height: `${opts.height || 22}px` } });
  parts.forEach((p) => {
    const share = p.value / total;
    const seg = h(p.href ? "a" : "div", {
      class: "stack-seg",
      href: p.href,
      tabindex: p.href ? null : "0",
      style: { flexGrow: String(p.value), background: p.color },
      "aria-label": `${p.label}: ${fmt(p.value)} (${pct(share)})`,
    });
    hoverable(
      seg,
      () => `${fmt(p.value)} · ${pct(share)}`,
      () => p.label,
      () => p.note || null
    );
    bar.appendChild(seg);
  });
  const legend = h(
    "div",
    { class: "legend" },
    parts.map((p) => h("span", { class: "lg" }, h("i", { style: { background: p.color } }), `${p.label} `, h("b", {}, pct(p.value / total, 0))))
  );
  container.replaceChildren(bar, legend);
}

// ------------------------------------------------------------------ squarified treemap
function squarify(items, x, y, w, hgt) {
  const out = [];
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) return out;
  const scale = (w * hgt) / total;
  const nodes = items.map((i) => ({ ...i, area: i.value * scale }));
  let rect = { x, y, w, h: hgt };
  let row = [];
  const worst = (r, side) => {
    const s = r.reduce((a, n) => a + n.area, 0);
    const mx = Math.max(...r.map((n) => n.area));
    const mn = Math.min(...r.map((n) => n.area));
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
  };
  const layoutRow = (r) => {
    const s = r.reduce((a, n) => a + n.area, 0);
    if (rect.w >= rect.h) {
      const cw = s / rect.h;
      let cy = rect.y;
      r.forEach((n) => {
        const nh = n.area / cw;
        out.push({ ...n, x: rect.x, y: cy, w: cw, h: nh });
        cy += nh;
      });
      rect = { x: rect.x + cw, y: rect.y, w: rect.w - cw, h: rect.h };
    } else {
      const ch = s / rect.w;
      let cx = rect.x;
      r.forEach((n) => {
        const nw = n.area / ch;
        out.push({ ...n, x: cx, y: rect.y, w: nw, h: ch });
        cx += nw;
      });
      rect = { x: rect.x, y: rect.y + ch, w: rect.w, h: rect.h - ch };
    }
  };
  for (const n of nodes) {
    const side = Math.min(rect.w, rect.h);
    if (!row.length || worst([...row, n], side) <= worst(row, side)) row.push(n);
    else {
      layoutRow(row);
      row = [n];
    }
  }
  if (row.length) layoutRow(row);
  return out;
}

export function treemap(container, items, opts = {}) {
  const W = 1000;
  const H = opts.height || 420;
  const cells = squarify(
    items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value),
    0,
    0,
    W,
    H
  );
  const box = h("div", { class: "tree", style: { height: `${H}px` } });
  for (const c of cells) {
    const small = c.w < 70 || c.h < 30;
    const node = h(
      c.href ? "a" : "div",
      {
        class: `tree-cell${small ? " small" : ""}`,
        href: c.href,
        tabindex: c.href ? null : "0",
        style: {
          left: `${(100 * c.x) / W}%`,
          top: `${(100 * c.y) / H}%`,
          width: `calc(${(100 * c.w) / W}% - 2px)`,
          height: `calc(${(100 * c.h) / H}% - 2px)`,
          background: c.color || opts.color || "var(--ink-2)",
          opacity: c.fade ? "0.55" : "1",
        },
        "aria-label": `${c.label}: ${fmt(c.value)}`,
      },
      small ? null : h("span", { class: "tree-l" }, c.label),
      small ? null : h("span", { class: "tree-v" }, fmt(c.value))
    );
    hoverable(
      node,
      () => fmt(c.value),
      () => c.label,
      () => c.note || null
    );
    box.appendChild(node);
  }
  container.replaceChildren(box);
}

// ------------------------------------------------------------------ the star map (canvas scatter)
// points: [[x,y]] in 0..1; tasks aligned. Emphasis form: every point in faint ink, the chosen
// domain in its own color on top (one colored series at a time keeps the all-pairs rule).
export function starMap(container, points, tasks, opts = {}) {
  const wrap = h("div", { class: "starmap" });
  const cv = h("canvas", { class: "starmap-cv", role: "img", "aria-label": opts.aria || "Map of all task prompts" });
  wrap.appendChild(cv);
  container.replaceChildren(wrap);
  const ctx = cv.getContext("2d");
  let W = 0;
  let H = 0;
  const pad = 14;
  let hot = opts.highlight || null;
  const grid = new Map();
  const cellSize = 18;
  function place() {
    const dpr = window.devicePixelRatio || 1;
    W = wrap.clientWidth;
    H = opts.height || Math.round(W * (opts.aspect || 0.62));
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    grid.clear();
    points.forEach((p, i) => {
      const x = pad + p[0] * (W - 2 * pad);
      const y = pad + (1 - p[1]) * (H - 2 * pad);
      const k = `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(i);
    });
    draw();
  }
  function xy(i) {
    return [pad + points[i][0] * (W - 2 * pad), pad + (1 - points[i][1]) * (H - 2 * pad)];
  }
  function draw(focus = -1) {
    ctx.clearRect(0, 0, W, H);
    // faint coordinate lines, like a star atlas
    ctx.strokeStyle = "rgba(21,22,20,0.06)";
    ctx.lineWidth = 1;
    for (let g = 1; g < 8; g += 1) {
      ctx.beginPath();
      ctx.moveTo((W * g) / 8, 0);
      ctx.lineTo((W * g) / 8, H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, (H * g) / 8);
      ctx.lineTo(W, (H * g) / 8);
      ctx.stroke();
    }
    const r = opts.r || (W < 500 ? 1.3 : 1.7);
    ctx.fillStyle = hot ? "rgba(21,22,20,0.13)" : "rgba(21,22,20,0.32)";
    points.forEach((p, i) => {
      if (hot && tasks[i].d === hot) return;
      const [x, y] = xy(i);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 6.2832);
      ctx.fill();
    });
    if (hot) {
      ctx.fillStyle = DOMAIN[hot].color;
      points.forEach((p, i) => {
        if (tasks[i].d !== hot) return;
        const [x, y] = xy(i);
        ctx.beginPath();
        ctx.arc(x, y, r + 0.6, 0, 6.2832);
        ctx.fill();
      });
    }
    if (focus >= 0) {
      const [x, y] = xy(focus);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#fffdf9";
      ctx.fillStyle = DOMAIN[tasks[focus].d].color;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 6.2832);
      ctx.fill();
      ctx.stroke();
    }
  }
  function nearest(mx, my) {
    const cx = Math.floor(mx / cellSize);
    const cy = Math.floor(my / cellSize);
    let best = -1;
    let bd = 24 * 24;
    for (let dx = -1; dx <= 1; dx += 1)
      for (let dy = -1; dy <= 1; dy += 1) {
        for (const i of grid.get(`${cx + dx},${cy + dy}`) || []) {
          if (hot && opts.onlyHot && tasks[i].d !== hot) continue;
          const [x, y] = xy(i);
          const d = (x - mx) ** 2 + (y - my) ** 2;
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
      }
    return best;
  }
  let cur = -1;
  cv.addEventListener("pointermove", (ev) => {
    if (opts.static) return;
    const b = cv.getBoundingClientRect();
    const i = nearest(ev.clientX - b.left, ev.clientY - b.top);
    if (i !== cur) {
      cur = i;
      draw(i);
    }
    if (i >= 0) {
      const t = tasks[i];
      showTip(ev, t.t, `${DOMAIN[t.d].label} · ${t.id}`, "click to open");
      cv.style.cursor = "pointer";
    } else {
      hideTip();
      cv.style.cursor = "default";
    }
  });
  cv.addEventListener("pointerleave", () => {
    cur = -1;
    draw();
    hideTip();
  });
  cv.addEventListener("click", () => {
    if (cur >= 0 && opts.onClick) opts.onClick(tasks[cur]);
  });
  new ResizeObserver(() => place()).observe(wrap);
  return {
    setHighlight(k) {
      hot = k;
      draw();
    },
  };
}
