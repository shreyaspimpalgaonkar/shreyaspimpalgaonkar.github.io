// MiMo-V2.6 RL atlas: a static explorer for the XiaomiMiMo/MiMo-V2.6-RL-oss dataset.
import { DOMAINS, DOMAIN, fmt, pct, bytes, h, card, hbars, columns, stack, treemap, starMap, renderTable, showTip, hideTip } from "./charts.js";

const HF = "https://huggingface.co/datasets/XiaomiMiMo/MiMo-V2.6-RL-oss";
const ART = !!window.ATLAS_ARTIFACT; // true when published as a claude.ai artifact
const SITE = "https://shreyaspimpalgaonkar.github.io";
const HUB = "https://hub.docker.com/r/xiaomimimo/mimo-v2.6-rl-oss/tags?name=";
const V = "?v=1";
const cache = new Map();
async function get(path) {
  if (!cache.has(path))
    cache.set(
      path,
      fetch(`data/${path}${V}`).then((r) => {
        if (!r.ok) throw new Error(path);
        return r.json();
      })
    );
  return cache.get(path);
}
async function getOpt(path) {
  try {
    return await get(path);
  } catch {
    return null;
  }
}

const hfRow = (cfg, row) => `${HF}/viewer/${cfg}/train?row=${row}`;
const hfFile = (path) => `${HF}/blob/main/${path}`;
const browse = (params) => `#/tasks?${new URLSearchParams(params).toString()}`;
const ext = (href, text, cls) => h("a", { href, target: "_blank", rel: "noopener", class: cls || "inline" }, text);

// ------------------------------------------------------------------ labels
const FACETS = {
  code: [
    ["fmt", "Test format"],
    ["fw", "Test framework"],
    ["pl", "Language"],
    ["cwd", "Repo path"],
  ],
  cyber: [
    ["san", "Sanitizer"],
    ["bug", "Bug type"],
    ["proj", "Project"],
    ["cg", "Also in CyberGym"],
  ],
  general: [
    ["ind", "Industry"],
    ["tier", "Tier"],
    ["act", "Must change state"],
    ["dnb", "Reward for doing nothing"],
    ["vendors", "Mocked product"],
  ],
  terminal: [
    ["cat", "Category"],
    ["sub", "Subcategory"],
    ["tags", "Tag"],
  ],
  webdev: [
    ["fws", "Framework"],
    ["sty", "Style"],
    ["typ", "Page type"],
    ["br", "Brand named"],
    ["att", "Mentions attachment"],
  ],
  music: [
    ["fam", "Family"],
    ["tag", "Genre"],
    ["meter", "Meter"],
    ["v", "Voices"],
    ["lenc", "Length"],
  ],
};
const FMT_NAMES = {
  script: "Test script",
  build_env: "Test script plus build-env tarball",
  base_new: "Old and new test modes",
  usecase: "Black-box use-case script",
};
const IND = {
  accounting_audit_tax: "Accounting, audit and tax",
  finance_insurance: "Finance and insurance",
  healthcare_ops: "Healthcare operations",
  consulting_bizops_analytics: "Consulting and analytics",
  hr_people: "HR and people",
  it_information_systems: "IT and information systems",
  government_public: "Government and public sector",
  education_research_admin: "Education and research admin",
  legal_compliance: "Legal and compliance",
  energy_utilities_esg: "Energy, utilities and ESG",
  manufacturing_quality: "Manufacturing and quality",
  ecommerce_ops: "E-commerce operations",
  construction_pm: "Construction and project management",
  hospitality_fnb: "Hospitality and food service",
  last_mile_logistics: "Last-mile logistics",
  agriculture_coop: "Agricultural cooperatives",
};
const nice = (key, v) => {
  if (key === "fmt") return FMT_NAMES[v] || v;
  if (key === "ind") return IND[v] || v;
  if (key === "act")
    return (
      { none: "No, report only", mutate_db: "Yes, change database", edit_workspace: "Yes, edit files", both: "Yes, database and files" }[v] ||
      String(v)
    );
  if (key === "cg" || key === "att") return v === true || v === "true" ? "Yes" : "No";
  return String(v);
};

const DOMAIN_INFO = {
  code: {
    what: "Change a real repository so that hidden tests pass. Each task has its own Docker image.",
    grade: "Hidden unit tests, run by a script after the agent stops",
  },
  webdev: {
    what: "Build a static website from a short request, often in a named framework and style.",
    grade: "A vision model compares screenshots of the rollouts for the same prompt",
  },
  cyber: {
    what: "Write an input file that crashes a C or C++ program in one exact function with one exact bug type.",
    grade: "String match on the sanitizer report: bug type and top project frame",
  },
  music: {
    what: "Compose a piece in ABC notation with a given key, tempo, meter, instruments and form.",
    grade: "A format check, then a score for how close the notes' statistics are to human music. The prompt is never read",
  },
  general: {
    what: "Office work in a fake company: read documents, query mock business software over MCP, and answer or update records.",
    grade: "A rubric of about 5 items. An LLM judges most items, and code checks the rest",
  },
  terminal: {
    what: "Terminal tasks in the Terminal-Bench format: repair, debug or analyze code and data in a container.",
    grade: "Test scripts, plus a guard that gives zero if the agent planted files to fool the tests",
  },
};

// ------------------------------------------------------------------ shell
const TABS = [
  ["", "Overview"],
  ["tasks", "Tasks"],
  ["code", "Code", "code"],
  ["webdev", "Webdev", "webdev"],
  ["cyber", "Cyber", "cyber"],
  ["music", "Music", "music"],
  ["general", "General", "general"],
  ["terminal", "Terminal", "terminal"],
  ["grading", "Grading"],
  ["findings", "Issues"],
  ["tastes", "Design choices"],
  ["value", "Value"],
  ["about", "About"],
];
if (ART) {
  TABS.splice(1, 0, ["post", "Write-up"]);
  TABS.push(["tweet", "Tweet"]);
}
function shell() {
  const tabs = h(
    "nav",
    { class: "tabs", "aria-label": "Atlas sections" },
    TABS.map(([k, label, dk]) =>
      h("a", { class: "tab", href: `#/${k}`, "data-k": k }, dk ? h("i", { style: { background: DOMAIN[dk].color } }) : null, label)
    )
  );
  const top = h(
    "header",
    { class: "top" },
    h(
      "div",
      { class: "top-inner" },
      h(
        "div",
        { class: "brand-row" },
        h(
          "a",
          ART ? { class: "brand", href: `${SITE}/`, target: "_blank", rel: "noopener" } : { class: "brand", href: "/" },
          "Shreyas Pimpalgaonkar",
          h("span", {}, ".")
        ),
        h("span", { class: "sep" }, "/"),
        h("a", { class: "atlas-name", href: "#/" }, "MiMo-V2.6 RL atlas"),
        h(
          "div",
          { class: "right" },
          ext(HF, "dataset", "mono"),
          ART ? h("a", { class: "mono", href: "#/post" }, "write-up") : ext("/blog/2026/mimo-v2-6-rl-environments/", "blog post", "mono")
        )
      ),
      tabs
    )
  );
  const main = h("main", { id: "main" });
  const foot = h(
    "footer",
    { class: "foot" },
    h("span", {}, "Data: ", ext(HF, "XiaomiMiMo/MiMo-V2.6-RL-oss"), " (Apache 2.0), read on 2026-09-26."),
    h(
      "span",
      {},
      "Paper: ",
      ext("https://huggingface.co/XiaomiMiMo/MiMo-V2.6-Pro-RL/blob/main/MiMo_V2_6_technical_report.pdf", "MiMo-V2.6 technical report")
    ),
    h("span", {}, "Built by ", ART ? ext(`${SITE}/`, "Shreyas Pimpalgaonkar") : h("a", { href: "/" }, "Shreyas Pimpalgaonkar"))
  );
  document.body.replaceChildren(top, main, foot);
  return { main, tabs };
}

