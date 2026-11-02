/* Page logic for the Sisslerfeld digital twin (static, pre-computed results). */
(function () {
  'use strict';
  const DT = window.DT, C = window.DTC, CFG = window.DT_CONFIG || {};
  const $ = id => document.getElementById(id);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

  function showError(where, err) {
    console.error(where, err);
    const f = $('fatal');
    f.style.display = 'block';
    f.textContent = `Something went wrong while loading "${where}": ${err && err.message ? err.message : err}`;
  }

  const PAGE = document.body.dataset.page || 'home';      // home | data | today | sandbox | runs
  // links shared before the split into pages pointed at index.html?scenario=...
  if (PAGE === 'home' && new URLSearchParams(location.search).has('scenario')) {
    location.replace('sandbox.html' + location.search);
    return;
  }

  const M = DT.get('manifest');
  if (!M) { showError('manifest', new Error('data/manifest.js is missing')); return; }
  DT.version = M.built;

  const runsById = {};
  M.runs.forEach(r => { runsById[r.id] = r; });
  const defaults = {};
  M.params.forEach(p => { defaults[p.key] = p.default; });

  const loadRuns = ids => Promise.all(ids.map(id => DT.load('runs/' + id)));
  const keyOf = (profile, params) => [String(profile)].concat(M.param_order.slice(1).map(k => String(params[k]))).join('|');
  const lookup = (profile, params) => M.lookup[keyOf(profile, params)] || null;

  /* ------------------------------------------------------------ theme toggle */
  (function themeToggle() {
    const btn = $('theme-btn');
    const modes = ['auto', 'light', 'dark'];
    let mode = 'auto';
    try { mode = localStorage.getItem('dt-theme') || 'auto'; } catch (e) { /* storage may be blocked */ }
    const forced = new URLSearchParams(location.search).get('theme');       // ?theme=light|dark
    if (forced && modes.includes(forced)) mode = forced;
    if (!modes.includes(mode)) mode = 'auto';
    function apply(redraw) {
      if (mode === 'auto') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', mode);
      btn.textContent = 'Theme: ' + mode;
      try { localStorage.setItem('dt-theme', mode); } catch (e) { /* ignore */ }
      if (redraw) C.rerenderAll();
    }
    btn.addEventListener('click', () => { mode = modes[(modes.indexOf(mode) + 1) % modes.length]; apply(true); });
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const h = () => { if (mode === 'auto') C.rerenderAll(); };
      if (mq.addEventListener) mq.addEventListener('change', h);
    }
    apply(false);
  })();

  /* ------------------------------------------------------------ small helpers */
  function resControl(initial) {
    const st = { mode: initial };
    return {
      st,
      controls: (ctrl, redraw) => ctrl.appendChild(C.segmented(
        [{ value: 'daily', label: 'Daily mean' }, { value: 'hourly', label: 'Hourly' }], st.mode,
        v => { st.mode = v; redraw(); })),
    };
  }

  let resultToken = 0;
  /** draw the result cards for one or several runs into `container` */
  async function renderResults(container, ids, opts) {
    opts = opts || {};
    const tok = ++resultToken;
    container._tok = tok;
    container.innerHTML = '';
    if (opts.tiles) opts.tiles.innerHTML = '';
    if (!ids.length) { container.appendChild(el('p', 'meta', 'Select at least one run.')); return; }
    let runs;
    try { runs = await loadRuns(ids); } catch (e) { showError('run results', e); return; }
    if (container._tok !== tok) return;                       // a newer request replaced this one
    const names = runs.map((r, i) => runsById[ids[i]].name);
    runs = runs.map((r, i) => Object.assign({}, r, { name: names[i] }));

    if (opts.tiles && runs.length === 1) {
      const r = runs[0];
      const peak = Math.max.apply(null, r.hourly_kW.El13) / 1000;
      const pv = (r.pv_GWh.self || 0) + (r.pv_GWh.export || 0);
      const tile = (l, v, u) => `<div class="tile"><div class="l">${l}</div><div class="v">${v}<span class="u">${u}</span></div></div>`;
      opts.tiles.innerHTML = '<div class="tiles">' +
        tile('Total cost', C.fmt(r.total_cost_MCHF, 1), 'MCHF/yr') +
        tile('Emissions', C.fmt(r.total_carbon_kt, 1), 'ktCO2-eq/yr') +
        tile('Electricity import', C.fmt(r.import_GWh.El13 || 0, 1), 'GWh/yr') +
        tile('Peak grid import', C.fmt(peak, 1), 'MW') +
        tile('PV generation', C.fmt(pv, 1), 'GWh/yr') + '</div>';
    }

    const grid = el('div', 'grid two'); container.appendChild(grid);
    if (opts.scatter !== false) {
      C.makeCard(grid, { title: 'Total cost vs emissions', sub: 'Highlighted: selected run(s); grey: all other runs', build: t => C.build.costEmission(t, M, ids) });
    }
    C.makeCard(grid, { title: 'Cost breakdown', sub: 'MCHF per year; income counts as negative', build: (t, ctx) => C.build.costBreakdown(t, M, runs, ctx) });
    C.makeCard(grid, { title: 'Energy supply', sub: 'Annual energy by carrier, GWh per year', build: (t, ctx) => C.build.supplyBreakdown(t, M, runs, ctx) });
    C.makeCard(grid, { title: 'Carbon emissions', sub: 'tCO2-eq per year by energy carrier', build: (t, ctx) => C.build.emissionBreakdown(t, M, runs, ctx) });
    C.makeCard(grid, { title: 'Residential heating systems', sub: 'Installed capacity by technology, MW', build: (t, ctx) => C.build.heatCapacity(t, M, runs, ctx) });

    const lim = runs.length > 3 ? runs.slice(0, 3) : runs;
    const wide = el('div', 'grid'); wide.style.marginTop = '14px'; container.appendChild(wide);
    [['El13', 'Electricity import from the grid', 'hourly'], ['PV', 'PV generation', 'daily']].forEach(([key, title, mode0]) => {
      const rc = resControl(mode0);
      C.makeCard(wide, {
        title, sub: 'Power over the simulated year, MW' + (runs.length > 3 ? ' (first three runs shown)' : ''),
        controls: rc.controls, build: t => C.build.hourlyProfile(t, lim, key, rc.st.mode, title),
      });
    });
  }

  /* ------------------------------------------------------------ footer (one copy for all pages) */
  const LINKS = {
    uesl: 'https://www.empa.ch/web/s313',
    empa: 'https://www.empa.ch/',
    ehubx: 'https://github.com/uesl-empa/ehubx',
    plants: 'https://opendata.swiss/en/dataset/elektrizitatsproduktionsanlagen',
  };
  (function footer() {
    const f = $('site-footer');
    if (!f) return;
    f.innerHTML = `<div class="wrap">
      <p><strong>Contact:</strong> <a id="contact-link" href="#"></a></p>
      <p><strong>Data and software</strong></p>
      <ul>
        <li>Electricity production plants: Swiss Federal Office of Energy (BFE), via <a href="${LINKS.plants}">opendata.swiss</a>. Street addresses are not shown and coordinates are rounded.</li>
        <li>Weather: <a href="https://open-meteo.com/">Open-Meteo.com</a> (CC BY 4.0).</li>
        <li>Map and municipality boundaries: &copy; swisstopo.</li>
        <li>Charts: <a href="https://plotly.com/javascript/">Plotly.js</a> (MIT), bundled with this page.</li>
        <li>Energy model: <a href="${LINKS.ehubx}">ehubX</a> (open source, GPL-3.0), <a href="${LINKS.uesl}">Urban Energy Systems Lab</a>, <a href="${LINKS.empa}">Empa</a>.</li>
      </ul>
      <p class="meta">Prototype. Results are model outputs under stated assumptions, not forecasts. <span id="repo-link"></span></p>
    </div>`;
    const a = $('contact-link');
    a.textContent = `${CFG.contactName || 'Contact'} (${CFG.contactEmail || ''})`;
    a.href = 'mailto:' + (CFG.contactEmail || '');
    if (CFG.repoUrl) $('repo-link').innerHTML = `<a href="${CFG.repoUrl}">Source on GitHub</a>`;
  })();

  /* ------------------------------------------------------------ overview */
  /** the reference run of the latest profile: what the "today" page shows */
  function todayRunId() {
    const id = lookup(M.latest_profile, defaults);
    if (id) return id;
    const cands = M.runs.filter(r => r.kind === 'single-hub').sort((a, b) => b.profile.localeCompare(a.profile));
    return cands.length ? cands[0].id : M.runs[0].id;
  }

  async function initHome() {
    $('data-notice').textContent = 'Prototype: results are model outputs under stated assumptions, not forecasts, and may change as the model is updated.';
    $('about-meta').textContent = `Data build ${M.built} · latest weather profile ${M.latest_profile} · plant data snapshot ${M.plants_snapshot} · ${M.runs.length} simulation runs`;
    const r = runsById[todayRunId()];
    $('go-today').textContent = `The latest monthly simulation (run ${r.name}, weather up to ${r.profile}): ` +
      `${C.fmt(r.summary.cost_MCHF, 1)} MCHF/yr, ${C.fmt(r.summary.carbon_kt, 1)} ktCO2-eq/yr.`;
    $('go-runs').textContent = `All ${M.runs.length} pre-computed runs in one table; compare up to three.`;
  }

  /* ------------------------------------------------------------ 1. live energy data */
  async function initPlants() {
    const [plants, geo] = await Promise.all([DT.load('plants'), DT.load('geo')]);
    const pv = plants.rows.filter(r => r[1] === 'Photovoltaic');
    $('plants-meta').textContent =
      `Snapshot of ${plants.snapshot} (latest commissioning ${plants.latest_operation}) · ${plants.rows.length} plants, of which ${pv.length} PV ` +
      `with ${C.fmt(pv.reduce((a, r) => a + (r[2] || 0), 0) / 1000, 1)} MWp. Source: BFE, opendata.swiss.`;
    const grid = $('plants-grid');
    const source = { text: `Swiss Federal Office of Energy (BFE), Electricity production plants, opendata.swiss (snapshot ${plants.snapshot})`, href: LINKS.plants };
    C.makeCard(grid, { title: 'Installed PV capacity by year', sub: 'kWp, by municipality', source, build: t => C.build.pvByYear(t, plants) });
    C.makeCard(grid, { title: 'Installed power by technology', sub: 'kW, by municipality', source, build: t => C.build.powerByCategory(t, plants) });
    C.makeCard($('plants-map'), { title: 'Electricity production plants', sub: 'Marker size shows the installed power (log scale, see key); positions are rounded', source, build: t => C.build.plantMap(t, plants, geo) });
  }

  async function initWeather() {
    const w = await DT.load('weather/' + M.latest_profile);
    $('weather-meta').textContent = `Hourly weather of the 365 days before ${M.latest_profile} (UTC). The PV and demand profiles are simulated from it. Source: Open-Meteo.com.`;
    const grid = $('weather-grid');
    [['Outdoor temperature', w.temperature_C, '°C', 1, 'Temperature (°C)'],
     ['Shortwave solar radiation', w.radiation_Wm2, 'W/m²', 0, 'Irradiance (W/m²)']].forEach(([title, vals, unit, dec, ytitle]) => {
      const rc = resControl('daily');
      C.makeCard(grid, {
        title, sub: 'Mean per day or hourly', controls: rc.controls,
        build: t => C.build.timeSeries(t, { series: [{ name: title, color: t.s[0], values: vals, start: w.start }], mode: rc.st.mode, unit, dec, yTitle: ytitle }),
      });
    });
  }

  /* ------------------------------------------------------------ 2. today */
  async function initToday() {
    const id = todayRunId();
    const r = runsById[id];
    $('today-meta').textContent = `Run "${r.name}" · simulated ${r.date} · weather profile ${r.profile}`;
    // "Carbon price (CHF/tCO2)" + 80 -> "carbon price 80 CHF/tCO2"
    const paramText = p => {
      const unit = (p.label.match(/\(([^)]*)\)$/) || [])[1] || '';
      const name = p.label.replace(/\s*\([^)]*\)$/, '');
      const lower = /^[A-Z]{2}/.test(name) ? name : name[0].toLowerCase() + name.slice(1);      // keep "EV", "PV"
      return `${lower.replace(/\bpv\b/, 'PV')} ${r.params[p.key]}${unit ? ' ' + unit : ''}`;
    };
    $('today-params').textContent = M.params.map(paramText).join(', ');
    if (M.profiles_available.includes(r.profile)) {
      try {
        const w = await DT.load('weather/' + r.profile);
        const n = w.temperature_C.length;
        const end = C.makeTimes(w.start, n, 1)[n - 1];
        const day = s => new Date(s.slice(0, 10) + 'T00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
        $('today-window').textContent = `${day(w.start)} to ${day(end)}`;
      } catch (e) { /* keep the generic wording */ }
    }
    await renderResults($('today-results'), [id], { tiles: $('today-tiles') });
  }

  /* ------------------------------------------------------------ 3. sandbox */
  const sb = { cards: [], profile: M.latest_profile, params: Object.assign({}, defaults), shown: null, compareRef: false, profileRes: 'daily', profTok: 0,
    solarSel: [{ value: 'SolS', slot: 0 }, { value: 'SolFlat', slot: 1 }, { value: 'SolN', slot: 2 }] };

  function gridCompatible(run) {
    return M.params.every(p => {
      const v = run.params[p.key];
      return v !== null && v >= p.min && v <= p.max && Math.abs(((v - p.min) / p.step) - Math.round((v - p.min) / p.step)) < 1e-9;
    });
  }

  async function renderProfiles() {
    const tok = ++sb.profTok;
    const dGrid = $('profile-demand'), sGrid = $('profile-solar');
    dGrid.innerHTML = ''; sGrid.innerHTML = ''; sb.cards = [];
    const avail = M.profiles_available.includes(sb.profile);
    if (!avail) {
      $('profile-meta').textContent = `No profile data is published for ${sb.profile}; the simulation results for this date are still available below.`;
      return;
    }
    $('profile-meta').textContent = sb.profile === '2016-12-31'
      ? 'Reference year 2016: the profiles are the underlying training data. The industrial profile is a normalised shape (1 GWh/yr).'
      : `Profiles of ${sb.profile}: PV and demand are estimated from the weather of the preceding 365 days with a machine-learning model trained on 2016/2018 data. The industrial profile is a normalised shape.`;
    const p = await DT.load('profiles/' + sb.profile);
    if (tok !== sb.profTok) return;
    Object.keys(p.demand).forEach(col => {
      sb.cards.push(C.makeCard(dGrid, {
        small: true, title: C.DEMAND_LABEL[col] || col, sub: C.DEMAND_UNIT[col] || 'kW',
        build: t => C.build.timeSeries(t, {
          series: [{ name: C.DEMAND_LABEL[col] || col, color: t.s[(C.DEMAND_SLOT[col] || 1) - 1], values: p.demand[col], start: p.start }],
          mode: sb.profileRes, unit: col === 'ProdInd' ? 'kWh/h' : 'kW', dec: col === 'ProdInd' ? 1 : 0, yTitle: '', height: 210, rangemode: 'tozero',
        }),
      }));
    });
    // all orientations in one chart: up to 3 highlighted in colour, the rest as grey context
    const cols = Object.keys(p.solar), label = col => C.SOLAR_LABEL[col] || col;
    sb.solarSel = sb.solarSel.filter(s => cols.includes(s.value));
    sb.cards.push(C.makeCard(sGrid, {
      title: 'Solar irradiation by roof orientation',
      sub: 'kW/m² (kWh/m² per hour). Pick up to 3 orientations to highlight; the others are shown in grey.',
      controls: (el, redraw) => el.appendChild(C.chips(cols.map(col => ({ value: col, label: label(col) })), sb.solarSel, 3, redraw)),
      build: t => C.build.timeSeries(t, {
        series: cols.map(col => {
          const s = sb.solarSel.find(x => x.value === col);
          return { name: label(col), values: p.solar[col], start: p.start, color: s ? t.s[s.slot] : t.other, context: !s };
        }),
        contextLabel: 'Other orientations',
        mode: sb.profileRes, unit: 'kW/m²', dec: 3, yTitle: 'Irradiation (kW/m²)', height: 340, rangemode: 'tozero',
      }),
    }));
  }

  /** ?scenario=profile=2025-07-07; industrial demand=20; ...  (the same text "Copy scenario code" produces) */
  function applyScenarioFromUrl() {
    const raw = new URLSearchParams(location.search).get('scenario');
    if (!raw) return false;
    raw.split(';').forEach(part => {
      const i = part.indexOf('=');
      if (i < 0) return;
      const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim();
      if (k === 'profile' && M.profiles.includes(v)) { sb.profile = v; return; }
      const p = M.params.find(x => x.key === k), num = Number(v);
      if (p && Number.isFinite(num) && num >= p.min && num <= p.max) sb.params[k] = num;
    });
    return true;
  }

  function initProfileControls() {
    const sel = $('profile-select');
    M.profiles.slice().reverse().forEach(d => {
      const o = el('option', '', d === '2016-12-31' ? '2016 (reference year)' : d);
      o.value = d;
      if (!M.profiles_available.includes(d)) o.textContent += ' · results only';
      sel.appendChild(o);
    });
    sel.value = sb.profile;
    sel.addEventListener('change', () => { sb.profile = sel.value; renderProfiles(); updateSandbox(); });
    $('profile-res').appendChild(C.segmented(
      [{ value: 'daily', label: 'Daily mean' }, { value: 'hourly', label: 'Hourly' }], sb.profileRes,
      v => { sb.profileRes = v; sb.cards.forEach(c => c.redraw()); }));
  }

  const sliderEls = {};
  function initSliders() {
    const box = $('sliders');
    M.params.forEach(p => {
      const wrap = el('div', 'slider');
      const id = 'sl-' + p.key.replace(/\W+/g, '-');
      wrap.innerHTML = `<label for="${id}"><span>${p.label}</span><output id="${id}-o">${sb.params[p.key]}</output></label>` +
        `<input id="${id}" type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${sb.params[p.key]}">` +
        `<div class="ends"><span>${p.min}</span><span>${p.max}</span></div>`;
      box.appendChild(wrap);
      const input = wrap.querySelector('input'), out = wrap.querySelector('output');
      sliderEls[p.key] = { input, out };
      input.addEventListener('input', () => {
        sb.params[p.key] = Number(input.value); out.textContent = input.value;
        clearTimeout(initSliders.t); initSliders.t = setTimeout(updateSandbox, 120);
      });
    });
  }

  function setSliders(params) {
    M.params.forEach(p => {
      const v = params[p.key];
      sb.params[p.key] = v; sliderEls[p.key].input.value = v; sliderEls[p.key].out.textContent = v;
    });
  }

  const scenarioCode = (profile, params) =>
    `profile=${profile}; ` + M.params.map(p => `${p.key}=${params[p.key]}`).join('; ');

  function requestHref(profile, params) {
    if (CFG.requestFormUrl) {
      const map = CFG.requestFormParams || {};
      const pairs = [];
      const all = Object.assign({ profile }, params);
      Object.keys(all).forEach(k => { if (map[k]) pairs.push(encodeURIComponent(map[k]) + '=' + encodeURIComponent(all[k])); });
      if (!pairs.length) return CFG.requestFormUrl;
      return CFG.requestFormUrl + (CFG.requestFormUrl.includes('?') ? '&' : '?') + pairs.join('&');
    }
    const body = 'Please simulate this scenario for the Sisslerfeld digital twin:\n\n' +
      scenarioCode(profile, params).split('; ').join('\n') + '\n\n(Optional: your name / reason)';
    return `mailto:${CFG.contactEmail || ''}?subject=${encodeURIComponent('Sisslerfeld digital twin: scenario request')}&body=${encodeURIComponent(body)}`;
  }

  const PSHORT = { 'industrial demand': 'industry +%v%', 'population': 'population +%v%', 'industrial efficiency': 'industry saving %v%',
    'PV installation': 'PV max %v MW', 'heating renew': 'heating renovation %v%', 'EV share': 'EV %v%', 'carbon price': 'CO2 price %v CHF/t' };
  /** "PV max 12 MW, industry +20%" - only what differs from the defaults */
  function describeParams(params, profile) {
    const parts = M.params.filter(p => params[p.key] !== p.default).map(p => (PSHORT[p.key] || p.key + ' %v').replace('%v', params[p.key]));
    if (profile && profile !== M.latest_profile) parts.unshift('profile ' + profile);
    return parts.length ? parts.join(', ') : 'default settings';
  }

  function closestRuns(profile, params, n) {
    const cands = M.runs.filter(r => r.kind === 'single-hub' && gridCompatible(r) && !r.duplicate_of);
    const dist = r => M.params.reduce((a, p) => a + Math.abs(r.params[p.key] - params[p.key]) / (p.max - p.min || 1), 0) + (r.profile === profile ? 0 : 0.75);
    return cands.map(r => [dist(r), r]).sort((a, b) => a[0] - b[0]).slice(0, n).map(x => x[1]);
  }

  async function updateSandbox() {
    const status = $('match-status'), results = $('sandbox-results');
    const id = lookup(sb.profile, sb.params);
    status.innerHTML = '';
    if (id) {
      const r = runsById[id];
      const box = el('div', 'status ok', `<strong>Pre-computed run found:</strong> ${r.name} (simulated ${r.date}).`);
      const ref = lookup(sb.profile, defaults);
      if (ref && ref !== id) {
        const lab = el('label', 'meta'); lab.style.display = 'block'; lab.style.marginTop = '6px';
        const cb = el('input'); cb.type = 'checkbox'; cb.checked = sb.compareRef;
        cb.addEventListener('change', () => { sb.compareRef = cb.checked; sb.shown = null; updateSandbox(); });
        lab.appendChild(cb); lab.appendChild(document.createTextNode(` Compare with the reference run of this profile (${runsById[ref].name})`));
        box.appendChild(lab);
      }
      status.appendChild(box);
      const ids = (sb.compareRef && ref && ref !== id) ? [id, ref] : [id];
      const sig = ids.join('+');
      if (sb.shown !== sig) { sb.shown = sig; await renderResults(results, ids, { tiles: null }); }
      return;
    }
    // no exact match
    sb.shown = null;
    results.innerHTML = ''; results._tok = -1;                // cancel a render still in flight
    const box = el('div', 'status miss', '<strong>This combination has not been simulated yet.</strong> The closest pre-computed runs are listed below; or request this scenario.');
    const chips = el('div', 'chips');
    closestRuns(sb.profile, sb.params, 3).forEach(r => {
      const b = el('button', 'ghost');
      b.type = 'button';
      b.textContent = `${r.name}: ${describeParams(r.params, r.profile)}`;
      b.title = 'Set the sliders to this pre-computed run';
      b.addEventListener('click', () => {
        sb.profile = r.profile; $('profile-select').value = r.profile; setSliders(r.params); renderProfiles(); updateSandbox();
      });
      chips.appendChild(b);
    });
    box.appendChild(chips);
    const req = el('div', 'request');
    const code = el('code'); code.textContent = scenarioCode(sb.profile, sb.params);
    const row = el('div'); row.style.display = 'flex'; row.style.gap = '8px'; row.style.flexWrap = 'wrap';
    const a = el('a', 'primary', 'Request this scenario'); a.href = requestHref(sb.profile, sb.params);
    a.setAttribute('role', 'button'); a.target = CFG.requestFormUrl ? '_blank' : '_self'; a.rel = 'noopener';
    const copy = el('button', 'ghost', 'Copy scenario code'); copy.type = 'button';
    copy.addEventListener('click', () => {
      try { navigator.clipboard.writeText(code.textContent); copy.textContent = 'Copied'; } catch (e) { copy.textContent = 'Copy failed'; }
      setTimeout(() => { copy.textContent = 'Copy scenario code'; }, 1500);
    });
    row.appendChild(a); row.appendChild(copy);
    const note = el('p', 'meta', `Requests are reviewed by ${CFG.contactName || 'the team'} and run on Empa's systems; the result is added to this page. If you leave an e-mail address you will be notified.`);
    note.style.margin = '0';
    req.appendChild(code); req.appendChild(row); req.appendChild(note);
    box.appendChild(req);
    status.appendChild(box);
  }

  /* ------------------------------------------------------------ 4. runs */
  const rs = { compare: ['REF', M.runs[M.runs.length - 1].id].filter((v, i, a) => runsById[v] && a.indexOf(v) === i), filter: 'all', overview: null };

  function renderRunsTable() {
    const tbl = $('runs-table');
    const SHORT = { 'industrial demand': 'Ind. demand +%', 'population': 'Population +%', 'industrial efficiency': 'Ind. saving %',
      'PV installation': 'PV max MW', 'heating renew': 'Heating renov. %', 'EV share': 'EV %', 'carbon price': 'CO2 price CHF/t' };
    const heads = [['', ''], ['Run', ''], ['Date', ''], ['Profile', '']]
      .concat(M.params.map(p => [SHORT[p.key] || p.key, p.label]))
      .concat([['Cost MCHF/yr', 'Total annual cost'], ['CO2 kt/yr', 'Total annual emissions'], ['Note', '']]);
    let h = '<thead><tr>' + heads.map(([x, tip]) => `<th scope="col" title="${tip}">${x}</th>`).join('') + '</tr></thead><tbody>';
    const rows = M.runs.filter(r => rs.filter === 'all' || (rs.filter === 'multi-hub') === (r.kind === 'multi-hub'));
    rows.forEach(r => {
      const checked = rs.compare.includes(r.id);
      h += `<tr class="${checked ? 'sel' : ''}"><td><input type="checkbox" data-id="${r.id}" aria-label="Compare ${r.name}" ${checked ? 'checked' : ''}></td>` +
        `<td>${r.name}</td><td>${r.date}</td><td>${r.profile}</td>` +
        M.params.map(p => `<td>${r.params[p.key] === null ? '–' : r.params[p.key]}</td>`).join('') +
        `<td>${C.fmt(r.summary.cost_MCHF, 1)}</td><td>${C.fmt(r.summary.carbon_kt, 1)}</td>` +
        `<td class="note" title="${(r.note || '').replace(/"/g, '&quot;')}">${r.duplicate_of ? 'same scenario as ' + r.duplicate_of : (r.note || '')}</td></tr>`;
    });
    tbl.innerHTML = h + '</tbody>';
    $('runs-count').textContent = `${rows.length} of ${M.runs.length} runs shown`;
    tbl.querySelectorAll('input[type=checkbox]').forEach(cb => cb.addEventListener('change', () => {
      const id = cb.dataset.id;
      if (cb.checked) {
        if (rs.compare.length >= 3) { cb.checked = false; $('runs-count').textContent = 'You can compare up to three runs: untick one first.'; return; }
        rs.compare.push(id);
      } else rs.compare = rs.compare.filter(x => x !== id);
      cb.closest('tr').classList.toggle('sel', cb.checked);
      updateCompare();
    }));
  }

  function updateCompare() {
    if (rs.overview) rs.overview.redraw();
    renderResults($('runs-compare'), rs.compare, { scatter: false });
  }

  function initRuns() {
    rs.overview = C.makeCard($('runs-overview'), {
      title: 'Total cost vs emissions of all runs', sub: 'Highlighted: runs ticked in the table',
      build: t => C.build.costEmission(t, M, rs.compare),
    });
    $('runs-filter').addEventListener('change', e => { rs.filter = e.target.value; renderRunsTable(); });
    renderRunsTable();
    updateCompare();
  }

  /* ------------------------------------------------------------ boot */
  const steps = {
    home: [['overview', initHome]],
    data: [['energy data', initPlants], ['weather', initWeather]],
    today: [['today', initToday]],
    sandbox: [['sandbox', async () => { applyScenarioFromUrl(); initProfileControls(); initSliders(); await renderProfiles(); await updateSandbox(); }]],
    runs: [['runs', async () => initRuns()]],
  }[PAGE] || [];
  steps.reduce((p, [name, fn]) => p.then(() => fn().catch(e => showError(name, e))), Promise.resolve())
    .then(() => { document.documentElement.setAttribute('data-ready', '1'); });
})();
