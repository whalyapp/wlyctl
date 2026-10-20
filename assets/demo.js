// Live demo: wlyctl pull → a coding agent edits the YAML → wlyctl push → the KPI shows up
// on an end user's phone, on a loop.
// Scripted, no dependencies. Renders a static end state under prefers-reduced-motion.
(() => {
  "use strict";

  const termEl = document.getElementById("term");
  const codeEl = document.getElementById("code");
  const tabsEl = document.getElementById("tabs");
  const stepsEl = document.getElementById("steps");
  const statusFileEl = document.getElementById("status-file");
  const pauseBtn = document.getElementById("demo-pause");
  const replayBtn = document.getElementById("demo-replay");
  const fieldEl = document.getElementById("field");
  const pValEl = document.getElementById("p-val");
  const winEl = document.querySelector(".window");
  if (!termEl || !codeEl) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const AGENTS = [
    { cmd: "claude", label: "Claude Code" },
    { cmd: "codex", label: "Codex" },
    { cmd: "copilot", label: "Copilot" },
    { cmd: "gemini", label: "Gemini CLI" },
    { cmd: "cursor-agent", label: "Cursor" },
    { cmd: "vibe", label: "Mistral Vibe" },
  ];

  const PROMPT = "Add a 30-day revenue metric to Account and show it as a KPI on the account page";

  // ---------- files ----------
  const ACCOUNT = [
    "apiVersion: v1",
    "kind: Object",
    "referenceId: account",
    "name: Account",
    "model: dim_accounts",
    "table:",
    "  referenceId: account-table",
    "  name: Account",
    "primaryKey: account_id",
    "properties:",
    "  - referenceId: name",
    "    columnName: account_name",
    "  - referenceId: segment",
    "    columnName: segment",
    "metrics:",
    "  - referenceId: orders-90d",
    "    expression: COUNT_DISTINCT",
    "    columnName: order_id",
    "relationships: []",
  ];
  const ACCOUNT_ADD_AT = 18; // before "relationships"
  const ACCOUNT_ADD = [
    "  - referenceId: revenue-30d",
    "    overrideName: Revenue, last 30 days",
    "    columnName: net_revenue_30d",
    "    expression: SUM",
    "    format: NUMBER",
    '    suffix: " €"',
  ];

  const LAYOUT = [
    "apiVersion: v1",
    "kind: ObjectLayout",
    "referenceId: account-record",
    "name: Account page",
    "type: RECORD",
    "object: account",
    "isDefault: true",
    "rows:",
    "  - referenceId: row-kpis",
    "    name: KPIs",
    "    columns:",
    "      - referenceId: col-1",
    "        config: { size: 24 }",
    "        widgets:",
    "          - referenceId: w-orders",
    "            type: kpi",
    "            config:",
    '              columns: ["${table:account-table}.${metric:orders-90d}"]',
    "              label: Orders, last 90 days",
  ];
  const LAYOUT_ADD_AT = LAYOUT.length;
  const LAYOUT_ADD = [
    "          - referenceId: w-revenue-30d",
    "            type: kpi",
    "            config:",
    '              columns: ["${table:account-table}.${metric:revenue-30d}"]',
    "              label: Revenue, last 30 days",
    "              theme: yellow",
  ];

  const FILES = {
    "objects/account.yaml": { base: ACCOUNT, at: ACCOUNT_ADD_AT, add: ACCOUNT_ADD },
    "layouts/account/account-record.yaml": { base: LAYOUT, at: LAYOUT_ADD_AT, add: LAYOUT_ADD },
  };

  // ---------- yaml highlighting ----------
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function hlValue(v) {
    let out = esc(v);
    out = out.replace(/\$\{[a-z-]+:[a-z0-9_.-]+\}/g, (m) => `<span class="y-m">${m}</span>`);
    if (/^(".*"|'.*'|true|false|null|\d+|\[\])$/.test(v.trim())) return `<span class="y-v">${out}</span>`;
    return `<span class="y-s">${out}</span>`;
  }
  function hl(line) {
    const m = line.match(/^(\s*)(- )?([A-Za-z][\w-]*)(:)(.*)$/);
    if (!m) return esc(line);
    const [, ind, dash, key, colon, rest] = m;
    return (
      ind +
      (dash ? `<span class="y-p">- </span>` : "") +
      `<span class="y-k">${key}</span><span class="y-p">${colon}</span>` +
      (rest ? hlValue(rest) : "")
    );
  }

  // ---------- editor ----------
  let current = null; // { name, rows: [{text, add}] }
  function openFile(name, withAdds) {
    const f = FILES[name];
    const rows = f.base.map((t) => ({ text: t, add: false }));
    if (withAdds) rows.splice(f.at, 0, ...f.add.map((t) => ({ text: t, add: true })));
    current = { name, rows };
    [...tabsEl.children].forEach((t) => t.classList.toggle("on", t.dataset.file === name));
    statusFileEl.textContent = name;
    renderCode();
    codeEl.scrollTop = 0;
  }
  function renderCode() {
    codeEl.innerHTML = current.rows
      .map(
        (r, i) =>
          `<div class="row${r.add ? " add" : ""}"><span class="ln">${i + 1}</span><span class="gut">+</span><span class="tx">${hl(r.text)}</span></div>`
      )
      .join("");
  }
  function scrollToRow(i) {
    const row = codeEl.children[i];
    if (!row) return;
    const target = row.offsetTop - codeEl.clientHeight / 2;
    codeEl.scrollTo({ top: Math.max(0, target), behavior: reduced ? "auto" : "smooth" });
  }
  function markDirty(name, on) {
    const t = tabsEl.querySelector(`[data-file="${name}"]`);
    if (t) t.classList.toggle("dirty", on);
  }

  // ---------- terminal ----------
  function line(html = "") {
    const d = document.createElement("div");
    d.className = "l";
    d.innerHTML = html;
    termEl.appendChild(d);
    while (termEl.children.length > 60) termEl.removeChild(termEl.firstChild);
    return d;
  }
  const PROMPT_HTML = `<span class="cwd">~/acme</span> <span class="wly">[wly:acme/prod]</span> <span class="dol">$</span> `;
  function clearTerm() { termEl.innerHTML = ""; }

  // ---------- steps ----------
  function step(n) {
    [...stepsEl.querySelectorAll("li[data-step]")].forEach((li) => li.classList.toggle("on", li.dataset.step === String(n)));
  }

  // ---------- the end user's phone ----------
  const KPI = 48210;
  const fmt = (n) => n.toLocaleString("fr-FR").replace(/\s/g, "\u202f") + " €";
  function fieldReset() {
    winEl.classList.remove("payoff");
    fieldEl.classList.remove("live", "settled");
    pValEl.textContent = fmt(0);
  }
  async function fieldLive(g) {
    winEl.classList.add("payoff");
    await sleep(600, g);
    fieldEl.classList.add("live");
    await sleep(350, g);
    const steps = 24;
    for (let i = 1; i <= steps; i++) {
      const t = 1 - Math.pow(1 - i / steps, 3);
      pValEl.textContent = fmt(Math.round((KPI * t) / 10) * 10);
      await sleep(38, g);
    }
    pValEl.textContent = fmt(KPI);
  }

  // ---------- run control ----------
  let paused = false;
  let gen = 0;
  let visible = true;
  const waiters = [];
  function canRun() { return !paused && visible && !document.hidden; }
  function wake() { if (canRun()) while (waiters.length) waiters.shift()(); }
  async function gate(g) {
    while (!canRun()) {
      await new Promise((r) => waiters.push(r));
      if (g !== gen) throw new Error("stop");
    }
    if (g !== gen) throw new Error("stop");
  }
  async function sleep(ms, g) {
    let left = ms;
    while (left > 0) {
      await gate(g);
      const chunk = Math.min(left, 100);
      await new Promise((r) => setTimeout(r, chunk));
      left -= chunk;
    }
    await gate(g);
  }
  async function type(el, text, g, speed = 34) {
    const caret = document.createElement("span");
    caret.className = "caret";
    const node = document.createElement("span");
    node.className = "cmd";
    el.appendChild(node);
    el.appendChild(caret);
    for (const ch of text) {
      node.textContent += ch;
      await sleep(speed + Math.random() * 30, g);
    }
    await sleep(260, g);
    caret.remove();
  }
  async function cmd(text, g) {
    const l = line(PROMPT_HTML);
    await type(l, text, g);
  }
  async function out(lines, g, gap = 90) {
    for (const h of lines) {
      line(h);
      await sleep(gap, g);
    }
  }

  // ---------- script ----------
  const PULL_OUT = [
    `<span class="dim">Pulling from 'prod' (acme-prod on whaly.io)…</span>`,
    `Pulled 6 sources to ./sources/ <span class="dim">(6 unchanged)</span>`,
    `Pulled 24 objects to ./objects/ <span class="dim">(1 updated, 23 unchanged)</span>`,
    `Pulled 9 object links to ./object-links/ <span class="dim">(9 unchanged)</span>`,
    `Pulled 31 layouts to ./layouts/ <span class="dim">(31 unchanged)</span>`,
    `Pulled 47 models to ./models/ <span class="dim">(files: 94 unchanged)</span>`,
    `<span class="ok">✓</span> CLAUDE.md and .claude/skills/using-wlyctl/ regenerated`,
  ];

  async function editFile(name, g) {
    const f = FILES[name];
    openFile(name, false);
    await sleep(350, g);
    markDirty(name, true);
    scrollToRow(f.at);
    for (let i = 0; i < f.add.length; i++) {
      current.rows.splice(f.at + i, 0, { text: f.add[i], add: true });
      renderCode();
      scrollToRow(f.at + i);
      await sleep(210, g);
    }
  }

  async function iteration(k, g) {
    const agent = AGENTS[k % AGENTS.length];
    clearTerm();
    markDirty("objects/account.yaml", false);
    markDirty("layouts/account/account-record.yaml", false);
    openFile("objects/account.yaml", false);
    fieldReset();

    // 1. pull
    step(1);
    await sleep(500, g);
    await cmd("wlyctl pull", g);
    await sleep(350, g);
    await out(PULL_OUT, g, 150);
    await sleep(700, g);

    // 2. agent
    step(2);
    await cmd(`${agent.cmd} "${PROMPT}"`, g);
    await sleep(500, g);
    await out([`<span class="ag">● ${agent.label}</span> <span class="dim">loaded CLAUDE.md · skill using-wlyctl</span>`], g);
    await sleep(500, g);
    await out([`  <span class="ag">⏺</span> Read <span class="b">objects/account.yaml</span>`], g);
    await sleep(400, g);
    const e1 = line(`  <span class="ag">⏺</span> Edit <span class="b">objects/account.yaml</span>`);
    await editFile("objects/account.yaml", g);
    e1.innerHTML += ` <span class="ok">+6</span>`;
    await sleep(400, g);
    const e2 = line(`  <span class="ag">⏺</span> Edit <span class="b">layouts/account/account-record.yaml</span>`);
    await editFile("layouts/account/account-record.yaml", g);
    e2.innerHTML += ` <span class="ok">+6</span>`;
    await sleep(400, g);
    await out([`  <span class="ag">⏺</span> Bash <span class="b">wlyctl diff --json</span> <span class="dim">→ ok, 2 to update, 0 blocked</span>`], g);
    await sleep(500, g);
    await out([`  Done. Review with <span class="b">wlyctl diff</span>, then push.`], g);
    await sleep(1100, g);

    // 3. push
    step(3);
    await cmd("wlyctl push", g);
    await sleep(500, g);
    await out(
      [
        `<span class="b">Object "Account" will be updated:</span>`,
        `  <span class="ok">+ Metrics added: revenue-30d</span>`,
        `<span class="b">Layout "Account page" will be updated:</span>`,
        `  Rows:`,
        `    <span class="warn">~ Row "KPIs":</span>`,
        `        <span class="warn">changed fields: columns</span>`,
      ],
      g,
      110
    );
    await sleep(300, g);
    const c = line(`Type "acme" to confirm: `);
    await sleep(500, g);
    await type(c, "acme", g, 70);
    const q = line(`Apply 2 document(s) to 'prod'? <span class="dim">(y/N)</span> `);
    await sleep(500, g);
    await type(q, "y", g);
    await out(
      [
        `<span class="ok">✓</span> objects/account.yaml <span class="dim">updated</span>`,
        `<span class="ok">✓</span> layouts/account/account-record.yaml <span class="dim">updated</span>`,
      ],
      g,
      220
    );
    markDirty("objects/account.yaml", false);
    markDirty("layouts/account/account-record.yaml", false);

    // 4. your users
    step(4);
    await fieldLive(g);
    await sleep(1600, g);
    fieldEl.classList.add("settled");
    await cmd(`git commit -qam "Account: 30-day revenue KPI"`, g);
    await sleep(3400, g);
    fieldReset();
    await sleep(600, g);
  }

  async function run() {
    const g = ++gen;
    try {
      for (let k = 0; ; k++) await iteration(k, g);
    } catch (e) {
      if (e.message !== "stop") throw e;
    }
  }

  function renderStatic() {
    // Final frame of one iteration, no motion.
    step(3);
    clearTerm();
    line(PROMPT_HTML + `<span class="cmd">wlyctl pull</span>`);
    PULL_OUT.slice(1, 3).concat(PULL_OUT[6]).forEach((h) => line(h));
    line(PROMPT_HTML + `<span class="cmd">claude "${PROMPT}"</span>`);
    line(`  <span class="ag">⏺</span> Edit <span class="b">objects/account.yaml</span> <span class="ok">+6</span>`);
    line(`  <span class="ag">⏺</span> Edit <span class="b">layouts/account/account-record.yaml</span> <span class="ok">+6</span>`);
    line(`  <span class="ag">⏺</span> Bash <span class="b">wlyctl diff --json</span> <span class="dim">→ ok, 2 to update</span>`);
    line(PROMPT_HTML + `<span class="cmd">wlyctl push</span>`);
    line(`  <span class="ok">+ Metrics added: revenue-30d</span>`);
    line(`Type "acme" to confirm: <span class="cmd">acme</span>`);
    line(`Apply 2 document(s) to 'prod'? <span class="dim">(y/N)</span> <span class="cmd">y</span>`);
    line(`<span class="ok">✓</span> objects/account.yaml <span class="dim">updated</span>`);
    line(`<span class="ok">✓</span> layouts/account/account-record.yaml <span class="dim">updated</span>`);
    step(4);
    winEl.classList.add("payoff");
    fieldEl.classList.add("live", "settled");
    pValEl.textContent = fmt(KPI);
    openFile("objects/account.yaml", true);
    scrollToRow(ACCOUNT_ADD_AT);
  }

  // tabs are clickable at any time
  tabsEl.addEventListener("click", (e) => {
    const t = e.target.closest("[data-file]");
    if (!t) return;
    const name = t.dataset.file;
    if (current && current.name === name) return;
    const dirty = t.classList.contains("dirty") || reduced;
    openFile(name, dirty);
  });

  if (reduced) {
    renderStatic();
    pauseBtn.hidden = true;
    replayBtn.addEventListener("click", () => {
      pauseBtn.hidden = false;
      run();
    });
    return;
  }

  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    pauseBtn.textContent = paused ? "Play" : "Pause";
    pauseBtn.setAttribute("aria-pressed", String(paused));
    wake();
  });
  replayBtn.addEventListener("click", () => {
    paused = false;
    pauseBtn.textContent = "Pause";
    pauseBtn.setAttribute("aria-pressed", "false");
    gen++;
    while (waiters.length) waiters.shift()();
    run();
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      visible = entries.some((en) => en.isIntersecting);
      wake();
    }).observe(termEl);
  }
  document.addEventListener("visibilitychange", wake);

  run();
})();