function setTab(tabs, key) {
  tabs.querySelectorAll(".tab").forEach((a) => {
    if (a.dataset.k === key) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

function page(main, ...kids) {
  main.className = "page-enter";
  main.replaceChildren(...kids.flat().filter((k) => k != null && k !== false));
  window.scrollTo(0, 0);
}

function section(title, sub, ...kids) {
  return h("section", { class: "section" }, h("h2", {}, title), sub ? h("p", { class: "sub" }, sub) : null, ...kids);
}

function tiles(items) {
  return h(
    "div",
    { class: "tiles" },
    items.map(([v, l]) => h("div", { class: "tile" }, h("div", { class: "v" }, v), h("div", { class: "l" }, l)))
  );
}

// ------------------------------------------------------------------ overview
async function overview(main) {
  const [S, tasks, map, extras] = await Promise.all([get("stats.json"), get("tasks.json"), get("map.json"), getOpt("extras.json")]);
  const n = Object.fromEntries(S.overall.by_domain);
  const hero = h(
    "div",
    { class: "hero" },
    h("div", { class: "kicker" }, "Dataset atlas · updated 2026-09-26"),
    h("h1", {}, "Inside the ", h("em", {}, fmt(S.overall.n)), " RL tasks behind MiMo-V2.6"),
    h(
      "p",
      { class: "lead" },
      "Xiaomi released the reinforcement learning tasks, environments and graders it used to train MiMo-V2.6. This atlas lets you look at every task, see how each one is graded, and check the problems we found."
    ),
    tiles([
      [fmt(S.overall.n), "tasks in five released parts"],
      [bytes(S.overall.docker_bytes), `of Docker images in ${fmt(S.overall.docker_tags)} tags`],
      [fmt(S.general.n), `office environments with ${fmt(S.general.n_tool_instances)} mock tools`],
      [fmt(S.general.rubric_items.total), "rubric items in the general tasks"],
      [fmt(S.cyber.proj.length), "C and C++ projects in the cyber tasks"],
    ])
  );

  const cards = h(
    "div",
    { class: "domains" },
    DOMAINS.map((d) => {
      const ex = tasks.find((t) => t.d === d.key && t.len > 120 && t.len < 1600) || tasks.find((t) => t.d === d.key);
      return h(
        "a",
        { class: "dcard", href: `#/${d.key}` },
        h(
          "div",
          { class: "dhead" },
          h("i", { class: "dot", style: { background: d.color } }),
          h("span", { class: "dname" }, d.label),
          h("span", { class: "dn" }, `${fmt(n[d.key])} tasks`)
        ),
        h("div", { class: "ddesc" }, DOMAIN_INFO[d.key].what),
        h("div", { class: "dex" }, ex ? ex.t : ""),
        h("div", { class: "dgrade" }, `Graded by: ${DOMAIN_INFO[d.key].grade}`)
      );
    })
  );

  const gcard = card({
    title: "Who decides the reward",
    sub: "Share of tasks by grader. Each color is one part of the dataset. Code, cyber, music and terminal tasks are graded by code. General and webdev tasks need a model judge.",
    wide: true,
  });
  const parts = S.grading.task_level
    .map((g) => ({ label: `${DOMAIN[g.domain].label}: ${g.grader}`, value: g.n, color: DOMAIN[g.domain].color, href: `#/${g.domain}` }))
    .sort((a, b) => DOMAINS.findIndex((d) => a.href.endsWith(d.key)) - DOMAINS.findIndex((d) => b.href.endsWith(d.key)));
  stack(gcard.body, parts, { height: 26 });
  gcard.body.appendChild(
    h(
      "p",
      { class: "card-sub", style: { marginTop: "12px" } },
      `${pct(S.grading.share_code, 0)} of tasks are graded only by code. ${pct(S.grading.share_model, 0)} need a model judge: an LLM for the general tasks and a vision model for the webdev tasks.`
    )
  );
  gcard.setTable(
    ["Grader", "Tasks", "Share"],
    parts.map((p) => [p.label, fmt(p.value), pct(p.value / S.overall.n)])
  );

  // star map
  const mapCard = card({
    title: "A map of every prompt",
    sub: "Each dot is one task. Tasks with similar prompts sit close together. Pick a part to highlight it, hover a dot to read the task, and click to open it.",
    wide: true,
    note: h(
      "span",
      {},
      "Method: a multilingual static text embedding (model2vec potion-multilingual-128M) of each prompt, projected to 2D with UMAP. Cyber tasks are embedded from their one-line target, since the rest of the cyber prompt is the same for every task."
    ),
  });
  const chips = h("div", { class: "map-chips" });
  let sm;
  const setHot = (k) => {
    chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.k === (k || ""))));
    sm.setHighlight(k || null);
  };
  chips.appendChild(h("button", { class: "chip", type: "button", "data-k": "", "aria-pressed": "true", onclick: () => setHot(null) }, "All"));
  DOMAINS.forEach((d) =>
    chips.appendChild(
      h(
        "button",
        { class: "chip", type: "button", "data-k": d.key, "aria-pressed": "false", onclick: () => setHot(d.key) },
        h("i", { style: { background: d.color } }),
        `${d.label} ${fmt(n[d.key])}`
      )
    )
  );
  const mapBox = h("div", {});
  mapCard.body.replaceChildren(chips, mapBox);
  sm = starMap(mapBox, map, tasks, {
    onClick: (t) => {
      navigate(`#/task/${encodeURIComponent(t.id)}`);
    },
  });
  mapCard.setTable(
    ["Part", "Tasks"],
    DOMAINS.map((d) => [d.label, fmt(n[d.key])])
  );

  const multiples = h("div", { class: "multiples" });
  DOMAINS.forEach((d) => {
    const box = h("div", {});
    multiples.appendChild(
      h("div", { class: "multiple" }, h("div", { class: "mt" }, h("i", { style: { background: d.color } }), d.label, h("b", {}, fmt(n[d.key]))), box)
    );
    requestAnimationFrame(() => starMap(box, map, tasks, { highlight: d.key, static: true, aspect: 0.62, r: 1.1 }));
  });
  const multCard = card({
    title: "The same map, one part at a time",
    sub: "Each small map highlights one part. Music and cyber form tight clusters because their prompts follow templates.",
    wide: true,
  });
  multCard.body.replaceChildren(multiples);

  const top = (extras?.findings || []).filter((f) => f.headline).slice(0, 4);
  const findingsSec = top.length
    ? section(
        "What we found",
        "The main problems and surprises. Each one links to the rows behind it.",
        ...top.map(findingCard),
        h("p", { style: { marginTop: "14px" } }, h("a", { class: "inline", href: "#/findings" }, "See every issue →"))
      )
    : null;

  page(
    main,
    hero,
    section(
      "Six kinds of task",
      "The dataset has five configs on Hugging Face. We split the general config into its two task families, so there are six parts here.",
      cards
    ),
    section("How the tasks are graded", null, h("div", { class: "grid2" }, gcard.root)),
    section("The prompt map", null, h("div", { class: "grid2" }, mapCard.root, multCard.root)),
    findingsSec
  );
}

// ------------------------------------------------------------------ task browser
let allTasks = null;
async function tasksPage(main, params) {
  const tasks = allTasks || (allTasks = await get("tasks.json"));
  const d = params.get("d") || "";
  const q = params.get("q") || "";
  const pg = Number(params.get("p") || 1);
  const full = params.get("full") === "1";
  const filters = [...params.entries()].filter(([k]) => k.startsWith("f."));
  const search = h("input", {
    class: "search",
    type: "search",
    placeholder: "Search titles and ids (tick the box to search full prompts)",
    value: q,
    "aria-label": "Search tasks",
  });
  const fullBox = h(
    "label",
    { class: "mono", style: { fontSize: "12px", color: "var(--muted)", display: "flex", gap: "6px", alignItems: "center" } },
    h("input", { type: "checkbox", checked: full || null }),
    "search full prompts"
  );
  const go = (next) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === "" || v == null) p.delete(k);
      else p.set(k, v);
    }
    if (!("p" in next)) p.delete("p");
    navigate(`#/tasks?${p.toString()}`);
  };
  search.addEventListener("change", () => go({ q: search.value.trim() }));
  fullBox.querySelector("input").addEventListener("change", (e) => go({ full: e.target.checked ? "1" : "" }));

  const chips = h(
    "div",
    { class: "map-chips" },
    h("a", { class: `chip${d ? "" : " on"}`, href: "#/tasks" }, `All ${fmt(tasks.length)}`),
    DOMAINS.map((x) =>
      h("a", { class: `chip${d === x.key ? " on" : ""}`, href: browse({ d: x.key }) }, h("i", { style: { background: x.color } }), x.label)
    )
  );

  let rows = tasks.filter((t) => !d || t.d === d);
  for (const [k, v] of filters) {
    const key = k.slice(2);
    rows = rows.filter((t) => {
      const val = key === "lang" ? t.lang : t.f[key];
      if (Array.isArray(val)) return val.map(String).includes(v);
      return String(val) === v;
    });
  }
  if (q) {
    const ql = q.toLowerCase();
    let hay = null;
    if (full) {
      const doms = d ? [d] : DOMAINS.map((x) => x.key);
      const ps = await Promise.all(doms.map((x) => get(`prompts/${x}.json`)));
      hay = Object.assign({}, ...ps);
    }
    rows = rows.filter(
      (t) => t.t.toLowerCase().includes(ql) || t.id.toLowerCase().includes(ql) || (hay && (hay[t.id] || "").toLowerCase().includes(ql))
    );
  }
  // facet selects for the chosen domain
  const facetBox = h("div", { class: "facets" });
  if (d) {
    const base = tasks.filter((t) => t.d === d);
    for (const [key, label] of [...FACETS[d], ["lang", "Prompt language"]]) {
      const counts = new Map();
      base.forEach((t) => {
        const val = key === "lang" ? t.lang : t.f[key];
        (Array.isArray(val) ? val : [val]).forEach((v) => {
          if (v != null && v !== "") counts.set(String(v), (counts.get(String(v)) || 0) + 1);
        });
      });
      if (counts.size < 2) continue;
      const cur = params.get(`f.${key}`) || "";
      const sel = h(
        "select",
        { "aria-label": label, onchange: (e) => go({ [`f.${key}`]: e.target.value }) },
        h("option", { value: "" }, `${label}: any`),
        [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 200)
          .map(([v, c]) => h("option", { value: v, selected: v === cur || null }, `${nice(key, v)} (${fmt(c)})`))
      );
      facetBox.appendChild(h("label", { class: "facet" }, sel));
    }
  }
  const per = 50;
  const pages = Math.max(1, Math.ceil(rows.length / per));
  const cur = Math.min(pg, pages);
  const list = h("div", { class: "tlist" }, rows.slice((cur - 1) * per, cur * per).map(taskItem));
  const pager = h(
    "div",
    { class: "pager" },
    h("button", { type: "button", disabled: cur <= 1 || null, onclick: () => go({ p: String(cur - 1) }) }, "← Prev"),
    h("span", {}, `page ${cur} of ${pages}`),
    h("button", { type: "button", disabled: cur >= pages || null, onclick: () => go({ p: String(cur + 1) }) }, "Next →")
  );
  page(
    main,
    h(
      "div",
      { class: "hero" },
      h("div", { class: "kicker" }, "Task browser"),
      h("h1", { style: { fontSize: "clamp(28px,4vw,44px)" } }, "Every task, one click away"),
      h("p", { class: "lead" }, "Filter by part and by the fields we extracted. Each task links to its row on Hugging Face and to its Docker image.")
    ),
    chips,
    h("div", { class: "browser-bar" }, search, fullBox),
    facetBox,
    h("div", { class: "count-line" }, `${fmt(rows.length)} tasks${filters.length ? " match the filters" : ""}`),
    list,
    pages > 1 ? pager : null
  );
}

function metaBits(t) {
  const f = t.f;
  switch (t.d) {
    case "code":
      return [FMT_NAMES[f.fmt], f.fw, f.pl, f.img ? bytes(f.img) : null];
    case "cyber":
      return [`${f.san} ${f.bug}`, f.proj, f.cg ? "also in CyberGym" : null];
    case "general":
      return [IND[f.ind], f.tier, `${f.nrub} rubric items`, `${f.nt} tools`, t.lang];
    case "terminal":
      return [f.cat, f.sub, (f.tags || []).slice(0, 3).join(", ")];
    case "webdev":
      return [t.lang, (f.fws || []).slice(0, 3).join(", "), (f.typ || []).slice(0, 2).join(", "), f.att ? "mentions an attachment" : null];
    case "music":
      return [f.fam, `${f.v} voice${f.v > 1 ? "s" : ""}`, f.meter, `${f.bpm} BPM`, t.lang];
    default:
      return [];
  }
}
function taskItem(t) {
  return h(
    "a",
    { class: "titem", href: `#/task/${encodeURIComponent(t.id)}` },
    h("i", { class: "dot", style: { background: DOMAIN[t.d].color } }),
    h(
      "div",
      {},
      h("div", { class: "tt" }, t.t),
      h(
        "div",
        { class: "tm" },
        h("span", {}, t.id),
        metaBits(t)
          .filter(Boolean)
          .map((b) => h("span", {}, b))
      )
    ),
    h("div", { class: "tr" }, `row ${t.row}`)
  );
}

