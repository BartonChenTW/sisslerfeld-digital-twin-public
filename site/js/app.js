/* Page logic for the Sisslerfeld digital twin (static, pre-computed results). */
(function () {
  'use strict';
  const DT = window.DT, C = window.DTC, CFG = window.DT_CONFIG || {};
  const I18N = window.I18N || { L: s => s, lang: 'en', locale: 'en-US', withLang: h => h };
  const L = I18N.L;
  const $ = id => document.getElementById(id);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

  function showError(where, err) {
    console.error(where, err);
    const f = $('fatal');
    f.style.display = 'block';
    f.textContent = L('Something went wrong while loading "{where}": {msg}', { where, msg: err && err.message ? err.message : err });
  }

  const PAGE = document.body.dataset.page || 'home';      // home | data | today | sandbox | runs
  // links shared before the split into pages pointed at index.html?scenario=...
  if (PAGE === 'home' && new URLSearchParams(location.search).has('scenario')) {
    location.replace(I18N.withLang('sandbox.html' + location.search));
    return;
  }

  const M = DT.get('manifest');
  if (!M) { showError('manifest', new Error('data/manifest.js is missing')); return; }
  DT.version = M.built;

  const runsById = {};
  M.runs.forEach(r => { runsById[r.id] = r; });
  const defaults = {};
  M.params.forEach(p => { defaults[p.key] = p.default; });

  /** run dates come as M/D/YYYY; German pages show D.M.YYYY */
  const runDate = s => {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s || '');
    return I18N.lang === 'de' && m ? `${m[2].padStart(2, '0')}.${m[1].padStart(2, '0')}.${m[3]}` : s;
  };
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
      btn.textContent = L('Theme: {mode}', { mode: L(mode) });
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
        [{ value: 'daily', label: L('Daily mean') }, { value: 'hourly', label: L('Hourly') }], st.mode,
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
    if (!ids.length) { container.appendChild(el('p', 'meta', L('Select at least one run.'))); return; }
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
        tile(L('Total cost'), C.fmt(r.total_cost_MCHF, 1), L('MCHF/yr')) +
        tile(L('Emissions'), C.fmt(r.total_carbon_kt, 1), L('ktCO2-eq/yr')) +
        tile(L('Electricity import'), C.fmt(r.import_GWh.El13 || 0, 1), L('GWh/yr')) +
        tile(L('Peak grid import'), C.fmt(peak, 1), 'MW') +
        tile(L('PV generation'), C.fmt(pv, 1), L('GWh/yr')) + '</div>';
    }

    const grid = el('div', 'grid two'); container.appendChild(grid);
    if (opts.scatter !== false) {
      C.makeCard(grid, { title: L('Total cost vs emissions'), sub: L('Highlighted: selected run(s); grey: all other runs'), build: t => C.build.costEmission(t, M, ids) });
    }
    C.makeCard(grid, { title: L('Cost breakdown'), sub: L('MCHF per year; income counts as negative'), build: (t, ctx) => C.build.costBreakdown(t, M, runs, ctx) });
    C.makeCard(grid, { title: L('Energy supply'), sub: L('Annual energy by carrier, GWh per year'), build: (t, ctx) => C.build.supplyBreakdown(t, M, runs, ctx) });
    C.makeCard(grid, { title: L('Carbon emissions'), sub: L('tCO2-eq per year by energy carrier'), build: (t, ctx) => C.build.emissionBreakdown(t, M, runs, ctx) });
    C.makeCard(grid, { title: L('Residential heating systems'), sub: L('Installed capacity by technology, MW'), build: (t, ctx) => C.build.heatCapacity(t, M, runs, ctx) });

    const lim = runs.length > 3 ? runs.slice(0, 3) : runs;
    const wide = el('div', 'grid'); wide.style.marginTop = '14px'; container.appendChild(wide);
    [['El13', L('Electricity import from the grid'), 'hourly'], ['PV', L('PV generation'), 'daily']].forEach(([key, title, mode0]) => {
      const rc = resControl(mode0);
      C.makeCard(wide, {
        title, sub: L('Power over the simulated year, MW') + (runs.length > 3 ? L(' (first three runs shown)') : ''),
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
    const a_ = (href, text) => `<a href="${href}">${text}</a>`;
    f.innerHTML = `<div class="wrap">
      <p><strong>${L('Contact:')}</strong> <a id="contact-link" href="#"></a></p>
      <p><strong>${L('Data and software')}</strong></p>
      <ul>
        <li>${L('Electricity production plants: Swiss Federal Office of Energy (BFE), via {a}. Street addresses are not shown and coordinates are rounded.', { a: a_(LINKS.plants, 'opendata.swiss') })}</li>
        <li>${L('Weather: {a} (CC BY 4.0).', { a: a_('https://open-meteo.com/', 'Open-Meteo.com') })}</li>
        <li>${L('Map and municipality boundaries: © swisstopo.')}</li>
        <li>${L('Charts: {a} (MIT), bundled with this page.', { a: a_('https://plotly.com/javascript/', 'Plotly.js') })}</li>
        <li>${L('Energy model: {ehubx} (open source, GPL-3.0), {uesl}, {empa}.', { ehubx: a_(LINKS.ehubx, 'ehubX'), uesl: a_(LINKS.uesl, 'Urban Energy Systems Lab'), empa: a_(LINKS.empa, 'Empa') })}</li>
      </ul>
      <p class="meta">${L('Prototype. Results are model outputs under stated assumptions, not forecasts.')} <span id="repo-link"></span></p>
    </div>`;
    const a = $('contact-link');
    a.textContent = `${CFG.contactName || L('Contact')} (${CFG.contactEmail || ''})`;
    a.href = 'mailto:' + (CFG.contactEmail || '');
    if (CFG.repoUrl) $('repo-link').innerHTML = `<a href="${CFG.repoUrl}">${L('Source on GitHub')}</a>`;
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
    $('data-notice').textContent = L('Prototype: results are model outputs under stated assumptions, not forecasts, and may change as the model is updated.');
    $('about-meta').textContent = L('Data build {built} · latest weather profile {profile} · plant data snapshot {plants} · {n} simulation runs',
      { built: M.built, profile: M.latest_profile, plants: M.plants_snapshot, n: M.runs.length });
    const r = runsById[todayRunId()];
    $('go-today').textContent = L('The latest quarterly simulation (run {name}, weather up to {profile}): {cost} MCHF/yr, {co2} ktCO2-eq/yr.',
      { name: r.name, profile: r.profile, cost: C.fmt(r.summary.cost_MCHF, 1), co2: C.fmt(r.summary.carbon_kt, 1) });
    $('go-runs').textContent = L('All {n} pre-computed runs in one table; compare up to three.', { n: M.runs.length });
  }

  /* ------------------------------------------------------------ 1. live energy data */
  async function initPlants() {
    const [plants, geo] = await Promise.all([DT.load('plants'), DT.load('geo')]);
    const pv = plants.rows.filter(r => r[1] === 'Photovoltaic');
    $('plants-meta').textContent = L('Snapshot of {snap} (latest commissioning {latest}) · {n} plants, of which {npv} PV with {mwp} MWp. Source: BFE, opendata.swiss.', {
      snap: plants.snapshot, latest: plants.latest_operation, n: plants.rows.length, npv: pv.length,
      mwp: C.fmt(pv.reduce((a, r) => a + (r[2] || 0), 0) / 1000, 1) });
    const grid = $('plants-grid');
    const source = { text: L('Swiss Federal Office of Energy (BFE), Electricity production plants, opendata.swiss (snapshot {snap})', { snap: plants.snapshot }), href: LINKS.plants };
    C.makeCard(grid, { title: L('Installed PV capacity by year'), sub: L('kWp, by municipality'), source, build: t => C.build.pvByYear(t, plants) });
    C.makeCard(grid, { title: L('Installed power by technology'), sub: L('kW, by municipality'), source, build: t => C.build.powerByCategory(t, plants) });
    C.makeCard($('plants-map'), { title: L('Electricity production plants'), sub: L('Marker size shows the installed power (log scale, see key); positions are rounded'), source, build: t => C.build.plantMap(t, plants, geo) });
  }

  async function initWeather() {
    const w = await DT.load('weather/' + M.latest_profile);
    $('weather-meta').textContent = L('Hourly weather of the 365 days before {d} (UTC). The PV and demand profiles are simulated from it. Source: Open-Meteo.com.', { d: M.latest_profile });
    const grid = $('weather-grid');
    [[L('Outdoor temperature'), w.temperature_C, '°C', 1, 'Temperature (°C)'],
     [L('Shortwave solar radiation'), w.radiation_Wm2, 'W/m²', 0, 'Irradiance (W/m²)']].forEach(([title, vals, unit, dec, ytitle]) => {
      const rc = resControl('daily');
      C.makeCard(grid, {
        title, sub: L('Mean per day or hourly'), controls: rc.controls,
        build: t => C.build.timeSeries(t, { series: [{ name: title, color: t.s[0], values: vals, start: w.start }], mode: rc.st.mode, unit, dec, yTitle: ytitle }),
      });
    });
  }

  /* ------------------------------------------------------------ 2. today */
  async function initToday() {
    const id = todayRunId();
    const r = runsById[id];
    $('today-meta').textContent = L('Run "{name}" · simulated {date} · weather profile {profile}', { name: r.name, date: runDate(r.date), profile: r.profile });
    // "Carbon price (CHF/tCO2)" + 80 -> "carbon price 80 CHF/tCO2"
    const paramText = p => {
      const label = L(p.label);
      const unit = (label.match(/\(([^)]*)\)$/) || [])[1] || '';
      const name = label.replace(/\s*\([^)]*\)$/, '');
      // English mid-sentence in lower case (keeping "EV", "PV"); German nouns stay capitalised
      const shown = I18N.lang === 'de' || /^[A-Z]{2}/.test(name) ? name : name[0].toLowerCase() + name.slice(1);
      return `${shown} ${r.params[p.key]}${unit ? ' ' + unit : ''}`;
    };
    $('today-params').textContent = M.params.map(paramText).join(', ');
    if (M.profiles_available.includes(r.profile)) {
      try {
        const w = await DT.load('weather/' + r.profile);
        const n = w.temperature_C.length;
        const end = C.makeTimes(w.start, n, 1)[n - 1];
        const day = s => new Date(s.slice(0, 10) + 'T00:00Z').toLocaleDateString(I18N.lang === 'de' ? 'de-CH' : 'en-GB', { day: 'numeric', month: I18N.lang === 'de' ? 'long' : 'short', year: 'numeric', timeZone: 'UTC' });
        $('today-window').textContent = L('{from} to {to}', { from: day(w.start), to: day(end) });
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
      $('profile-meta').textContent = L('No profile data is published for {d}; the simulation results for this date are still available below.', { d: sb.profile });
      return;
    }
    $('profile-meta').textContent = sb.profile === '2016-12-31'
      ? L('Reference year 2016: the profiles are the underlying training data. The industrial profile is a normalised shape (1 GWh/yr).')
      : L('Profiles of {d}: PV and demand are estimated from the weather of the preceding 365 days with a machine-learning model trained on 2016/2018 data. The industrial profile is a normalised shape.', { d: sb.profile });
    const p = await DT.load('profiles/' + sb.profile);
    if (tok !== sb.profTok) return;
    Object.keys(p.demand).forEach(col => {
      sb.cards.push(C.makeCard(dGrid, {
        small: true, title: L(C.DEMAND_LABEL[col] || col), sub: L(C.DEMAND_UNIT[col] || 'kW'),
        build: t => C.build.timeSeries(t, {
          series: [{ name: L(C.DEMAND_LABEL[col] || col), color: t.s[(C.DEMAND_SLOT[col] || 1) - 1], values: p.demand[col], start: p.start }],
          mode: sb.profileRes, unit: col === 'ProdInd' ? 'kWh/h' : 'kW', dec: col === 'ProdInd' ? 1 : 0, yTitle: '', height: 210, rangemode: 'tozero',
        }),
      }));
    });
    // all orientations in one chart: up to 3 highlighted in colour, the rest as grey context
    const cols = Object.keys(p.solar), label = col => L(C.SOLAR_LABEL[col] || col);
    sb.solarSel = sb.solarSel.filter(s => cols.includes(s.value));
    sb.cards.push(C.makeCard(sGrid, {
      title: L('Solar irradiation by roof orientation'),
      sub: L('kW/m² (kWh/m² per hour). Pick up to 3 orientations to highlight; the others are shown in grey.'),
      controls: (el, redraw) => el.appendChild(C.chips(cols.map(col => ({ value: col, label: label(col) })), sb.solarSel, 3, redraw)),
      build: t => C.build.timeSeries(t, {
        series: cols.map(col => {
          const s = sb.solarSel.find(x => x.value === col);
          return { name: label(col), values: p.solar[col], start: p.start, color: s ? t.s[s.slot] : t.other, context: !s };
        }),
        contextLabel: L('Other orientations'),
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
      const o = el('option', '', d === '2016-12-31' ? L('2016 (reference year)') : d);
      o.value = d;
      if (!M.profiles_available.includes(d)) o.textContent += L(' · results only');
      sel.appendChild(o);
    });
    sel.value = sb.profile;
    sel.addEventListener('change', () => { sb.profile = sel.value; renderProfiles(); updateSandbox(); });
    $('profile-res').appendChild(C.segmented(
      [{ value: 'daily', label: L('Daily mean') }, { value: 'hourly', label: L('Hourly') }], sb.profileRes,
      v => { sb.profileRes = v; sb.cards.forEach(c => c.redraw()); }));
  }

  const sliderEls = {};
  function initSliders() {
    const box = $('sliders');
    M.params.forEach(p => {
      const wrap = el('div', 'slider');
      const id = 'sl-' + p.key.replace(/\W+/g, '-');
      wrap.innerHTML = `<label for="${id}"><span>${L(p.label)}</span><output id="${id}-o">${sb.params[p.key]}</output></label>` +
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
    const body = L('Please simulate this scenario for the Sisslerfeld digital twin:') + '\n\n' +
      scenarioCode(profile, params).split('; ').join('\n') + '\n\n' + L('(Optional: your name / reason)');
    return `mailto:${CFG.contactEmail || ''}?subject=${encodeURIComponent(L('Sisslerfeld digital twin: scenario request'))}&body=${encodeURIComponent(body)}`;
  }

  const PSHORT = { 'industrial demand': 'industry +%v%', 'population': 'population +%v%', 'industrial efficiency': 'industry saving %v%',
    'PV installation': 'PV max %v MW', 'heating renew': 'heating renovation %v%', 'EV share': 'EV %v%', 'carbon price': 'CO2 price %v CHF/t' };
  /** "PV max 12 MW, industry +20%" - only what differs from the defaults */
  function describeParams(params, profile) {
    const parts = M.params.filter(p => params[p.key] !== p.default).map(p => L(PSHORT[p.key] || p.key + ' %v').replace('%v', params[p.key]));
    if (profile && profile !== M.latest_profile) parts.unshift(L('profile {d}', { d: profile }));
    return parts.length ? parts.join(', ') : L('default settings');
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
      const box = el('div', 'status ok', `<strong>${L('Pre-computed run found:')}</strong> ${r.name} ${L('(simulated {date}).', { date: runDate(r.date) })}`);
      const ref = lookup(sb.profile, defaults);
      if (ref && ref !== id) {
        const lab = el('label', 'meta'); lab.style.display = 'block'; lab.style.marginTop = '6px';
        const cb = el('input'); cb.type = 'checkbox'; cb.checked = sb.compareRef;
        cb.addEventListener('change', () => { sb.compareRef = cb.checked; sb.shown = null; updateSandbox(); });
        lab.appendChild(cb); lab.appendChild(document.createTextNode(L(' Compare with the reference run of this profile ({name})', { name: runsById[ref].name })));
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
    const box = el('div', 'status miss', `<strong>${L('This combination has not been simulated yet.')}</strong> ${L('The closest pre-computed runs are listed below; or request this scenario.')}`);
    const chips = el('div', 'chips');
    closestRuns(sb.profile, sb.params, 3).forEach(r => {
      const b = el('button', 'ghost');
      b.type = 'button';
      b.textContent = `${r.name}: ${describeParams(r.params, r.profile)}`;
      b.title = L('Set the sliders to this pre-computed run');
      b.addEventListener('click', () => {
        sb.profile = r.profile; $('profile-select').value = r.profile; setSliders(r.params); renderProfiles(); updateSandbox();
      });
      chips.appendChild(b);
    });
    box.appendChild(chips);
    const req = el('div', 'request');
    const code = el('code'); code.textContent = scenarioCode(sb.profile, sb.params);
    const row = el('div'); row.style.display = 'flex'; row.style.gap = '8px'; row.style.flexWrap = 'wrap';
    const a = el('a', 'primary', L('Request this scenario')); a.href = requestHref(sb.profile, sb.params);
    a.setAttribute('role', 'button'); a.target = CFG.requestFormUrl ? '_blank' : '_self'; a.rel = 'noopener';
    const copy = el('button', 'ghost', L('Copy scenario code')); copy.type = 'button';
    copy.addEventListener('click', () => {
      try { navigator.clipboard.writeText(code.textContent); copy.textContent = L('Copied'); } catch (e) { copy.textContent = L('Copy failed'); }
      setTimeout(() => { copy.textContent = L('Copy scenario code'); }, 1500);
    });
    row.appendChild(a); row.appendChild(copy);
    const note = el('p', 'meta', L("Requests are reviewed by {who} and run on Empa's systems; the result is added to this page. If you leave an e-mail address you will be notified.", { who: CFG.contactName || L('the team') }));
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
      .concat([['Cost MCHF/yr', 'Total annual cost'], ['CO2 kt/yr', 'Total annual emissions'], ['Note', '']])
      .map(([x, tip]) => [x ? L(x) : '', tip ? L(tip) : '']);
    let h = '<thead><tr>' + heads.map(([x, tip]) => `<th scope="col" title="${tip}">${x}</th>`).join('') + '</tr></thead><tbody>';
    const rows = M.runs.filter(r => rs.filter === 'all' || (rs.filter === 'multi-hub') === (r.kind === 'multi-hub'));
    rows.forEach(r => {
      const checked = rs.compare.includes(r.id);
      h += `<tr class="${checked ? 'sel' : ''}"><td><input type="checkbox" data-id="${r.id}" aria-label="${L('Compare {name}', { name: r.name })}" ${checked ? 'checked' : ''}></td>` +
        `<td>${r.name}</td><td>${runDate(r.date)}</td><td>${r.profile}</td>` +
        M.params.map(p => `<td>${r.params[p.key] === null ? '–' : r.params[p.key]}</td>`).join('') +
        `<td>${C.fmt(r.summary.cost_MCHF, 1)}</td><td>${C.fmt(r.summary.carbon_kt, 1)}</td>` +
        `<td class="note" title="${L(r.note || '').replace(/"/g, '&quot;')}">${r.duplicate_of ? L('same scenario as {id}', { id: r.duplicate_of }) : L(r.note || '')}</td></tr>`;
    });
    tbl.innerHTML = h + '</tbody>';
    $('runs-count').textContent = L('{n} of {m} runs shown', { n: rows.length, m: M.runs.length });
    tbl.querySelectorAll('input[type=checkbox]').forEach(cb => cb.addEventListener('change', () => {
      const id = cb.dataset.id;
      if (cb.checked) {
        if (rs.compare.length >= 3) { cb.checked = false; $('runs-count').textContent = L('You can compare up to three runs: untick one first.'); return; }
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
      title: L('Total cost vs emissions of all runs'), sub: L('Highlighted: runs ticked in the table'),
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
