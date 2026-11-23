(() => {
  'use strict';

  const STORE_KEY = 'payoff-explorer-v1';
  const PALETTE_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
  const PALETTE_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'];
  const DASHES = [[], [7, 4], [2, 3], [10, 3, 2, 3], [12, 6], [4, 2, 1, 2], [6, 2], [14, 3, 3, 3]];
  const MEAN_DASH = [1, 4];
  const VIEWS = [
    ['single', 'This profile'],
    ['overlay', 'All profiles overlaid'],
    ['multiples', 'Side by side'],
    ['meansd', 'Mean vs risk'],
    ['table', 'Summary table'],
  ];

  const $ = (id) => document.getElementById(id);
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const uid = () => 'p' + Math.random().toString(36).slice(2, 10);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const toNum = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  // ---------- Theme ----------
  function isDark() {
    const mode = document.documentElement.dataset.mode;
    if (mode) return mode === 'dark';
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  const palette = () => (isDark() ? PALETTE_DARK : PALETTE_LIGHT);
  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function chrome() {
    const dark = isDark();
    return {
      ink: cssVar('--text-secondary', dark ? '#c3c2b7' : '#52514e'),
      muted: cssVar('--text-muted', '#898781'),
      grid: dark ? '#2c2c2a' : '#e1e0d9',
      bg: cssVar('--surface-1', dark ? '#181818' : '#ffffff'),
      mean: dark ? '#c3c2b7' : '#52514e',
    };
  }

  // ---------- Model ----------
  const makeState = (label, prob, blue, ret, cash = 0) => ({ label, prob, blue, ret, cash });
  const makeProfile = (name, states, color) => ({
    id: uid(), name, color, endowment: 100, maxInvest: 100, compare: true, states,
  });

  // Default profiles. Every profile has the same four equally likely states, A to D:
  // Blue is high in A and B and low in C and D; only the asset return pattern changes.
  function examples() {
    return [
      makeProfile('Fixed Blue', [
        makeState('A', 25, 2000, 250),
        makeState('B', 25, 2000, -100),
        makeState('C', 25, 2000, 250),
        makeState('D', 25, 2000, -100),
      ], 0),
      makeProfile('Correlation +1', [
        makeState('A', 25, 2200, 250),
        makeState('B', 25, 2200, 250),
        makeState('C', 25, 1800, -100),
        makeState('D', 25, 1800, -100),
      ], 1),
      makeProfile('Correlation 0', [
        makeState('A', 25, 2200, 250),
        makeState('B', 25, 2200, -100),
        makeState('C', 25, 1800, 250),
        makeState('D', 25, 1800, -100),
      ], 2),
      makeProfile('Correlation −1', [
        makeState('A', 25, 2200, -100),
        makeState('B', 25, 2200, -100),
        makeState('C', 25, 1800, 250),
        makeState('D', 25, 1800, 250),
      ], 3),
    ];
  }

  const stateName = (i) => (i < 26 ? String.fromCharCode(65 + i) : `State ${i + 1}`);

  function defaultModel() {
    const profiles = examples();
    return {
      settings: { tokenValue: 0.01, unit: 'tokens' },
      profiles,
      selected: profiles[2].id,
      view: 'single',
      showMean: true,
      evalX: 100,
    };
  }

  function sanitizeProfiles(list) {
    if (!Array.isArray(list) || !list.length) throw new Error('no profiles were found in it.');
    const used = new Set();
    return list.map((p, i) => {
      if (!p || !Array.isArray(p.states) || !p.states.length) throw new Error(`profile ${i + 1} has no states.`);
      const id = typeof p.id === 'string' && p.id && !used.has(p.id) ? p.id : uid();
      used.add(id);
      return {
        id,
        name: typeof p.name === 'string' ? p.name : `Profile ${i + 1}`,
        color: Number.isInteger(p.color) && p.color >= 0 ? p.color : i % 8,
        endowment: toNum(p.endowment),
        maxInvest: toNum(p.maxInvest),
        compare: p.compare !== false,
        states: p.states.map((s, j) => ({
          label: s && typeof s.label === 'string' ? s.label : `State ${j + 1}`,
          prob: toNum(s && s.prob),
          blue: toNum(s && s.blue),
          ret: toNum(s && s.ret),
          cash: toNum(s && s.cash !== undefined ? s.cash : 0),
        })),
      };
    });
  }

  function applySettings(m, settings) {
    if (!settings) return;
    const tv = toNum(settings.tokenValue);
    if (tv !== null && tv >= 0) m.settings.tokenValue = tv;
    m.settings.unit = settings.unit === 'dollars' ? 'dollars' : 'tokens';
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        const m = defaultModel();
        m.profiles = sanitizeProfiles(saved.profiles);
        applySettings(m, saved.settings);
        m.selected = m.profiles.some((p) => p.id === saved.selected) ? saved.selected : m.profiles[0].id;
        m.view = VIEWS.some((v) => v[0] === saved.view) ? saved.view : 'single';
        m.showMean = saved.showMean !== false;
        const ex = toNum(saved.evalX);
        m.evalX = ex !== null ? ex : 100;
        return m;
      }
    } catch (e) {
      // Storage unavailable or corrupted: start from the examples.
    }
    return defaultModel();
  }

  function save() {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(M));
    } catch (e) {
      // Storage unavailable (private mode, sandboxed preview): keep working in memory.
    }
  }

  let M = load();
  const selected = () => M.profiles.find((p) => p.id === M.selected) || M.profiles[0];

  // ---------- Maths ----------
  const probTotal = (p) => p.states.reduce((a, s) => a + (isNum(s.prob) ? s.prob : 0), 0);
  const fieldsOk = (p) => isNum(p.endowment) && isNum(p.maxInvest) && p.states.length > 0 &&
    p.states.every((s) => isNum(s.prob) && isNum(s.blue) && isNum(s.ret) && isNum(s.cash));
  const profileOk = (p) => fieldsOk(p) && probTotal(p) > 0;
  const payoff = (p, s, x) => s.blue + (p.endowment - x) * (1 + s.cash / 100) + x * (1 + s.ret / 100);
  const weight = (p, s) => s.prob / probTotal(p);

  function moments(p, x) {
    let mean = 0;
    p.states.forEach((s) => { mean += weight(p, s) * payoff(p, s, x); });
    let v = 0;
    p.states.forEach((s) => { v += weight(p, s) * (payoff(p, s, x) - mean) ** 2; });
    return { mean, sd: Math.sqrt(Math.max(v, 0)) };
  }

  // Marginal distribution at x: identical outcomes from different states are merged.
  function distribution(p, x) {
    const out = [];
    p.states.forEach((s) => {
      const v = payoff(p, s, x);
      const hit = out.find((o) => Math.abs(o.v - v) < 1e-9);
      if (hit) { hit.w += weight(p, s); hit.labels.push(s.label); } else out.push({ v, w: weight(p, s), labels: [s.label] });
    });
    return out.sort((a, b) => b.v - a.v);
  }

  function rangeOverX(p) {
    let lo = Infinity;
    let hi = -Infinity;
    p.states.forEach((s) => [0, p.maxInvest].forEach((x) => {
      const v = payoff(p, s, x);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }));
    return [lo, hi];
  }

  const sample = (X, n) => Array.from({ length: n + 1 }, (_, i) => (X * i) / n);

  // ---------- Formatting ----------
  const tokenValue = () => (isNum(M.settings.tokenValue) && M.settings.tokenValue >= 0 ? M.settings.tokenValue : null);
  const inDollars = () => M.settings.unit === 'dollars' && tokenValue() !== null;
  const conv = (v) => (inDollars() ? v * tokenValue() : v);
  const unitLabel = () => (inDollars() ? 'dollars' : 'tokens');
  const fmtNum = (v, d = 2) => Number(v).toLocaleString(undefined, { maximumFractionDigits: d });
  const fmtMoney = (d) => (d < 0 ? '-' : '') + '$' + Math.abs(d).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtUSD = (tokens) => (tokenValue() === null ? '' : fmtMoney(tokens * tokenValue()));
  const fmtAmt = (v) => (inDollars() ? fmtMoney(v) : fmtNum(v));
  const fmtPct = (w) => fmtNum(w * 100, 2) + '%';

  function niceStep(range) {
    if (!(range > 0)) return 1;
    const raw = range / 5;
    const pow = 10 ** Math.floor(Math.log10(raw));
    const n = raw / pow;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * pow;
  }

  // ---------- Profiles list ----------
  function renderList() {
    const pal = palette();
    $('profileList').innerHTML = M.profiles.map((p) => `
      <li>
        <button type="button" class="pick" data-pick="${esc(p.id)}" aria-pressed="${p.id === M.selected}">
          <span class="swatch" style="background:${pal[p.color % 8]}"></span>
          <span class="pname">${esc(p.name.trim() || 'Untitled')}</span>
          ${profileOk(p) ? '' : '<span class="flag">needs fixing</span>'}
        </button>
        <label class="cmp" title="Include in the comparison views"><input type="checkbox" data-cmp="${esc(p.id)}" ${p.compare ? 'checked' : ''}> Compare</label>
      </li>`).join('');
  }

  // ---------- Editor ----------
  const numAttrs = (value) => `type="number" step="any" inputmode="decimal" value="${isNum(value) ? value : ''}"`;
  const tokenInput = (attrs, value) => `<span class="iw tok"><input ${numAttrs(value)} ${attrs}><span class="adorn">tokens</span></span>`;
  const pctInput = (attrs, value) => `<span class="iw pct"><input ${numAttrs(value)} ${attrs}><span class="adorn">%</span></span>`;

  function renderEditor() {
    const p = selected();
    const rows = p.states.map((s, i) => {
      const n = i + 1;
      return `
      <tr>
        <td><input type="text" data-s="${i}" data-k="label" value="${esc(s.label)}" maxlength="60" aria-label="State ${n} label"></td>
        <td>${pctInput(`data-s="${i}" data-k="prob" min="0" max="100" aria-label="State ${n} probability"`, s.prob)}</td>
        <td>${tokenInput(`data-s="${i}" data-k="blue" aria-label="State ${n} Blue amount"`, s.blue)}<small class="hint" data-hint-s="${i}"></small></td>
        <td>${pctInput(`data-s="${i}" data-k="ret" aria-label="State ${n} asset return"`, s.ret)}</td>
        <td>${pctInput(`data-s="${i}" data-k="cash" aria-label="State ${n} return on uninvested tokens"`, s.cash)}</td>
        <td><button type="button" class="icon" data-act="delState" data-i="${i}" aria-label="Remove state ${n}" title="Remove state">&times;</button></td>
      </tr>`;
    }).join('');

    $('editor').innerHTML = `
      <div class="fields">
        <label class="field name">Profile name
          <input type="text" data-k="name" value="${esc(p.name)}" maxlength="60">
        </label>
        <label class="field">Orange endowment (E)
          ${tokenInput('data-k="endowment" min="0"', p.endowment)}
          <small class="hint" data-hint="endowment"></small>
        </label>
        <label class="field">Max in the risky asset (x)
          ${tokenInput('data-k="maxInvest" min="0"', p.maxInvest)}
          <small class="hint" data-hint="maxInvest"></small>
        </label>
      </div>
      <div class="states-wrap">
        <table class="states">
          <thead><tr>
            <th scope="col">State</th>
            <th scope="col">Probability</th>
            <th scope="col">Blue amount</th>
            <th scope="col" title="Return on each token put in the risky asset">Asset return</th>
            <th scope="col" title="Return on the Orange tokens not put in the asset (0% = cash)">Uninvested return</th>
            <th scope="col"><span class="sr-only">Remove</span></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="btns">
        <button type="button" data-act="addState">Add state</button>
        <button type="button" data-act="equalize">Equal probabilities</button>
      </div>
      <p class="msg" id="profileMsg" aria-live="polite"></p>`;

    $('editor').querySelectorAll('input[type="number"]').forEach((el) => {
      const bad = el.value === '';
      el.classList.toggle('invalid', bad);
      el.setAttribute('aria-invalid', String(bad));
    });
    updateHints();
    updateProfileMsg();
  }

  function updateHints() {
    const p = selected();
    const tv = tokenValue();
    document.querySelectorAll('[data-hint]').forEach((el) => {
      const v = p[el.dataset.hint];
      el.textContent = isNum(v) && tv !== null ? '= ' + fmtUSD(v) : '';
    });
    document.querySelectorAll('[data-hint-s]').forEach((el) => {
      const s = p.states[Number(el.dataset.hintS)];
      el.textContent = s && isNum(s.blue) && tv !== null ? '= ' + fmtUSD(s.blue) : '';
    });
    $('tokenHint').textContent = tv !== null ? `1,000 tokens = ${fmtUSD(1000)}` : 'Enter a value of 0 or more';
  }

  function updateProfileMsg(extra) {
    const el = $('profileMsg');
    if (!el) return;
    const p = selected();
    const msgs = [];
    if (extra) msgs.push(extra);
    if (!fieldsOk(p)) {
      msgs.push(['danger', 'Enter a number in each highlighted field. Probabilities go from 0% to 100%, and amounts can’t be negative.']);
    } else {
      const tot = probTotal(p);
      if (tot <= 0) msgs.push(['danger', 'At least one state needs a probability above 0%.']);
      else if (Math.abs(tot - 100) > 0.01) msgs.push(['warning', `Probabilities add up to ${fmtNum(tot)}%. The charts rescale them so they add up to 100%.`]);
      if (p.maxInvest > p.endowment) msgs.push(['warning', 'The max in the risky asset is above the endowment, so the extra tokens are borrowed at the uninvested return.']);
    }
    el.innerHTML = msgs.map(([t, m]) => `<span class="${t}">${esc(m)}</span>`).join('<br>');
  }

  function validField(k, v) {
    if (!Number.isFinite(v)) return false;
    if (k === 'prob') return v >= 0 && v <= 100;
    if (k === 'endowment' || k === 'maxInvest') return v >= 0;
    return true;
  }

  // ---------- Charts ----------
  let charts = [];
  let mainChart = null;

  const bgPlugin = {
    id: 'solidBackground',
    beforeDraw(chart) {
      const { ctx } = chart;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = chrome().bg;
      ctx.fillRect(0, 0, chart.width, chart.height);
      ctx.restore();
    },
  };

  function destroyCharts() {
    charts.forEach((c) => c.destroy());
    charts = [];
    mainChart = null;
  }

  function newChart(canvas, datasets, options) {
    const ch = new Chart(canvas, { type: 'line', data: { datasets }, options, plugins: [bgPlugin] });
    charts.push(ch);
    return ch;
  }

  function opts({ xTitle, yTitle, xAmt = false, mode = 'nearest', label, title, xMin = 0, xMax, yMin, yMax }) {
    const c = chrome();
    const axis = (text, amt) => ({
      type: 'linear',
      title: { display: true, text, color: c.ink },
      grid: { color: c.grid },
      border: { color: c.grid },
      ticks: Object.assign({ color: c.muted }, amt ? { callback: (v) => fmtAmt(v) } : {}),
    });
    const o = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode, intersect: false, axis: mode === 'index' ? 'x' : 'xy' },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: title || ((items) => (items.length ? `x = ${fmtNum(items[0].parsed.x)} tokens` : '')),
            label: label || ((ctx) => `${ctx.dataset.label}: ${fmtAmt(ctx.parsed.y)}`),
          },
        },
      },
      scales: { x: axis(xTitle, xAmt), y: axis(yTitle, true) },
    };
    if (xMin !== undefined) o.scales.x.min = xMin;
    if (xMax !== undefined && xMax > 0) o.scales.x.max = xMax;
    if (yMin !== undefined) { o.scales.y.min = yMin; o.scales.y.max = yMax; }
    return o;
  }

  const endpointRadii = (n, r) => Array.from({ length: n }, (_, i) => (i === 0 || i === n - 1 ? r : 0));

  function stateDatasets(p, colorFor, dashFor, prefix = '') {
    const xs = sample(p.maxInvest, 20);
    return p.states.map((s, i) => {
      const col = colorFor(i);
      return {
        label: `${prefix}${s.label || 'State ' + (i + 1)} (${fmtPct(weight(p, s))})`,
        data: xs.map((x) => ({ x, y: conv(payoff(p, s, x)) })),
        borderColor: col,
        backgroundColor: col,
        borderDash: dashFor(i),
        borderWidth: 2.5,
        pointRadius: endpointRadii(xs.length, 3.5),
        pointHoverRadius: 5,
        tension: 0,
      };
    });
  }

  function meanDataset(p, color, prefix = '') {
    const xs = sample(p.maxInvest, 20);
    return {
      label: `${prefix}Mean`,
      data: xs.map((x) => ({ x, y: conv(moments(p, x).mean) })),
      borderColor: color,
      backgroundColor: color,
      borderDash: MEAN_DASH,
      borderWidth: 1.75,
      pointRadius: 0,
      pointHoverRadius: 3,
      tension: 0,
    };
  }

  const stateDash = (i) => DASHES[(i + Math.floor(i / DASHES.length)) % DASHES.length];

  const lineSample = (color, dash, w = 2.5) => `<svg width="28" height="10" aria-hidden="true"><line x1="1" y1="5" x2="27" y2="5" stroke="${color}" stroke-width="${w}"${dash && dash.length ? ` stroke-dasharray="${dash.join(' ')}"` : ''}/></svg>`;
  const legendItems = (items) => items.map((it) => `<span class="item">${lineSample(it.color, it.dash, it.w)}${esc(it.label)}</span>`).join('');

  function comparedSplit() {
    const c = M.profiles.filter((p) => p.compare);
    return { ok: c.filter(profileOk), skipped: c.filter((p) => !profileOk(p)) };
  }
  const skippedNote = (skipped) => (skipped.length
    ? `Left out because some fields need fixing: ${skipped.map((p) => `“${p.name || 'Untitled'}”`).join(', ')}.`
    : '');
  const noneNote = (skipped) => skippedNote(skipped) || 'Tick “Compare” next to at least one profile to include it here.';
  const setNote = (t) => { $('viewNote').textContent = t; };

  function sharedYRange(ok) {
    let lo = Infinity;
    let hi = -Infinity;
    ok.forEach((p) => {
      const [a, b] = rangeOverX(p);
      lo = Math.min(lo, conv(a));
      hi = Math.max(hi, conv(b));
    });
    const step = niceStep(hi - lo || Math.abs(hi) || 1);
    let yMin = Math.floor(lo / step) * step;
    let yMax = Math.ceil(hi / step) * step;
    if (yMin === lo) yMin -= step / 2;
    if (yMax === hi) yMax += step / 2;
    return { yMin, yMax };
  }

  function drawSingle() {
    const p = selected();
    if (!profileOk(p)) {
      setNote(`“${p.name || 'Untitled'}” has fields that need fixing, so there is nothing to draw yet.`);
      return;
    }
    const pal = palette();
    const ds = stateDatasets(p, (i) => pal[i % pal.length], stateDash);
    if (M.showMean) ds.push(meanDataset(p, chrome().mean));
    $('mainChart').setAttribute('aria-label', `Final amount in each state of ${p.name} against tokens in the risky asset`);
    mainChart = newChart($('mainChart'), ds, opts({
      xTitle: 'Tokens in the risky asset (x)',
      yTitle: `Final amount (${unitLabel()})`,
      mode: 'index',
      xMax: p.maxInvest,
    }));
    $('legend').innerHTML = legendItems(ds.map((d) => ({ color: d.borderColor, dash: d.borderDash, label: d.label, w: d.borderWidth })));
  }

  function drawOverlay() {
    const { ok, skipped } = comparedSplit();
    if (!ok.length) { setNote(noneNote(skipped)); return; }
    const pal = palette();
    const ds = [];
    const groups = [];
    ok.forEach((p) => {
      const col = pal[p.color % pal.length];
      const prefix = `${p.name} · `;
      const sds = stateDatasets(p, () => col, stateDash, prefix);
      ds.push(...sds);
      const items = sds.map((d) => ({ color: col, dash: d.borderDash, label: d.label.slice(prefix.length) }));
      if (M.showMean) {
        ds.push(meanDataset(p, col, prefix));
        items.push({ color: col, dash: MEAN_DASH, label: 'Mean', w: 1.75 });
      }
      groups.push({ name: p.name, color: col, items });
    });
    $('mainChart').setAttribute('aria-label', 'Final amount in every state of every compared profile against tokens in the risky asset');
    mainChart = newChart($('mainChart'), ds, opts({
      xTitle: 'Tokens in the risky asset (x)',
      yTitle: `Final amount (${unitLabel()})`,
      xMax: Math.max(...ok.map((p) => p.maxInvest)),
    }));
    $('legend').innerHTML = groups.map((g) => `
      <div class="lg-group"><span class="lg-title"><span class="swatch" style="background:${g.color}"></span>${esc(g.name)}</span>${legendItems(g.items)}</div>`).join('');
    setNote([skippedNote(skipped), 'Identical lines from different profiles sit on top of each other; use “Side by side” to see each profile on its own.'].filter(Boolean).join(' '));
  }

  function drawMultiples() {
    const { ok, skipped } = comparedSplit();
    if (!ok.length) { setNote(noneNote(skipped)); return; }
    const pal = palette();
    const meanCol = chrome().mean;
    const { yMin, yMax } = sharedYRange(ok);
    const xMax = Math.max(...ok.map((p) => p.maxInvest));
    $('multiples').innerHTML = ok.map((p, k) => `
      <figure class="mult">
        <figcaption><span class="swatch" style="background:${pal[p.color % pal.length]}"></span>${esc(p.name)}</figcaption>
        <div class="legend" id="multLegend${k}"></div>
        <div class="mult-chart"><canvas id="multChart${k}" role="img" aria-label="Final amount per state for ${esc(p.name)}"></canvas></div>
      </figure>`).join('');
    ok.forEach((p, k) => {
      const ds = stateDatasets(p, (i) => pal[i % pal.length], stateDash);
      if (M.showMean) ds.push(meanDataset(p, meanCol));
      newChart($('multChart' + k), ds, opts({
        xTitle: 'Tokens in the risky asset (x)',
        yTitle: unitLabel(),
        mode: 'index',
        xMax,
        yMin,
        yMax,
      }));
      $('multLegend' + k).innerHTML = legendItems(ds.map((d) => ({ color: d.borderColor, dash: d.borderDash, label: d.label, w: d.borderWidth })));
    });
    setNote([skippedNote(skipped), 'All panels share the same axes.'].filter(Boolean).join(' '));
  }

  function drawMeanSd() {
    const { ok, skipped } = comparedSplit();
    if (!ok.length) { setNote(noneNote(skipped)); return; }
    const pal = palette();
    const ds = ok.map((p) => {
      const col = pal[p.color % pal.length];
      const xs = sample(p.maxInvest, 40);
      const data = xs.map((x) => {
        const m = moments(p, x);
        return { x: conv(m.sd), y: conv(m.mean), inv: x };
      });
      return {
        label: p.name,
        data,
        borderColor: col,
        backgroundColor: col,
        borderDash: DASHES[p.color % DASHES.length],
        borderWidth: 2.5,
        pointRadius: endpointRadii(data.length, 5),
        pointStyle: data.map((_, i) => (i === data.length - 1 ? 'rectRot' : 'circle')),
        pointHoverRadius: 5,
        tension: 0,
      };
    });
    $('mainChart').setAttribute('aria-label', 'Mean against standard deviation of the final amount for each compared profile as x goes from 0 to its maximum');
    mainChart = newChart($('mainChart'), ds, opts({
      xTitle: `Standard deviation of the final amount (${unitLabel()})`,
      yTitle: `Mean final amount (${unitLabel()})`,
      xAmt: true,
      title: (items) => (items.length ? `${items[0].dataset.label}, x = ${fmtNum(items[0].raw.inv)} tokens` : ''),
      label: (ctx) => `Mean ${fmtAmt(ctx.parsed.y)}, standard deviation ${fmtAmt(ctx.parsed.x)}`,
    }));
    const ink = chrome().ink;
    $('legend').innerHTML = legendItems(ds.map((d) => ({ color: d.borderColor, dash: d.borderDash, label: d.label }))) +
      `<span class="item"><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="${ink}"/></svg>x = 0</span>` +
      `<span class="item"><svg width="12" height="12" aria-hidden="true"><rect x="2.5" y="2.5" width="7" height="7" transform="rotate(45 6 6)" fill="${ink}"/></svg>x = max</span>`;
    setNote(skippedNote(skipped));
  }

  function drawTable() {
    const { ok, skipped } = comparedSplit();
    if (!ok.length) { setNote(noneNote(skipped)); return; }
    const pal = palette();
    const xq = isNum(M.evalX) && M.evalX >= 0 ? M.evalX : 0;
    const rows = ok.map((p) => {
      const x = Math.min(xq, p.maxInvest);
      const dist = distribution(p, x);
      const m = moments(p, x);
      const [lo, hi] = rangeOverX(p);
      const outcomes = dist.map((o) => `<span title="${esc(o.labels.join(', '))}">${fmtAmt(conv(o.v))} <small>(${fmtPct(o.w)})</small></span>`).join('<br>');
      return `<tr>
        <th scope="row"><span class="swatch" style="background:${pal[p.color % pal.length]}"></span>${esc(p.name)}</th>
        <td>${fmtNum(x)}${x !== xq ? '<br><small>capped at max</small>' : ''}</td>
        <td>${outcomes}</td>
        <td>${fmtAmt(conv(m.mean))}</td>
        <td>${fmtAmt(conv(m.sd))}</td>
        <td>${fmtAmt(conv(dist[dist.length - 1].v))} to ${fmtAmt(conv(dist[0].v))}</td>
        <td>${fmtAmt(conv(lo))} to ${fmtAmt(conv(hi))}</td>
      </tr>`;
    }).join('');
    $('tableWrap').innerHTML = `
      <table class="summary">
        <thead><tr>
          <th scope="col">Profile</th>
          <th scope="col">x (tokens)</th>
          <th scope="col">Outcomes at x (probability)</th>
          <th scope="col">Mean</th>
          <th scope="col">Standard deviation</th>
          <th scope="col">Range at x</th>
          <th scope="col">Range over all x</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    setNote([skippedNote(skipped), `Amounts in ${unitLabel()}. States with the same final amount are merged, so each row is the marginal distribution.`].filter(Boolean).join(' '));
  }

  function renderTabs() {
    $('viewTabs').innerHTML = VIEWS.map(([k, label]) => `<button type="button" data-view="${k}" aria-pressed="${M.view === k}">${label}</button>`).join('');
  }

  function renderView() {
    destroyCharts();
    const v = M.view;
    $('viewTabs').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
    const chartViews = ['single', 'overlay', 'meansd'];
    $('chartWrap').hidden = !chartViews.includes(v);
    $('multiples').hidden = v !== 'multiples';
    $('tableWrap').hidden = v !== 'table';
    $('meanOpt').hidden = !['single', 'overlay', 'multiples'].includes(v);
    $('evalOpt').hidden = v !== 'table';
    $('pngBtn').hidden = !chartViews.includes(v);
    $('legend').innerHTML = '';
    $('multiples').innerHTML = '';
    $('tableWrap').innerHTML = '';
    setNote('');
    if (typeof Chart === 'undefined' && v !== 'table') {
      setNote('The chart library didn’t load. Check your internet connection and reload the page.');
      return;
    }
    ({ single: drawSingle, overlay: drawOverlay, multiples: drawMultiples, meansd: drawMeanSd, table: drawTable })[v]();
  }

  function renderSettings() {
    $('tokenValue').value = isNum(M.settings.tokenValue) ? M.settings.tokenValue : '';
    $('unit').value = M.settings.unit;
    $('showMean').checked = M.showMean;
    $('evalX').value = isNum(M.evalX) ? M.evalX : '';
  }

  function renderAll() {
    renderSettings();
    renderList();
    renderEditor();
    renderTabs();
    renderView();
  }

  // ---------- Helpers for buttons ----------
  function download(href, name, revoke) {
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (revoke) setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  function fileMsg(text, kind) {
    $('fileMsg').innerHTML = text ? `<span class="${kind || ''}">${esc(text)}</span>` : '';
  }

  function twoStep(btn, confirmLabel, guard, action) {
    const label = btn.textContent;
    let timer = null;
    const disarm = () => {
      btn.dataset.armed = '';
      btn.textContent = label;
      btn.classList.remove('armed');
    };
    btn.addEventListener('click', () => {
      const problem = guard ? guard() : null;
      if (problem) { fileMsg(problem, 'warning'); return; }
      if (btn.dataset.armed === '1') {
        clearTimeout(timer);
        disarm();
        action();
        return;
      }
      btn.dataset.armed = '1';
      btn.textContent = confirmLabel;
      btn.classList.add('armed');
      timer = setTimeout(disarm, 3000);
    });
  }

  function nextColor() {
    const used = new Set(M.profiles.map((p) => p.color % 8));
    for (let i = 0; i < 8; i += 1) if (!used.has(i)) return i;
    return M.profiles.length % 8;
  }

  // ---------- Events ----------
  $('editor').addEventListener('input', (e) => {
    const t = e.target;
    const k = t.dataset.k;
    if (!k) return;
    const p = selected();
    const target = t.dataset.s !== undefined ? p.states[Number(t.dataset.s)] : p;
    if (!target) return;
    if (k === 'name' || k === 'label') {
      target[k] = t.value;
    } else {
      const v = t.value.trim() === '' ? NaN : Number(t.value);
      const ok = validField(k, v);
      t.classList.toggle('invalid', !ok);
      t.setAttribute('aria-invalid', String(!ok));
      target[k] = ok ? v : null;
      updateHints();
    }
    updateProfileMsg();
    renderList();
    renderView();
    save();
  });

  $('editor').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const p = selected();
    const act = b.dataset.act;
    if (act === 'addState') {
      const last = p.states[p.states.length - 1];
      p.states.push(makeState(stateName(p.states.length), 0, last && isNum(last.blue) ? last.blue : 2000, 0, 0));
    } else if (act === 'equalize') {
      const n = p.states.length;
      p.states.forEach((s) => { s.prob = Math.round((100 / n) * 10000) / 10000; });
    } else if (act === 'delState') {
      if (p.states.length <= 1) {
        updateProfileMsg(['warning', 'A profile needs at least one state.']);
        return;
      }
      p.states.splice(Number(b.dataset.i), 1);
    }
    renderEditor();
    renderList();
    renderView();
    save();
  });

  $('profileList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    M.selected = b.dataset.pick;
    renderList();
    renderEditor();
    if (M.view === 'single') renderView();
    save();
  });

  $('profileList').addEventListener('change', (e) => {
    const id = e.target.dataset.cmp;
    if (!id) return;
    const p = M.profiles.find((q) => q.id === id);
    if (p) p.compare = e.target.checked;
    renderView();
    save();
  });

  $('addProfile').addEventListener('click', () => {
    const p = makeProfile(`Profile ${M.profiles.length + 1}`, [
      makeState('A', 25, 2000, 250),
      makeState('B', 25, 2000, -100),
      makeState('C', 25, 2000, 250),
      makeState('D', 25, 2000, -100),
    ], nextColor());
    M.profiles.push(p);
    M.selected = p.id;
    renderList();
    renderEditor();
    renderView();
    save();
  });

  $('dupProfile').addEventListener('click', () => {
    const src = selected();
    const p = JSON.parse(JSON.stringify(src));
    p.id = uid();
    p.name = `${src.name} (copy)`;
    p.color = nextColor();
    M.profiles.splice(M.profiles.indexOf(src) + 1, 0, p);
    M.selected = p.id;
    renderList();
    renderEditor();
    renderView();
    save();
  });

  twoStep($('delProfile'), 'Click again to delete', () => (M.profiles.length <= 1 ? 'Keep at least one profile.' : null), () => {
    const idx = M.profiles.indexOf(selected());
    const name = selected().name;
    M.profiles.splice(idx, 1);
    M.selected = M.profiles[Math.max(0, idx - 1)].id;
    renderList();
    renderEditor();
    renderView();
    save();
    fileMsg(`Deleted “${name}”.`);
  });

  twoStep($('resetBtn'), 'Click again to reset', null, () => {
    M = defaultModel();
    renderAll();
    save();
    fileMsg('Profiles reset to the four examples.');
  });

  $('exportBtn').addEventListener('click', () => {
    const data = { app: 'payoff-explorer', version: 1, settings: M.settings, profiles: M.profiles };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    download(URL.createObjectURL(blob), 'payoff-profiles.json', true);
    fileMsg('Exported payoff-profiles.json.');
  });

  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result);
        M.profiles = sanitizeProfiles(d.profiles);
        applySettings(M, d.settings);
        M.selected = M.profiles[0].id;
        renderAll();
        save();
        fileMsg(`Loaded ${M.profiles.length} profile${M.profiles.length === 1 ? '' : 's'} from ${f.name}.`);
      } catch (err) {
        fileMsg(`Couldn’t read ${f.name}: ${err.message || 'it isn’t a valid profiles file.'}`, 'danger');
      }
      e.target.value = '';
    };
    reader.readAsText(f);
  });

  $('tokenValue').addEventListener('input', (e) => {
    const v = e.target.value.trim() === '' ? NaN : Number(e.target.value);
    const ok = Number.isFinite(v) && v >= 0;
    e.target.classList.toggle('invalid', !ok);
    e.target.setAttribute('aria-invalid', String(!ok));
    M.settings.tokenValue = ok ? v : null;
    updateHints();
    renderView();
    save();
  });

  $('unit').addEventListener('change', (e) => {
    M.settings.unit = e.target.value;
    renderView();
    save();
  });

  $('showMean').addEventListener('change', (e) => {
    M.showMean = e.target.checked;
    renderView();
    save();
  });

  $('evalX').addEventListener('input', (e) => {
    const v = e.target.value.trim() === '' ? NaN : Number(e.target.value);
    const ok = Number.isFinite(v) && v >= 0;
    e.target.classList.toggle('invalid', !ok);
    e.target.setAttribute('aria-invalid', String(!ok));
    if (ok) { M.evalX = v; renderView(); save(); }
  });

  $('viewTabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (!b) return;
    M.view = b.dataset.view;
    renderView();
    save();
  });

  $('pngBtn').addEventListener('click', () => {
    if (!mainChart) return;
    const viewName = (VIEWS.find((v) => v[0] === M.view) || ['', 'chart'])[1];
    const base = M.view === 'single' ? selected().name : viewName;
    download(mainChart.toBase64Image('image/png', 1), `${(base || 'chart').replace(/[^\w\-]+/g, '_')}.png`);
  });

  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const rerender = () => { renderList(); renderView(); };
    if (mq.addEventListener) mq.addEventListener('change', rerender);
  }

  renderAll();
})();