// ------------------------------------------------------------------ task detail
function diffView(text) {
  const pre = h("pre", { class: "code" });
  text.split("\n").forEach((line) => {
    const cls =
      line.startsWith("+") && !line.startsWith("+++")
        ? "add"
        : line.startsWith("-") && !line.startsWith("---")
          ? "del"
          : line.startsWith("@@") || line.startsWith("diff --git")
            ? "hunk"
            : null;
    pre.appendChild(cls ? h("span", { class: cls }, `${line}\n`) : document.createTextNode(`${line}\n`));
  });
  return pre;
}
const codeBlock = (text) => h("pre", { class: "code" }, text);
const panel = (title, hint, ...kids) => h("div", { class: "panel" }, h("h3", {}, title), hint ? h("p", { class: "hint" }, hint) : null, ...kids);

async function taskDetail(main, id) {
  const tasks = allTasks || (allTasks = await get("tasks.json"));
  const t = tasks.find((x) => x.id === id);
  if (!t) {
    page(main, h("p", { class: "loading" }, `No task with id ${id}.`));
    return;
  }
  const [prompts, extras] = await Promise.all([get(`prompts/${t.d}.json`), getOpt("extras.json")]);
  const f = t.f;
  const metas = [
    h("span", { class: "meta" }, t.id),
    h("span", { class: "meta" }, ext(hfRow(t.cfg, t.row), `Hugging Face row ${t.row}`)),
    h("span", { class: "meta" }, `${fmt(t.len)} characters`),
    h("span", { class: "meta" }, t.lang),
  ];
  const metasEl = h("div", { class: "metas" }, metas);
  const head = h(
    "div",
    { class: "detail-head" },
    h("a", { class: "back", href: `#/tasks?d=${t.d}` }, `← ${DOMAIN[t.d].label} tasks`),
    h("div", { class: "kicker", style: { marginTop: "14px" } }, `${DOMAIN[t.d].label} task`),
    h("h1", {}, t.t),
    metasEl
  );
  const promptPanel = panel("Prompt the agent sees", null, h("div", { class: "prompt-text" }, prompts[t.id] || "(missing)"));
  const side = [];
  if (t.d === "code") {
    const chunk = await get(`code/chunk_${String(t.ck).padStart(2, "0")}.json`);
    const c = chunk[t.id];
    metasEl.appendChild(h("span", { class: "meta" }, ext(`${HUB}${c.hub_tag}`, `image ${c.hub_tag}${f.img ? ` · ${bytes(f.img)}` : ""}`)));
    side.push(
      panel(
        "How it is graded",
        "After the agent stops, the grader applies this patch and runs the test command. The agent never sees these files.",
        h(
          "div",
          { class: "metas", style: { marginBottom: "10px" } },
          h("span", { class: "meta" }, FMT_NAMES[f.fmt]),
          h("span", { class: "meta" }, f.fw),
          h("span", { class: "meta" }, f.pl),
          h("span", { class: "meta" }, `repo in ${f.cwd}`),
          h("span", { class: "meta" }, `timeout ${c.timeout}s`)
        ),
        h("div", { class: "card-sub" }, "Test command"),
        codeBlock(c.test_command || ""),
        h("div", { class: "card-sub", style: { marginTop: "8px" } }, "mimo_test_command.sh"),
        codeBlock(c.script || ""),
        c.build_env_cmd
          ? [
              h("div", { class: "card-sub", style: { marginTop: "8px" } }, ".build_env/test_command.sh (from the base64 tarball)"),
              codeBlock(c.build_env_cmd),
            ]
          : null,
        h("div", { class: "card-sub", style: { marginTop: "8px" } }, `Test files added (${c.test_files.length})`),
        h(
          "div",
          { class: "files" },
          c.test_files.map((x) => h("div", {}, x))
        )
      )
    );
    main.__extra = panel(
      `Hidden test patch (${fmt(c.patch_len)} characters${c.patch_len > c.patch.length ? ", shown up to 6,000, with base64 files left out" : ""})`,
      null,
      h(
        "details",
        {},
        h("summary", { class: "mono", style: { cursor: "pointer", fontSize: "12.5px", color: "var(--muted)" } }, "show the diff"),
        diffView(c.patch)
      )
    );
  } else if (t.d === "cyber") {
    const arvo = t.id.split("_")[1];
    metasEl.appendChild(h("span", { class: "meta" }, ext(`${HUB}arvo-v1-${arvo}`, `image arvo-v1-${arvo}${f.img ? ` · ${bytes(f.img)}` : ""}`)));
    side.push(
      panel(
        "Target and grader",
        "The agent must submit an input that makes the program crash with this exact bug type, with this function as the top frame from the project's own code.",
        h(
          "div",
          { class: "files" },
          h("div", {}, "sanitizer", h("span", {}, f.san)),
          h("div", {}, "bug type", h("span", {}, f.bug)),
          h("div", {}, "function", h("span", {}, f.fn)),
          h("div", {}, "file", h("span", {}, f.file)),
          h("div", {}, "project", h("span", {}, f.proj))
        ),
        h(
          "p",
          { class: "card-sub", style: { marginTop: "10px" } },
          f.cg
            ? [
                "This ARVO bug id is also a task in the CyberGym benchmark, where the paper reports its scores: ",
                ext(`https://huggingface.co/datasets/sunblaze-ucb/cybergym/tree/main/data/arvo/${arvo}`, `CyberGym arvo/${arvo}`),
                ".",
              ]
            : "This ARVO id is not in the CyberGym benchmark."
        )
      )
    );
  } else if (t.d === "general") {
    const env = (await get(`general/chunk_${String(t.gk).padStart(2, "0")}.json`))[t.id];
    const dn = (extras?.donothing || {})[t.id];
    side.push(generalRubric(env, dn));
    main.__extra = generalEnv(env);
  } else if (t.d === "terminal") {
    side.push(
      panel(
        "Task details",
        "Tests are copied into the container only after the agent exits. An anti-hack guard runs first and gives zero if the agent planted files such as conftest.py.",
        h(
          "div",
          { class: "files" },
          h("div", {}, "category", h("span", {}, `${f.cat} · ${f.sub}`)),
          h("div", {}, "agent timeout", h("span", {}, `${f.timeout} s`)),
          h("div", {}, "tags", h("span", {}, (f.tags || []).join(", "))),
          h("div", {}, "test files", h("span", {}, (f.tests || []).join(", ")))
        )
      )
    );
  } else if (t.d === "webdev") {
    side.push(
      panel(
        "What we extracted",
        "The grader renders the site, then a vision model compares all rollouts for this prompt and picks the better ones, with a penalty when the site does not fit the request.",
        h(
          "div",
          { class: "files" },
          h("div", {}, "frameworks named", h("span", {}, (f.fws || []).join(", ") || "none")),
          h("div", {}, "styles", h("span", {}, (f.sty || []).join(", ") || "none")),
          h("div", {}, "page types", h("span", {}, (f.typ || []).join(", ") || "none")),
          h("div", {}, "brands named", h("span", {}, (f.br || []).join(", ") || "none")),
          h("div", {}, "mentions an attachment", h("span", {}, f.att ? "yes, but no file is in the dataset" : "no"))
        )
      )
    );
  } else if (t.d === "music") {
    const demo = (extras?.music_demo || []).find((m) => m.src_id === t.id);
    side.push(
      panel(
        "Parameters",
        "The grader converts the ABC to MIDI, checks the requested parameters, and scores how typical the piece is compared with human music.",
        h(
          "div",
          { class: "files" },
          h("div", {}, "genre", h("span", {}, f.tag)),
          h("div", {}, "key", h("span", {}, f.key || "–")),
          h("div", {}, "tempo", h("span", {}, `${f.bpm} BPM ${f.tw || ""}`)),
          h("div", {}, "meter", h("span", {}, f.meter)),
          h("div", {}, "voices", h("span", {}, String(f.v))),
          h("div", {}, "bars", h("span", {}, String(f.bars || "–")))
        )
      )
    );
    if (demo) main.__extra = musicDemoPanel(demo);
  }
  const body = h("div", { class: "two" }, h("div", {}, promptPanel), h("div", {}, side));
  const extra = main.__extra;
  main.__extra = null;
  page(main, head, body, extra || null);
}

function generalRubric(env, dn) {
  const items = env.rubric.items || [];
  const wsum = items.reduce((s, it) => s + Number(it.weight ?? 1), 0) || 1;
  return panel(
    `Rubric (${items.length} items)`,
    `The final reward is the weighted average of item scores. LLM items see only the agent's final answer. Task type: input from ${env.rubric.input || "?"}, action ${env.rubric.act || "?"}.`,
    dn
      ? h(
          "div",
          { class: "callout", style: { margin: "4px 0 12px" } },
          `Do-nothing reward: `,
          h("b", {}, dn.reward != null ? dn.reward.toFixed(2) : "not run"),
          dn.reward
            ? " An agent that changes nothing and answers nothing gets this score, because some code checks pass on the untouched environment."
            : " An agent that does nothing scores zero here."
        )
      : null,
    items.map((it) =>
      h(
        "div",
        { class: "rubric-item" },
        h(
          "div",
          {},
          h("span", { class: `rtag ${it.tier}` }, it.tier),
          h(
            "div",
            { class: "mono", style: { fontSize: "11px", color: "var(--muted)" } },
            `${it.method}${it.method === "rule" ? "" : " judge"} · w ${Number(it.weight ?? 1).toFixed(2)} (${pct(Number(it.weight ?? 1) / wsum, 0)})`
          )
        ),
        h(
          "div",
          {},
          h("div", { class: "rq" }, it.question || it.description || it.desc || it.fn || it.id),
          it.pass_anchor ? h("div", { class: "ra" }, it.pass_anchor) : null,
          it.method === "rule"
            ? h("div", { class: "mono", style: { fontSize: "11.5px", color: "var(--muted)", marginTop: "4px" } }, `check function: ${it.fn}`)
            : null
        )
      )
    ),
    env.rubric.check_code
      ? h(
          "details",
          { style: { marginTop: "10px" } },
          h("summary", { class: "mono", style: { cursor: "pointer", fontSize: "12.5px", color: "var(--muted)" } }, "show the check code"),
          codeBlock(env.rubric.check_code)
        )
      : null
  );
}

function generalEnv(env) {
  const tools = env.tools || [];
  const nfn = tools.reduce((s, t) => s + t.fns.length, 0);
  const nw = tools.reduce((s, t) => s + t.fns.filter((x) => x.w).length, 0);
  const wsBytes = env.workspace.reduce((s, x) => s + x.s, 0);
  return h(
    "div",
    { class: "grid2", style: { marginTop: "16px" } },
    panel(
      `Mock software (${tools.length} tools, ${nfn} functions)`,
      `Each tool is a Python file served over MCP and backed by its own SQLite database. Orange names change state (${nw} of ${nfn}).`,
      tools.map((tl) =>
        h(
          "details",
          { class: "tool" },
          h("summary", {}, h("b", {}, tl.tool), h("span", {}, `${tl.vendor || "custom"} · ${tl.fns.length} functions`)),
          tl.fns.map((fn) =>
            h(
              "div",
              { class: "fn" },
              h("span", { class: fn.w ? "w" : null }, fn.n),
              `(${Array.isArray(fn.a) ? fn.a.join(", ") : fn.a})`,
              fn.d ? h("span", { class: "d" }, fn.d) : null
            )
          ),
          h("div", { class: "fn" }, ext(hfFile(`general/envs/${env.id}/tools/${tl.tool}.py`), "source on Hugging Face"))
        )
      )
    ),
    h(
      "div",
      {},
      panel(
        `Workspace (${env.workspace.length} files, ${bytes(wsBytes)})`,
        "The documents the agent can open. Links go to Hugging Face.",
        h(
          "div",
          { class: "files" },
          env.workspace.map((x) => h("div", {}, ext(hfFile(`general/envs/${env.id}/workspace/${x.p}`), x.p), h("span", {}, bytes(x.s))))
        )
      ),
      panel(
        `Databases (${env.systems.length})`,
        "Tables in each mock system's SQLite state.",
        env.systems.map((s) =>
          h(
            "details",
            { class: "tool" },
            h("summary", {}, h("b", {}, s.system), h("span", {}, `${s.tables.length} tables`)),
            s.tables.map((tb) =>
              h(
                "div",
                { class: "fn" },
                h("b", {}, tb.name),
                ` (${tb.cols.join(", ")}${tb.nc > tb.cols.length ? `, and ${tb.nc - tb.cols.length} more` : ""})`
              )
            )
          )
        )
      )
    )
  );
}

// ------------------------------------------------------------------ domain dashboards
function barsCard(title, sub, rows, opts = {}) {
  const c = card({ title, sub, wide: opts.wide, note: opts.note });
  hbars(c.body, rows, opts);
  c.setTable(
    opts.headers || ["Value", "Tasks"],
    rows.map((r) => [r.label, fmt(r.value)])
  );
  return c.root;
}
const toRows = (pairs, d, key, opts = {}) =>
  pairs.slice(0, opts.limit || 20).map(([v, c]) => ({
    label: opts.label ? opts.label(v) : nice(key, v),
    value: c,
    color: DOMAIN[d].color,
    href: key ? browse({ d, [`f.${key}`]: String(v) }) : null,
  }));

function pilotSection(extras) {
  const rows = extras?.pilot_rows || [];
  if (!rows.length) return null;
  const c = card({
    title: `Claude on ${rows.length} code tasks`,
    sub: "Graded the way Xiaomi's harness grades: reset the test files, apply the hidden patch, run the test command. A small, hand-picked sample.",
    wide: true,
  });
  const tbl = h("div", { class: "table-wrap" });
  renderTable(
    tbl,
    ["Task", "Language", "Format", "Solved", "Hidden tests fail before the fix", "What the agent did"],
    rows.map((r) => [
      h("a", { href: `#/task/${encodeURIComponent(r.id)}` }, r.id),
      r.language,
      FMT_NAMES[r.fmt] || r.fmt,
      r.solved ? "yes" : "no",
      r.pristine_fail ? "yes" : "no",
      r.notes.split(". ")[0],
    ])
  );
  c.body.replaceChildren(tbl);
  c.setTable(
    ["Task", "Solved"],
    rows.map((r) => [r.id, r.solved ? "yes" : "no"])
  );
  return section("A small test run", null, h("div", { class: "grid2" }, c.root));
}

async function dashCode(main) {
  const [S, extras] = await Promise.all([get("stats.json"), getOpt("extras.json")]);
  const c = S.code;
  const d = "code";
  const lens = card({ title: "Problem statement length", sub: "Characters per task." });
  columns(
    lens.body,
    c.plen_hist.counts.map((v, i) => ({
      label: `${fmt(c.plen_hist.edges[i])} to ${fmt(c.plen_hist.edges[i + 1] || "∞")} chars`,
      short: `${c.plen_hist.edges[i] / 1000}k`,
      value: v,
    })),
    { color: DOMAIN.code.color, xTitle: "characters (thousands)", unit: "tasks" }
  );
  lens.setTable(
    ["Length", "Tasks"],
    c.plen_hist.counts.map((v, i) => [`${c.plen_hist.edges[i]}+`, v])
  );
  page(
    main,
    dashHead(d, S, [
      [fmt(c.n), "tasks, each with its own Docker image"],
      [`${fmt(c.plen.p50)}`, "median characters per problem statement"],
      [fmt(c.markdown), "statements written in Markdown, like GitHub issues"],
      ["30 min", "test timeout for every task"],
    ]),
    h(
      "div",
      { class: "grid2" },
      barsCard(
        "Test format",
        "Four formats point to different build pipelines. See the Issues page for what each one implies.",
        toRows(c.fmt, d, "fmt")
      ),
      barsCard("Language", "Guessed from the test files the hidden patch adds.", toRows(c.lang, d, "pl", { limit: 14 })),
      barsCard("Test framework", "Detected from the test command and scripts.", toRows(c.fw, d, "fw", { limit: 16 }), { wide: false }),
      lens.root,
      barsCard(
        "Test files per task",
        "Files added by the hidden test patch, not counting the test script.",
        c.n_test_files
          .slice(0, 10)
          .sort((a, b) => a[0] - b[0])
          .map(([v, n]) => ({ label: `${v} file${v === 1 ? "" : "s"}`, value: n, color: DOMAIN.code.color }))
      ),
      barsCard("Where the repo lives", "Two base paths, which also line up with the formats.", toRows(c.cwd, d, "cwd"))
    ),
    section(
      "What a code task looks like",
      null,
      h(
        "div",
        { class: "prose" },
        h(
          "p",
          {},
          "Each task is one Docker image named format-code-task-NNNNNN with a repository checked out at an old commit. The agent reads the problem statement and changes the code. When it stops, the grader applies a hidden patch that adds test files and a script called mimo_test_command.sh, then runs it. A task counts as solved when the script exits with zero."
        ),
        h(
          "p",
          {},
          "In the 276 tasks with old and new test modes, the script first runs existing tests that must keep passing and then the new tests that must now pass. The paper calls these pass-to-pass and fail-to-pass tests, and says both kinds were checked 8 times for flakiness."
        ),
        h("p", {}, h("a", { class: "inline", href: browse({ d: "code" }) }, "Browse all code tasks →"))
      )
    ),
    pilotSection(extras)
  );
}

function dashHead(d, S, tileItems) {
  return h(
    "div",
    { class: "hero" },
    h("div", { class: "kicker" }, `${DOMAIN[d].label} · ${fmt(S.overall.by_domain.find(([k]) => k === d)[1])} tasks`),
    h("h1", { style: { fontSize: "clamp(30px,4.6vw,50px)" } }, DOMAIN_INFO[d].what),
    h("p", { class: "lead" }, `Graded by: ${DOMAIN_INFO[d].grade}.`),
    tiles(tileItems)
  );
}

async function dashCyber(main) {
  const S = await get("stats.json");
  const c = S.cyber;
  const d = "cyber";
  const tm = card({
    title: "Projects",
    sub: `${fmt(c.proj.length)} C and C++ projects from OSS-Fuzz, sized by task count. Click a box to see its tasks.`,
    wide: true,
  });
  treemap(
    tm.body,
    c.proj.map(([p, v]) => ({ label: p, value: v, color: DOMAIN.cyber.color, href: browse({ d, "f.proj": p }), fade: v < 3 })),
    { height: 380 }
  );
  tm.setTable(
    ["Project", "Tasks"],
    c.proj.map(([p, v]) => [p, v])
  );
  page(
    main,
    dashHead(d, S, [
      [fmt(c.n), "ARVO bugs from OSS-Fuzz"],
      [fmt(c.proj.length), "projects"],
      [fmt(c.in_cybergym), "bug ids that are also CyberGym tasks"],
      [fmt(c.bug_type.length), "bug types across three sanitizers"],
    ]),
    h(
      "div",
      { class: "grid2" },
      tm.root,
      barsCard("Bug type", "From the sanitizer report that defines each task.", toRows(c.bug_type, d, "bug", { limit: 21 })),
      barsCard("Sanitizer", "AddressSanitizer, MemorySanitizer and UndefinedBehaviorSanitizer.", toRows(c.san, d, "san")),
      barsCard(
        "Source file type",
        "Where the crash happens.",
        c.ext.map(([v, n]) => ({ label: `.${v}`, value: n, color: DOMAIN.cyber.color }))
      )
    ),
    section(
      "How the grader decides",
      null,
      h(
        "div",
        { class: "prose" },
        h(
          "p",
          {},
          "Each task comes from one sanitizer report. The task text states the bug type and the function where the crash must happen. When the agent submits a file, the grader runs the program and compares two strings from the new sanitizer report with the original: the bug type, and the top stack frame that belongs to the project itself. Both must match."
        ),
        h(
          "p",
          {},
          "The paper argues this is better than the rule used by CyberGym, which accepts any input that crashes the old program but not the fixed one. That rule can reward the wrong crash, or reject a correct one when the fix is incomplete."
        ),
        h(
          "p",
          {},
          `We did not run the cyber tasks. ${fmt(c.dup_desc_rows)} tasks share their exact target line with at least one other task, and 26 tasks target an abort inside the fuzzer's setup function, which runs before the input is read. See the Issues page.`
        )
      )
    )
  );
}

async function dashGeneral(main) {
  const S = await get("stats.json");
  const g = S.general;
  const d = "general";
  const tierLabels = { t1: "t1", t2: "t2", t3: "t3", t4: "t4", t5: "t5" };
  const tierCard = card({ title: "Difficulty tier", sub: "The tier in the task id. The paper does not define the tiers." });
  columns(
    tierCard.body,
    g.tier.map(([k, v]) => ({ label: `tier ${k}`, short: tierLabels[k], value: v, href: browse({ d, "f.tier": k }) })),
    { color: DOMAIN.general.color, height: 150, unit: "tasks" }
  );
  tierCard.setTable(["Tier", "Tasks"], g.tier);
  const itemCard = card({
    title: "Rubric items by tier and judge",
    sub: `${fmt(g.rubric_items.total)} items in total. Most are judged by an LLM that reads only the final answer.`,
  });
  const tm = Object.fromEntries(g.item_tier_method);
  const rowsTM = ["critical", "important", "sanity"].flatMap((tier) =>
    ["llm", "rule"].map((m) => ({
      label: `${tier}, ${m === "llm" ? "LLM judge" : "code check"}`,
      value: tm[`${tier}|${m}`] || 0,
      color: DOMAIN.general.color,
    }))
  );
  hbars(itemCard.body, rowsTM, { unit: "items" });
  itemCard.setTable(
    ["Tier and judge", "Items"],
    rowsTM.map((r) => [r.label, r.value])
  );
  const actCard = card({ title: "What the agent must do", sub: "From each task's verifier config. Most tasks only ask for a written answer." });
  hbars(
    actCard.body,
    g.act.map(([k, v]) => ({ label: nice("act", k), value: v, color: DOMAIN.general.color, href: browse({ d, "f.act": k }) }))
  );
  actCard.setTable(["Action", "Tasks"], g.act);
  const vend = (list) =>
    list
      .filter(([v]) => v !== "Custom or generic")
      .slice(0, 14)
      .map(([v, n]) => ({ label: v, value: n, color: DOMAIN.general.color, href: browse({ d, "f.vendors": v }) }));
  page(
    main,
    dashHead(d, S, [
      [fmt(g.n), `tasks from ${fmt(g.scenarios)} scenarios`],
      [`${g.lang.find(([k]) => k === "zh")?.[1] || 0} / ${g.lang.find(([k]) => k === "en")?.[1] || 0}`, "Chinese / English tasks"],
      [fmt(g.n_tool_instances), `mock tools, median ${g.tools.median} per task`],
      [fmt(g.ws_files.total), "workspace documents"],
      [fmt(g.rubric_items.total), `rubric items, median ${g.rubric_items.median} per task`],
    ]),
    h(
      "div",
      { class: "grid2" },
      barsCard("Industry", "From the task id.", toRows(g.ind, d, "ind", { limit: 16 }), { labelWidth: "46%" }),
      itemCard.root,
      actCard.root,
      tierCard.root,
      barsCard("Most mocked products in English tasks", "Named after real enterprise software. Counted per tool file.", vend(g.vendor_en), {
        unit: "tools",
      }),
      barsCard("Most mocked products in Chinese tasks", "The Chinese tasks imitate Chinese enterprise software.", vend(g.vendor_zh), {
        unit: "tools",
      }),
      barsCard(
        "Workspace document types",
        "File extensions across all workspaces.",
        g.ws_ext.slice(0, 12).map(([v, n]) => ({ label: `.${v}`, value: n, color: DOMAIN.general.color })),
        { unit: "files" }
      )
    ),
    section(
      "How a general task works",
      null,
      h(
        "div",
        { class: "prose" },
        h(
          "p",
          {},
          "Each environment has two containers. The agent's container holds the workspace documents. A sidecar container runs the mock software as MCP servers, each backed by a SQLite database the agent cannot read directly. The agent finds information through the tools and documents, may change records through the tools, and writes a final answer."
        ),
        h(
          "p",
          {},
          "The grader then scores each rubric item. For an LLM item, a judge model reads the final answer and a pass anchor that spells out the expected facts, and returns 0 or 1 with no partial credit. For a code item, a Python function checks the databases or files. The reward is the weighted average of the items."
        ),
        h("p", {}, h("a", { class: "inline", href: "#/grading" }, "See the do-nothing audit on the Grading page →"))
      )
    )
  );
}

async function dashTerminal(main) {
  const S = await get("stats.json");
  const g = S.terminal;
  const d = "terminal";
  page(
    main,
    dashHead(d, S, [
      [fmt(g.n), "tasks"],
      [fmt(g.cat.length), "categories"],
      ["900 s", "agent time limit"],
      ["1 CPU", "and 2 GB of memory"],
    ]),
    h(
      "div",
      { class: "grid2" },
      barsCard("Category", null, toRows(g.cat, d, "cat")),
      barsCard("Subcategory", null, toRows(g.sub, d, "sub", { limit: 20 })),
      barsCard(
        "Most common tags",
        null,
        g.tags.slice(0, 20).map(([v, n]) => ({ label: v, value: n, color: DOMAIN.terminal.color, href: browse({ d, "f.tags": v }) }))
      ),
      barsCard(
        "Files in each test bundle",
        "Every task ships a pristine-file manifest and an anti-hack guard.",
        g.test_files.slice(0, 12).map(([v, n]) => ({ label: v, value: n, color: DOMAIN.terminal.color })),
        { labelWidth: "52%" }
      )
    )
  );
}

async function dashWebdev(main) {
  const S = await get("stats.json");
  const w = S.webdev;
  const d = "webdev";
  const lens = card({ title: "Prompt length", sub: "Characters per prompt. Some are one line, and some are long briefs." });
  columns(
    lens.body,
    w.len_hist.counts.map((v, i) => ({
      label: `${w.len_hist.edges[i]} to ${w.len_hist.edges[i + 1]} chars`,
      short: w.len_hist.edges[i] >= 1000 ? `${w.len_hist.edges[i] / 1000}k` : String(w.len_hist.edges[i]),
      value: v,
    })),
    { color: DOMAIN.webdev.color, xTitle: "characters", unit: "prompts" }
  );
  lens.setTable(
    ["Length", "Prompts"],
    w.len_hist.counts.map((v, i) => [`${w.len_hist.edges[i]}+`, v])
  );
  page(
    main,
    dashHead(d, S, [
      [fmt(w.n), "website prompts"],
      [fmt(w.lang.length), "prompt languages"],
      [fmt(w.with_brand), "prompts that name a real brand as a style model"],
      [fmt(w.attach), "prompts that mention an attachment the dataset lacks"],
    ]),
    h(
      "div",
      { class: "grid2" },
      barsCard(
        "Framework asked for",
        "A prompt can name several.",
        w.fw
          .slice(0, 16)
          .map(([v, n]) => ({ label: v, value: n, color: DOMAIN.webdev.color, href: v === "(none named)" ? null : browse({ d, "f.fws": v }) }))
      ),
      barsCard(
        "Prompt language",
        "Detected with langdetect.",
        w.lang.slice(0, 14).map(([v, n]) => ({ label: v, value: n, color: DOMAIN.webdev.color, href: browse({ d, "f.lang": v }) }))
      ),
      barsCard(
        "Style words",
        "Words like glassmorphism or brutalist.",
        w.style.slice(0, 16).map(([v, n]) => ({ label: v, value: n, color: DOMAIN.webdev.color, href: browse({ d, "f.sty": v }) }))
      ),
      barsCard(
        "Page type",
        null,
        w.type.map(([v, n]) => ({ label: v, value: n, color: DOMAIN.webdev.color, href: browse({ d, "f.typ": v }) }))
      ),
      barsCard(
        "Brands used as a style model",
        'For example: "feel premium and clean like Stripe".',
        w.brand.slice(0, 18).map(([v, n]) => ({ label: v, value: n, color: DOMAIN.webdev.color, href: browse({ d, "f.br": v }) }))
      ),
      lens.root
    )
  );
}

async function dashMusic(main) {
  const [S, extras] = await Promise.all([get("stats.json"), getOpt("extras.json")]);
  const m = S.music;
  const d = "music";
  const bpm = card({ title: "Tempo", sub: "Beats per minute requested in the prompt." });
  columns(
    bpm.body,
    m.bpm_hist.counts.map((v, i) => ({
      label: `${m.bpm_hist.edges[i]} to ${m.bpm_hist.edges[i + 1]} BPM`,
      short: String(m.bpm_hist.edges[i]),
      value: v,
    })),
    { color: DOMAIN.music.color, xTitle: "BPM", unit: "prompts" }
  );
  bpm.setTable(
    ["BPM", "Prompts"],
    m.bpm_hist.counts.map((v, i) => [`${m.bpm_hist.edges[i]}+`, v])
  );
  const demos = extras?.music_demo || [];
  page(
    main,
    dashHead(d, S, [
      [fmt(m.n), "prompts"],
      [fmt(m.n_tags), "genres"],
      ["504 / 496", "Chinese / English prompts"],
      ["1 to 6", "voices per piece"],
    ]),
    h(
      "div",
      { class: "grid2" },
      barsCard("Genre family", "We grouped the 79 genre tags into families.", toRows(m.family, d, "fam")),
      barsCard("Most common genres", "Each genre has 7 to 18 prompts.", toRows(m.tag_en, d, "tag", { limit: 18 })),
      barsCard("Meter", null, toRows(m.meter, d, "meter")),
      barsCard(
        "Voices",
        null,
        m.voices
          .sort((a, b) => a[0] - b[0])
          .map(([v, n]) => ({ label: `${v} voice${v === "1" ? "" : "s"}`, value: n, color: DOMAIN.music.color, href: browse({ d, "f.v": v }) }))
      ),
      bpm.root,
      barsCard("Key", "Keys named in the prompts.", toRows(m.key, d, null, { limit: 16 }))
    ),
    demos.length
      ? section(
          "Pieces we composed and graded",
          `Claude wrote these pieces for real prompts from the dataset, and we scored them with Xiaomi's released music scorer.${ART ? "" : " Press play to listen."}`,
          h("div", { class: "grid2" }, demos.map(musicDemoPanel))
        )
      : null
  );
}

let abcLoading = null;
function loadAbc() {
  if (!abcLoading) {
    abcLoading = new Promise((res, rej) => {
      if (!ART) {
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = "https://cdn.jsdelivr.net/npm/abcjs@6.4.4/abcjs-audio.css";
        document.head.appendChild(css);
      }
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/abcjs@6.4.4/dist/abcjs-basic-min.js";
      s.onload = () => res(window.ABCJS);
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  return abcLoading;
}
function musicDemoPanel(demo) {
  const box = h("div", { class: "abc-box" });
  const ctl = h("div", { class: "abc-controls" });
  const sc = demo.scores || {};
  const isPrompt = demo.kind === "prompt_demo";
  const p = panel(
    `${isPrompt ? demo.tag_en || demo.tag : `${demo.tag_en} (a deliberately bad piece)`} · reward ${sc.overall != null ? Number(sc.overall).toFixed(2) : "–"}`,
    demo.notes || null,
    h(
      "div",
      { class: "card-sub", style: { marginBottom: "8px" } },
      isPrompt
        ? h("a", { class: "inline", href: `#/task/${encodeURIComponent(demo.src_id)}` }, `written for prompt ${demo.src_id}`)
        : "Not written for any prompt. The grader never reads the prompt, so this score would be the same for all 1,000 prompts."
    ),
    box,
    ctl,
    sc.groups
      ? h(
          "div",
          { class: "files", style: { marginTop: "10px" } },
          Object.entries(sc.groups).map(([k, v]) => h("div", {}, k, h("span", {}, typeof v === "number" ? v.toFixed(2) : String(v))))
        )
      : null
  );
  loadAbc()
    .then((ABCJS) => {
      const vis = ABCJS.renderAbc(box, demo.abc, { responsive: "resize", add_classes: true, staffwidth: 640 })[0];
      if (ART) {
        ctl.replaceChildren(h("span", { class: "card-sub" }, "Playback needs sound files this viewer blocks. It works on the website version."));
      } else if (ABCJS.synth && ABCJS.synth.supportsAudio()) {
        const synth = new ABCJS.synth.SynthController();
        synth.load(ctl, null, { displayPlay: true, displayProgress: true, displayRestart: true });
        synth.setTune(vis, false).catch(() => {});
      }
    })
    .catch(() => {
      box.textContent = demo.abc;
    });
  return p;
}

// ------------------------------------------------------------------ grading
async function grading(main) {
  const [S, extras] = await Promise.all([get("stats.json"), getOpt("extras.json")]);
  const g = S.general;
  const dist = card({ title: "Graders by task", sub: "Every task has exactly one grader type.", wide: true });
  const parts = S.grading.task_level
    .map((x) => ({ label: `${DOMAIN[x.domain].label}: ${x.grader}`, value: x.n, color: DOMAIN[x.domain].color }))
    .sort((a, b) => DOMAINS.findIndex((d) => a.label.startsWith(d.label)) - DOMAINS.findIndex((d) => b.label.startsWith(d.label)));
  stack(dist.body, parts, { height: 26 });
  dist.setTable(
    ["Grader", "Tasks"],
    parts.map((p) => [p.label, p.value])
  );
  const dn = extras?.donothing_summary;
  const dnCard = dn
    ? (() => {
        const c = card({
          title: "Reward for doing nothing, general tasks",
          sub: `We ran every code check against the untouched environment. LLM items score 0 with no answer. ${fmt(dn.positive)} of ${fmt(dn.total)} tasks give a reward above zero to an agent that does nothing.`,
          wide: true,
          note: "Method: Xiaomi's own released grader function (_run_rule_sc in verify.py), run on a fresh copy of each task's databases and workspace.",
        });
        columns(
          c.body,
          dn.hist.map((b) => ({ label: b.label, short: b.short, value: b.n, href: b.href })),
          { color: DOMAIN.general.color, xTitle: "reward for doing nothing", unit: "tasks", height: 170 }
        );
        c.setTable(
          ["Reward", "Tasks"],
          dn.hist.map((b) => [b.label, b.n])
        );
        return c.root;
      })()
    : null;
  page(
    main,
    h(
      "div",
      { class: "hero" },
      h("div", { class: "kicker" }, "Grading"),
      h("h1", { style: { fontSize: "clamp(30px,4.6vw,50px)" } }, "How each task earns its reward"),
      h(
        "p",
        { class: "lead" },
        `${pct(S.grading.share_code, 0)} of the tasks are graded only by code, and ${pct(S.grading.share_model, 0)} need a model judge. Every row in the dataset has the reward style "rule", even the ones a model grades, so that label cannot be used to tell them apart.`
      )
    ),
    h("div", { class: "grid2" }, dist.root, dnCard),
    section(
      "Groupwise advantage redistribution",
      "For code tasks, an agent grader reads all 16 rollouts for a prompt together, ranks the passing patches, and moves advantage from weak passes to strong ones. Click a rollout to flip pass and fail, and drag its quality. The paper also caps the rescaling factor, which is not modeled here.",
      garWidget()
    ),
    section(
      "Group-relative length penalty",
      "Successful rollouts that are much longer than their group's typical successful length lose some reward. Failed rollouts are not touched. The paper does not publish its settings, so these are example values.",
      lengthWidget()
    ),
    section(
      "Rubric weights in the general tasks",
      null,
      h(
        "div",
        { class: "grid2" },
        barsCard(
          "Items per task",
          null,
          g.rubric_items.dist.map(([k, v]) => ({ label: `${k} items`, value: v, color: DOMAIN.general.color }))
        ),
        barsCard(
          "Items by tier",
          "A sanity item checks that the environment is intact. It passes when the agent does nothing, so it acts as free reward.",
          g.item_tier.map(([k, v]) => ({ label: k, value: v, color: DOMAIN.general.color })),
          { unit: "items" }
        )
      )
    )
  );
}

function garWidget() {
  const n = 16;
  const st = Array.from({ length: n }, (_, i) => ({ pass: i % 3 !== 2, q: [1, 0.9, 0.5, 0.7, 0.3, 1, 0.8, 0.6][i % 8] }));
  const roll = h("div", { class: "gar-roll" });
  const before = h("div", { class: "gar-bars" });
  const after = h("div", { class: "gar-bars" });
  const info = h("div", { class: "card-sub", style: { marginTop: "8px" } });
  const qs = h("div", {});
  function compute() {
    const R = st.map((s) => (s.pass ? 1 : 0));
    const mean = R.reduce((a, b) => a + b, 0) / n;
    const A = R.map((r) => r - mean);
    const P = st.map((s, i) => (s.pass ? i : -1)).filter((i) => i >= 0);
    let lambda = 1;
    const num = P.reduce((s, i) => s + A[i], 0);
    const den = P.reduce((s, i) => s + st[i].q * A[i], 0);
    if (P.length && den > 0) lambda = num / den;
    const A2 = A.map((a, i) => (st[i].pass ? lambda * st[i].q * a : a));
    const m2 = A2.reduce((a, b) => a + b, 0) / n;
    return { A, A3: A2.map((a) => a - m2), lambda, mean };
  }
  function bars(el, vals, max) {
    el.replaceChildren(
      h("div", { class: "zero" }),
      ...vals.map((v, i) => {
        const hgt = (50 * Math.abs(v)) / max;
        const b = h(
          "div",
          { class: "gar-bar" },
          h("span", {
            style: {
              top: v >= 0 ? `${50 - hgt}%` : "50%",
              height: `${Math.max(0.5, hgt)}%`,
              background: st[i].pass ? "var(--c-cyber)" : "#c3c2b7",
              borderRadius: v >= 0 ? "3px 3px 0 0" : "0 0 3px 3px",
            },
          })
        );
        b.addEventListener("pointermove", (ev) =>
          showTip(ev, v.toFixed(3), `rollout ${i + 1} · ${st[i].pass ? `pass, quality ${st[i].q.toFixed(1)}` : "fail"}`)
        );
        b.addEventListener("pointerleave", hideTip);
        return b;
      })
    );
  }
  function render() {
    const { A, A3, lambda, mean } = compute();
    const max = Math.max(...A.map(Math.abs), ...A3.map(Math.abs), 0.01);
    roll.replaceChildren(
      ...st.map((s, i) =>
        h(
          "button",
          {
            type: "button",
            class: s.pass ? "pass" : "fail",
            onclick: () => {
              s.pass = !s.pass;
              render();
            },
          },
          `#${i + 1}`,
          h("span", {}, s.pass ? "pass" : "fail"),
          h("span", { class: "q" }, s.pass ? `q ${s.q.toFixed(1)}` : "–")
        )
      )
    );
    qs.replaceChildren(
      ...st
        .map((s, i) =>
          s.pass
            ? h(
                "div",
                { class: "slider-row" },
                h("span", {}, `quality of rollout ${i + 1}`),
                h("input", {
                  type: "range",
                  min: "0.1",
                  max: "1",
                  step: "0.1",
                  value: String(s.q),
                  oninput: (e) => {
                    s.q = Number(e.target.value);
                    render();
                  },
                }),
                h("output", {}, s.q.toFixed(1))
              )
            : null
        )
        .filter(Boolean)
        .slice(0, 6)
    );
    bars(before, A, max);
    bars(after, A3, max);
    info.textContent = `Pass rate ${pct(mean, 0)}. Scale factor for passing rollouts: ${lambda.toFixed(2)}. The total advantage of passing rollouts stays the same, and it moves toward higher quality.`;
  }
  render();
  return h(
    "div",
    { class: "chart-card" },
    h(
      "div",
      { class: "gar" },
      h(
        "div",
        {},
        h("div", { class: "card-title" }, "16 rollouts for one prompt"),
        h("div", { class: "card-sub", style: { marginBottom: "10px" } }, "Green means the tests passed. q is the grader's quality factor."),
        roll,
        h("div", { style: { marginTop: "12px" } }, qs)
      ),
      h(
        "div",
        {},
        h("div", { class: "card-title" }, "Advantage before"),
        h("div", { class: "card-sub" }, "Plain GRPO: pass minus the group mean. Every pass gets the same value."),
        before,
        h("div", { class: "card-title", style: { marginTop: "14px" } }, "Advantage after GAR"),
        h("div", { class: "card-sub" }, "Better passes get more, weaker passes get less, failures do not change before re-centering."),
        after,
        info
      )
    )
  );
}

function lengthWidget() {
  const p = { X: 0.5, delta: 0.2, s: 1.5, gamma: 2 };
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 520 220");
  svg.setAttribute("style", "width:100%;height:auto");
  const sliders = h("div", {});
  const mk = (key, label, min, max, step) => {
    const out = h("output", {}, String(p[key]));
    sliders.appendChild(
      h(
        "div",
        { class: "slider-row" },
        h("span", {}, label),
        h("input", {
          type: "range",
          min: String(min),
          max: String(max),
          step: String(step),
          value: String(p[key]),
          oninput: (e) => {
            p[key] = Number(e.target.value);
            out.textContent = String(p[key]);
            draw();
          },
        }),
        out
      )
    );
  };
  mk("X", "max deduction X", 0, 1, 0.05);
  mk("delta", "tolerance δ", 0, 1, 0.05);
  mk("s", "saturation s", 0.3, 3, 0.1);
  mk("gamma", "ramp exponent γ", 1, 4, 0.5);
  function draw() {
    const x0 = 44;
    const x1 = 505;
    const y0 = 190;
    const y1 = 16;
    const L = (r) => x0 + ((r - 0.5) / 3) * (x1 - x0);
    const Y = (v) => y0 - v * (y0 - y1);
    const pts = [];
    for (let r = 0.5; r <= 3.5001; r += 0.02) {
      const c = Math.min(1, Math.max(0, (r - 1 - p.delta) / Math.max(1e-6, p.s - p.delta)));
      pts.push(`${L(r).toFixed(1)},${Y(1 - p.X * c ** p.gamma).toFixed(1)}`);
    }
    const parts = [];
    for (const v of [0, 0.25, 0.5, 0.75, 1])
      parts.push(
        `<line x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}" stroke="#ece9e2" stroke-width="1"/><text x="${x0 - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="#6f6f68" font-family="IBM Plex Mono">${v.toFixed(2)}</text>`
      );
    for (const r of [0.5, 1, 1.5, 2, 2.5, 3, 3.5])
      parts.push(`<text x="${L(r)}" y="${y0 + 18}" text-anchor="middle" font-size="11" fill="#6f6f68" font-family="IBM Plex Mono">${r}×</text>`);
    parts.push(`<line x1="${L(1)}" x2="${L(1)}" y1="${y1}" y2="${y0}" stroke="#c3c2b7" stroke-width="1"/>`);
    parts.push(`<polyline fill="none" stroke="#2a78d6" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${pts.join(" ")}"/>`);
    parts.push(`<text x="${L(1) + 6}" y="${y1 + 12}" font-size="11" fill="#454640" font-family="Manrope">reference length ℓ*</text>`);
    svg.innerHTML = parts.join("");
  }
  draw();
  return h(
    "div",
    { class: "chart-card" },
    h(
      "div",
      { class: "gar" },
      h(
        "div",
        {},
        h("div", { class: "card-title" }, "Reward of a successful rollout"),
        h(
          "div",
          { class: "card-sub" },
          "x axis: rollout length divided by the group's reference length ℓ* (a percentile of successful lengths). The penalty only applies when enough of the group passes."
        ),
        svg
      ),
      h(
        "div",
        {},
        h("div", { class: "card-title" }, "Settings"),
        h("div", { class: "card-sub", style: { marginBottom: "8px" } }, "reward = 1 − X · clip((ℓ/ℓ* − 1 − δ) / (s − δ), 0, 1)^γ"),
        sliders
      )
    )
  );
}

// ------------------------------------------------------------------ findings, tastes, value, about
function findingCard(f) {
  return h(
    "article",
    { class: "finding", id: f.id },
    h(
      "div",
      {},
      h("div", { class: `sev ${f.severity}` }, f.severity),
      f.big ? h("div", { class: "big" }, f.big) : null,
      f.domain ? h("div", { class: "mono", style: { fontSize: "11.5px", color: "var(--muted)", marginTop: "4px" } }, f.domain) : null
    ),
    h(
      "div",
      {},
      h("h3", {}, f.title),
      (f.body || []).map((p) => h("p", {}, p)),
      f.evidence?.length
        ? h(
            "div",
            { class: "ev" },
            f.evidence.slice(0, 14).map((e) => ext(e.url, e.label))
          )
        : null,
      f.browse ? h("p", { style: { marginTop: "8px" } }, h("a", { class: "inline", href: f.browse }, "Browse the affected tasks →")) : null
    )
  );
}
async function findingsPage(main) {
  const extras = await getOpt("extras.json");
  const F = extras?.findings || [];
  page(
    main,
    h(
      "div",
      { class: "hero" },
      h("div", { class: "kicker" }, "Issues"),
      h("h1", { style: { fontSize: "clamp(30px,4.6vw,50px)" } }, "Errors, overlaps and weak spots"),
      h(
        "p",
        { class: "lead" },
        "Each issue gives the count, how we found it, and links to the rows or files behind it. High means it can change training rewards or benchmark claims. Low means it is untidy but harmless."
      )
    ),
    F.length ? F.map(findingCard) : h("p", { class: "loading" }, "Findings are still being checked.")
  );
}
async function tastesPage(main) {
  const extras = await getOpt("extras.json");
  const T = extras?.tastes || [];
  page(
    main,
    h(
      "div",
      { class: "hero" },
      h("div", { class: "kicker" }, "Design choices"),
      h("h1", { style: { fontSize: "clamp(30px,4.6vw,50px)" } }, "What this team cares about"),
      h(
        "p",
        { class: "lead" },
        "Choices in the paper, the training code and the data that show the team's taste. For each one we say what they do, why it is unusual, and where to see it."
      )
    ),
    h(
      "div",
      { class: "tastes" },
      T.map((t) =>
        h(
          "article",
          { class: "taste" },
          h("div", { class: "kicker", style: { marginBottom: "6px" } }, t.tag || ""),
          h("h3", {}, t.name),
          (t.body || []).map((p) => h("p", {}, p)),
          t.quote ? h("blockquote", { class: "q" }, t.quote) : null,
          t.src
            ? h(
                "div",
                { class: "src" },
                (t.src || []).map((s, i) => [i ? " · " : "", ext(s.url, s.label)])
              )
            : null
        )
      )
    )
  );
}
async function valuePage(main) {
  const extras = await getOpt("extras.json");
  const v = extras?.value;
  if (!v) {
    page(main, h("p", { class: "loading" }, "The value estimate is still being written."));
    return;
  }
  const c = card({
    title: "Vendor price by part, after the discount for missing parts",
    sub: "Middle case. The table has the low and high cases. Rebuild costs are in the assumptions below.",
    wide: true,
  });
  hbars(
    c.body,
    v.rows.map((r) => ({ label: r.part, value: r.mid, color: DOMAIN[r.domain]?.color || "var(--ink-2)", sub: r.unit_note })),
    { valueFmt: (x) => `$${fmt(Math.round(x))}`, total: v.rows.reduce((s, r) => s + r.mid, 0), unit: "the total" }
  );
  c.setTable(
    ["Part", "Tasks", "Low", "Middle", "High", "Basis"],
    v.rows.map((r) => [r.part, fmt(r.n), `$${fmt(r.low)}`, `$${fmt(r.mid)}`, `$${fmt(r.high)}`, r.basis])
  );
  page(
    main,
    h(
      "div",
      { class: "hero" },
      h("div", { class: "kicker" }, "Value"),
      h("h1", { style: { fontSize: "clamp(30px,4.6vw,50px)" } }, v.headline),
      (v.lead || []).map((p) => h("p", { class: "lead" }, p))
    ),
    h("div", { class: "grid2" }, c.root),
    section(
      "Assumptions",
      null,
      h(
        "div",
        { class: "prose" },
        (v.assumptions || []).map((a) => h("p", {}, a))
      )
    ),
    section(
      "Sources",
      null,
      h(
        "div",
        { class: "prose" },
        (v.sources || []).map((s) => h("p", {}, ext(s.url, s.label), s.note ? ` · ${s.note}` : ""))
      )
    )
  );
}
async function aboutPage(main) {
  const extras = await getOpt("extras.json");
  page(
    main,
    h(
      "div",
      { class: "hero" },
      h("div", { class: "kicker" }, "About"),
      h("h1", { style: { fontSize: "clamp(30px,4.6vw,50px)" } }, "How this atlas was made"),
      h(
        "p",
        { class: "lead" },
        "Everything here comes from the public dataset, the paper, Xiaomi's released training code, and a few checks we ran ourselves."
      )
    ),
    section(
      "Method",
      null,
      h(
        "div",
        { class: "prose" },
        (extras?.about || []).map((p) => h("p", {}, p))
      )
    ),
    section(
      "Caveats",
      null,
      h(
        "div",
        { class: "prose" },
        (extras?.caveats || []).map((p) => h("p", {}, p))
      )
    )
  );
}

// ------------------------------------------------------------------ figures (for the blog and social cards)
const NINE_B = [
  ["SWE-bench Verified", 60.0, 61.1, 66.2],
  ["SWE-bench Pro", 32.0, 44.6, 47.6],
  ["MiMo Code Bench (mini)", 19.5, 51.6, 59.9],
  ["MiMo Cyber Bench (mini)", 5.7, 31.3, 47.0],
  ["Terminal Bench 2.1", 27.0, 37.1, 52.8],
  ["AutomationBench v1.0.6", 5.0, 30.3, 33.1],
  ["Toolathlon-Verified", 25.9, 35.2, 38.0],
  ["OfficeQA Pro", 9.0, 19.5, 24.8],
  ["JobBench", 2.6, 18.3, 25.2],
  ["MiMo General Bench (mini)", 28.5, 62.2, 70.6],
  ["MiMo Visual Coding (mini)", 61.7, 64.0, 72.4],
];
function dumbbell(rows) {
  const cols = ["#b7b3aa", "#86b6ef", "#2a78d6"];
  const names = ["Qwen3.5-9B", "after distillation (SFT)", "after RL on the released tasks"];
  const wrap = h("div", { class: "db" });
  rows.forEach(([label, a, b, c]) => {
    const line = h(
      "div",
      { class: "db-track" },
      h("span", { class: "db-seg", style: { left: `${a}%`, width: `${b - a}%`, background: "#dcd8cf" } }),
      h("span", { class: "db-seg", style: { left: `${b}%`, width: `${c - b}%`, background: "#86b6ef" } }),
      [a, b, c].map((v, i) => h("span", { class: "db-dot", style: { left: `${v}%`, background: cols[i] }, title: `${names[i]}: ${v}` })),
      h("span", { class: "db-v", style: { left: `${c}%` } }, `${a} → ${b} → ${c}`)
    );
    wrap.appendChild(h("div", { class: "db-row" }, h("div", { class: "db-l" }, label), line));
  });
  const legend = h(
    "div",
    { class: "legend" },
    names.map((n, i) => h("span", { class: "lg" }, h("i", { style: { background: cols[i], borderRadius: "50%" } }), n))
  );
  return h("div", {}, wrap, legend);
}
async function figure(main, name) {
  const [S, tasks, map, extras] = await Promise.all([get("stats.json"), get("tasks.json"), get("map.json"), getOpt("extras.json")]);
  let body;
  if (name === "graders") {
    const c = card({
      title: "Who decides the reward",
      sub: "Share of the 7,780 tasks by grader type. 61% are graded only by code, and 39% need a model judge.",
    });
    const parts = S.grading.task_level
      .map((g) => ({ label: `${DOMAIN[g.domain].label}: ${g.grader}`, value: g.n, color: DOMAIN[g.domain].color }))
      .sort((a, b) => DOMAINS.findIndex((d) => a.label.startsWith(d.label)) - DOMAINS.findIndex((d) => b.label.startsWith(d.label)));
    stack(c.body, parts, { height: 30 });
    body = c.root;
  } else if (name === "multiples") {
    const n = Object.fromEntries(S.overall.by_domain);
    const grid = h("div", { class: "multiples" });
    body = h(
      "div",
      { class: "chart-card" },
      h("div", { class: "card-title", style: { marginBottom: "4px" } }, "Every prompt in the dataset, one part at a time"),
      h("div", { class: "card-sub", style: { marginBottom: "12px" } }, "Each dot is a task, placed so that similar prompts sit close together."),
      grid
    );
    DOMAINS.forEach((d) => {
      const box = h("div", {});
      grid.appendChild(
        h(
          "div",
          { class: "multiple" },
          h("div", { class: "mt" }, h("i", { style: { background: d.color } }), d.label, h("b", {}, fmt(n[d.key]))),
          box
        )
      );
      requestAnimationFrame(() => starMap(box, map, tasks, { highlight: d.key, static: true, aspect: 0.62, r: 1.2 }));
    });
  } else if (name === "donothing") {
    const dn = extras.donothing_summary;
    const c = card({
      title: "Reward for doing nothing in the general tasks",
      sub: `We ran every code check against the untouched environment. ${dn.positive} of ${dn.total} tasks still pay out reward.`,
    });
    columns(
      c.body,
      dn.hist.map((b) => ({ label: b.label, short: b.short, value: b.n })),
      { color: DOMAIN.general.color, xTitle: "reward for doing nothing", height: 190 }
    );
    body = c.root;
  } else if (name === "items") {
    const tm = Object.fromEntries(S.general.item_tier_method);
    const c = card({
      title: "The 5,125 rubric items in the general tasks",
      sub: "87% are judged by an LLM that reads only the agent's final answer.",
    });
    hbars(
      c.body,
      ["critical", "important", "sanity"].flatMap((t) =>
        ["llm", "rule"].map((m) => ({
          label: `${t}, ${m === "llm" ? "LLM judge" : "code check"}`,
          value: tm[`${t}|${m}`] || 0,
          color: DOMAIN.general.color,
        }))
      ),
      { unit: "items" }
    );
    body = c.root;
  } else if (name === "ninebee") {
    const c = card({
      title: "Distillation gives the bigger jump on 8 of 11 benchmarks, and RL improves all 11",
      sub: "Xiaomi's 9B model (MiMo-V2.6-Distill-Qwen-9B) on each benchmark: the base model, after distillation from MiMo, and after RL on the released environments. Source: paper, Table 6.",
    });
    c.body.replaceChildren(dumbbell(NINE_B));
    body = c.root;
  } else if (name === "card") {
    body = h(
      "div",
      { class: "social" },
      h(
        "div",
        { class: "social-l" },
        h("div", { class: "kicker" }, "MiMo-V2.6 RL atlas"),
        h("div", { class: "social-t" }, "Inside the 7,780 RL tasks behind MiMo\u2011V2.6"),
        h(
          "div",
          { class: "social-f" },
          h("div", {}, h("b", {}, "135"), " cyber training tasks are also CyberGym test tasks"),
          h("div", {}, h("b", {}, "1,000"), " music prompts, and the reward never reads them"),
          h("div", {}, h("b", {}, "172"), " office tasks pay reward for doing nothing"),
          h("div", {}, h("b", {}, "7.5 TB"), " of Docker images, worth about $1.4M to $1.9M")
        ),
        h("div", { class: "social-u mono" }, "shreyaspimpalgaonkar.github.io/mimo-rl")
      ),
      h("div", { class: "social-r" })
    );
    main.replaceChildren(body);
    requestAnimationFrame(() => starMap(body.querySelector(".social-r"), map, tasks, { static: true, height: 560, r: 1.25 }));
    return;
  } else {
    body = h("p", {}, "unknown figure");
  }
  main.className = "";
  main.replaceChildren(h("div", { class: "fig-wrap" }, body));
}

// ------------------------------------------------------------------ write-up and tweet (artifact only)
async function postPage(main) {
  const post = await get("post.json");
  const art = h("article", { class: "post" });
  art.innerHTML = post.html; // generated at build time from the blog post markdown
  page(
    main,
    h(
      "div",
      { class: "hero" },
      h("div", { class: "kicker" }, `Write-up · ${post.date}`),
      h("h1", { style: { fontSize: "clamp(30px,4.6vw,50px)" } }, post.title),
      h("p", { class: "lead" }, post.description)
    ),
    art
  );
}
async function tweetPage(main) {
  const thread = await get("thread.json");
  const copy = (text, btn) => {
    const done = () => {
      btn.textContent = "Copied";
      setTimeout(() => (btn.textContent = "Copy"), 1600);
    };
    try {
      navigator.clipboard.writeText(text).then(done, () => (btn.textContent = "Select the text to copy"));
    } catch {
      btn.textContent = "Select the text to copy";
    }
  };
  const all = thread.map((t) => t.text).join("\n\n");
  const allBtn = h("button", { type: "button", class: "chip", onclick: (e) => copy(all, e.currentTarget) }, "Copy the whole thread");
  page(
    main,
    h(
      "div",
      { class: "hero" },
      h("div", { class: "kicker" }, "Tweet"),
      h("h1", { style: { fontSize: "clamp(30px,4.6vw,50px)" } }, "A thread to post"),
      h(
        "p",
        { class: "lead" },
        `${thread.length} tweets, each under 280 characters as X counts them (every link counts as 23). Tweet 1 works on its own. Attach the image shown under each tweet.`
      ),
      h("div", { style: { marginTop: "14px" } }, allBtn)
    ),
    h(
      "div",
      { class: "tweets" },
      thread.map((t) => {
        const btn = h("button", { type: "button", onclick: (e) => copy(t.text, e.currentTarget) }, "Copy");
        return h(
          "article",
          { class: "tweet" },
          h("div", { class: "tweet-head" }, h("span", { class: "n" }, `${t.n}/${thread.length}`), h("span", {}, `${t.x_chars} characters`), btn),
          h("div", { class: "tweet-text" }, t.text),
          t.image ? h("img", { src: `img/${t.image}`, alt: `Image for tweet ${t.n}`, loading: "lazy" }) : null
        );
      })
    )
  );
}

// ------------------------------------------------------------------ router
const ROUTES = {
  "": overview,
  tasks: tasksPage,
  code: dashCode,
  cyber: dashCyber,
  general: dashGeneral,
  terminal: dashTerminal,
  webdev: dashWebdev,
  music: dashMusic,
  grading,
  findings: findingsPage,
  tastes: tastesPage,
  value: valuePage,
  about: aboutPage,
  post: postPage,
  tweet: tweetPage,
};
const { main, tabs } = shell();
async function route() {
  hideTip();
  const raw = current.replace(/^#\/?/, "");
  const [path, qs] = raw.split("?");
  const params = new URLSearchParams(qs || "");
  if (path.startsWith("fig/")) {
    document.body.classList.add("fig-mode");
    await figure(main, path.slice(4), params);
    return;
  }
  document.body.classList.remove("fig-mode");
  if (path.startsWith("task/")) {
    setTab(tabs, "tasks");
    main.replaceChildren(h("p", { class: "loading" }, "Loading task…"));
    await taskDetail(main, decodeURIComponent(path.slice(5)));
    return;
  }
  const fn = ROUTES[path] || overview;
  setTab(tabs, ROUTES[path] ? path : "");
  if (!main.children.length) main.replaceChildren(h("p", { class: "loading" }, "Loading…"));
  try {
    await fn(main, params);
  } catch (e) {
    main.replaceChildren(h("p", { class: "loading" }, `Could not load this page (${e.message}).`));
  }
}
// In-page navigation. Links to "#/..." are handled here, so the explorer also works inside
// sandboxed frames where the URL hash cannot carry state.
let current = location.hash && location.hash.startsWith("#/") ? location.hash : "#/";
function navigate(hash) {
  current = hash;
  try {
    if (location.hash !== hash) history.pushState(null, "", hash);
  } catch {
    // some frames refuse history changes; the page still navigates
  }
  route();
}
window.addEventListener("popstate", () => {
  current = location.hash && location.hash.startsWith("#/") ? location.hash : "#/";
  route();
});
window.addEventListener("hashchange", () => {
  if (location.hash.startsWith("#/") && location.hash !== current) {
    current = location.hash;
    route();
  }
});
document.addEventListener("click", (e) => {
  const a = e.target.closest ? e.target.closest('a[href^="#/"]') : null;
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  navigate(a.getAttribute("href"));
});
route();
