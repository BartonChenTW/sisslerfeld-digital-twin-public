/* Chart builders (Plotly) for the digital-twin page.
 *
 * Rules applied here (data-viz method):
 *  - colour follows the entity (fixed slot per carrier / cost item / tech), never the row order;
 *  - one axis per chart (weather = two charts, not a dual-axis chart);
 *  - thin marks, 2 px surface gap between stacked segments, hairline recessive grid;
 *  - a legend whenever there are >= 2 series; every chart has a table-view twin;
 *  - scatter plots carry at most 3 highlighted series (all-pairs colour limit).
 */
(function () {
  'use strict';
  const SANS = 'system-ui,-apple-system,"Segoe UI",sans-serif';
  const registry = [];

  /* ------------------------------------------------------------ utils */
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  function theme() {
    const s = [];
    for (let i = 1; i <= 8; i++) s.push(css('--s' + i));
    return {
      surface: css('--surface'), text: css('--text'), text2: css('--text-2'), muted: css('--muted'),
      grid: css('--grid'), axis: css('--axis'), other: css('--other'), s,
    };
  }

  function fmt(v, d = 1) {
    if (v === null || v === undefined || Number.isNaN(v)) return '–';
    return Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  const iso = ms => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');

  function makeTimes(start, n, stepHours) {
    const [d, tm] = start.split('T');
    const [Y, M, D] = d.split('-').map(Number);
    const [h, mi] = tm.split(':').map(Number);
    const t0 = Date.UTC(Y, M - 1, D, h, mi);
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = iso(t0 + i * stepHours * 3600e3);
    return out;
  }

  function dailyMean(values) {
    const n = Math.floor(values.length / 24);
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < 24; j++) s += values[i * 24 + j];
      out[i] = s / 24;
    }
    return out;
  }

  /* ------------------------------------------------------------ colour mappings (entity -> slot) */
  const EC_SLOT = { El13: 1, Ch4: 2, WST: 3, IndWood: 4, Wood: 5, C12: 6, pv_self: 7, pv_export: 8 };
  const CAT_SLOT = { 'Photovoltaic': 1, 'Biomass': 2, 'Hydroelectric power': 3 };
  const MUN_SLOT_BASE = 5;                                   // municipalities use slots 5-8
  const DEMAND_SLOT = { ThSc: 1, ThSh: 2, ElEV: 3, ThDhw: 5, ProdInd: 6, ElBdg: 7 };

  const DEMAND_LABEL = {
    ThSh: 'Space heating', ThSc: 'Space cooling', ThDhw: 'Hot water',
    ElBdg: 'Building electricity', ElEV: 'Electric vehicles', ProdInd: 'Industrial production (normalised shape)',
  };
  const DEMAND_UNIT = { ProdInd: 'kWh/h (normalised to 1 GWh/yr)' };
  const SOLAR_LABEL = {
    SolFlat: 'Flat roof', SolN: 'North', SolNe: 'North-east', SolE: 'East', SolSe: 'South-east',
    SolS: 'South', SolSw: 'South-west', SolW: 'West', SolNw: 'North-west', SolGround: 'Ground-mounted',
  };

  function ecLabel(M, ec) { return (M.names.EC && M.names.EC[ec]) || ec; }
  function ecColor(t, ec) { return EC_SLOT[ec] ? t.s[EC_SLOT[ec] - 1] : t.other; }

  /* ------------------------------------------------------------ base layout */
  function axisStyle(t, extra) {
    return Object.assign({
      gridcolor: t.grid, gridwidth: 1, linecolor: t.axis, zerolinecolor: t.axis, tickcolor: t.axis,
      tickfont: { color: t.muted, size: 11 }, automargin: true,
    }, extra || {});
  }

  function baseLayout(t, extra) {
    const l = {
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
      font: { family: SANS, size: 12, color: t.text2 },
      margin: { l: 60, r: 24, t: 36, b: 44 },
      hoverlabel: { bgcolor: t.surface, bordercolor: t.axis, font: { color: t.text, size: 12, family: SANS } },
      legend: { orientation: 'h', x: 0, xanchor: 'left', y: 1.02, yanchor: 'bottom', font: { color: t.text2, size: 12 } },
      barcornerradius: 4,
      xaxis: axisStyle(t), yaxis: axisStyle(t),
    };
    return Object.assign(l, extra || {});
  }

  function axisTitle(t, text) { return { text, font: { color: t.muted, size: 12 }, standoff: 8 }; }

  /* ------------------------------------------------------------ builders: each returns {data, layout, height, table} */

  /** horizontal stacked bars, one row per run. series: [{name,color,vals:[per run]}] */
  function stackedBars(t, o) {
    const names = o.runNames;
    const n = names.length;
    const band = 56;
    const w = (o.ctx && o.ctx.width) || 480;
    const perRow = Math.max(1, Math.floor((w - 100) / 170));
    const legendRows = o.series.length > 1 ? Math.ceil(o.series.length / perRow) : 0;
    const top = 18 + legendRows * 23;
    const height = n * band + top + 58;
    const thick = Math.min(0.5, 24 / band);                    // <= 24 px thick
    const data = o.series.map(s => ({
      type: 'bar', orientation: 'h', name: s.name, y: names, x: s.vals, width: thick,
      marker: { color: s.color, line: { color: t.surface, width: 2 } },
      hovertemplate: `%{y}<br>${s.name}: %{x:,.${o.dec}f} ${o.unit}<extra></extra>`,
    }));
    const annotations = names.map((nm, i) => {
      const tot = o.series.reduce((a, s) => a + Math.max(0, s.vals[i] || 0), 0);
      const net = o.netLabel ? o.series.reduce((a, s) => a + (s.vals[i] || 0), 0) : tot;
      return { x: tot, y: nm, xanchor: 'left', xshift: 8, showarrow: false, text: fmt(net, o.dec), font: { color: t.text, size: 12 } };
    });
    return {
      data, height,
      layout: baseLayout(t, {
        barmode: 'relative', annotations,
        margin: { l: 90, r: 56, t: top, b: 48 },
        xaxis: axisStyle(t, { title: axisTitle(t, o.xTitle), zeroline: true }),
        yaxis: axisStyle(t, { autorange: 'reversed', showgrid: false, tickfont: { color: t.text2, size: 12 } }),
        showlegend: o.series.length > 1,
      }),
      table: {
        columns: ['Run'].concat(o.series.map(s => `${s.name} (${o.unit})`)),
        rows: names.map((nm, i) => [nm].concat(o.series.map(s => fmt(s.vals[i], o.dec)))),
      },
    };
  }

  /** time series. series: [{name,color,values(hourly),start,context?}]
   *  context series are drawn underneath as thin grey lines, share one legend entry (o.contextLabel) and skip hover */
  function timeSeries(t, o) {
    const hourly = o.mode === 'hourly';
    const idx = !!o.indexAxis;          // runs from different weather years: align on the simulated year, not on dates
    let firstContext = true;
    const traces = o.series.map((s, i) => {
      const vals = hourly ? s.values : dailyMean(s.values);
      const x = idx ? vals.map((_, i) => i + 1) : makeTimes(s.start, vals.length, hourly ? 1 : 24);
      if (s.context) {
        const tr = {
          type: 'scatter', mode: 'lines', name: o.contextLabel || 'Other', x, y: vals, legendgroup: 'context',
          showlegend: firstContext, legendrank: 1000, line: { color: t.other, width: 1 }, hoverinfo: 'skip',
        };
        firstContext = false;
        return tr;
      }
      return {
        type: 'scatter', mode: 'lines', name: s.name, x, y: vals, legendrank: i,
        line: { color: s.color, width: 2, shape: 'linear' },
        hovertemplate: (idx ? `${hourly ? 'Hour' : 'Day'} %{x}` : `%{x|%d %b %Y${hourly ? ' %H:%M' : ''}}`) +
          `<br>%{y:,.${o.dec}f} ${o.unit}<extra>${s.name}</extra>`,
      };
    });
    const data = traces.filter((_, i) => o.series[i].context).concat(traces.filter((_, i) => !o.series[i].context));
    // table twin: monthly means (calendar month, or month n of the simulated year)
    const monthly = o.series.map(s => {
      const x = idx ? null : makeTimes(s.start, s.values.length, 1);
      const acc = {};
      s.values.forEach((v, i) => {
        const k = idx ? 'Month ' + String(Math.min(12, Math.floor(i / 730) + 1)).padStart(2, '0') : x[i].slice(0, 7);
        (acc[k] = acc[k] || []).push(v);
      });
      return acc;
    });
    const months = Array.from(new Set(monthly.flatMap(m => Object.keys(m)))).sort();
    return {
      data, height: o.height || 300,
      layout: baseLayout(t, {
        margin: { l: 64, r: 24, t: o.series.length > 1 ? 40 : 12, b: 44 },
        xaxis: idx
          ? axisStyle(t, { type: 'linear', showgrid: false, title: axisTitle(t, hourly ? 'Hour of the simulated year' : 'Day of the simulated year') })
          : axisStyle(t, { type: 'date', showgrid: false, tickformat: '%b %Y', hoverformat: '%d %b %Y' }),
        yaxis: axisStyle(t, { title: axisTitle(t, o.yTitle), rangemode: o.rangemode || 'normal' }),
        showlegend: o.series.length > 1, hovermode: 'x unified',
      }),
      table: {
        columns: [idx ? 'Month of the simulated year (mean)' : 'Month (mean)'].concat(o.series.map(s => `${s.name} (${o.unit})`)),
        rows: months.map(m => [m].concat(monthly.map(acc => acc[m] ? fmt(acc[m].reduce((a, b) => a + b, 0) / acc[m].length, o.dec) : '–'))),
      },
    };
  }

  /** cost vs emissions scatter: all runs grey, selected runs highlighted (max 3 colours) */
  function costEmission(t, M, selectedIds) {
    const sel = selectedIds.slice(0, 3);
    const others = M.runs.filter(r => !sel.includes(r.id));
    const data = [{
      type: 'scatter', mode: 'markers', name: 'Other runs',
      x: others.map(r => r.summary.cost_MCHF), y: others.map(r => r.summary.carbon_kt),
      text: others.map(r => r.name),
      marker: { color: t.other, size: 9, line: { color: t.surface, width: 2 } },
      hovertemplate: '%{text}<br>%{x:,.1f} MCHF/yr · %{y:,.1f} ktCO2/yr<extra></extra>',
    }];
    sel.forEach((id, i) => {
      const r = M.runs.find(x => x.id === id);
      data.push({
        type: 'scatter', mode: 'markers+text', name: r.name, x: [r.summary.cost_MCHF], y: [r.summary.carbon_kt],
        text: [r.name], textposition: ['top right', 'bottom right', 'top left'][i], textfont: { color: t.text, size: 12 },
        marker: { color: t.s[i], size: 13, line: { color: t.surface, width: 2 } },
        hovertemplate: '%{text}<br>%{x:,.1f} MCHF/yr · %{y:,.1f} ktCO2/yr<extra></extra>',
      });
    });
    const rows = M.runs.map(r => [r.name, r.profile, fmt(r.summary.cost_MCHF, 1), fmt(r.summary.carbon_kt, 1)]);
    return {
      data, height: 380,
      layout: baseLayout(t, {
        xaxis: axisStyle(t, { title: axisTitle(t, 'Total cost (MCHF/yr)'), zeroline: false }),
        yaxis: axisStyle(t, { title: axisTitle(t, 'Emissions (ktCO2-eq/yr)'), zeroline: false }),
        hovermode: 'closest',
      }),
      table: { columns: ['Run', 'Profile', 'Total cost (MCHF/yr)', 'Emissions (ktCO2-eq/yr)'], rows },
    };
  }

  function costBreakdown(t, M, runs, ctx) {
    const series = M.cost_labels.map((lab, i) => ({ name: lab, color: t.s[i], vals: runs.map(r => (r.costs_MCHF[lab] || 0)) }))
      .filter(s => s.vals.some(v => Math.abs(v) > 1e-9));
    return stackedBars(t, { ctx, runNames: runs.map(r => r.name), series, unit: 'MCHF/yr', dec: 1, xTitle: 'Cost (MCHF/yr), income negative', netLabel: true });
  }

  function emissionBreakdown(t, M, runs, ctx) {
    const keys = new Set();
    runs.forEach(r => Object.keys(r.emissions_t).forEach(k => keys.add(k)));
    const order = Object.keys(EC_SLOT);
    const sorted = Array.from(keys).sort((a, b) => {
      const ea = a.split('|')[0], eb = b.split('|')[0];
      return (order.indexOf(ea) < 0 ? 99 : order.indexOf(ea)) - (order.indexOf(eb) < 0 ? 99 : order.indexOf(eb)) || a.localeCompare(b);
    });
    const series = sorted.map(k => {
      const [ec, dir] = k.split('|');
      return { name: ecLabel(M, ec) + (dir === 'export' ? ' (export credit)' : ''), color: ecColor(t, ec), vals: runs.map(r => r.emissions_t[k] || 0) };
    });
    return stackedBars(t, { ctx, runNames: runs.map(r => r.name), series, unit: 'tCO2/yr', dec: 0, xTitle: 'Carbon emissions (tCO2-eq/yr)' });
  }

  function supplyBreakdown(t, M, runs, ctx) {
    const ecs = new Set();
    runs.forEach(r => Object.keys(r.import_GWh).forEach(k => ecs.add(k)));
    const order = Object.keys(EC_SLOT);
    const list = Array.from(ecs).sort((a, b) => (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b)));
    const series = list.map(ec => ({ name: ecLabel(M, ec), color: ecColor(t, ec), vals: runs.map(r => r.import_GWh[ec] || 0) }));
    series.push({ name: 'PV self-consumption', color: t.s[EC_SLOT.pv_self - 1], vals: runs.map(r => r.pv_GWh.self || 0) });
    series.push({ name: 'PV export', color: t.s[EC_SLOT.pv_export - 1], vals: runs.map(r => r.pv_GWh.export || 0) });
    return stackedBars(t, {
      ctx, runNames: runs.map(r => r.name), series: series.filter(s => s.vals.some(v => v > 1e-9)),
      unit: 'GWh/yr', dec: 1, xTitle: 'Energy supply (GWh/yr)',
    });
  }

  function heatCapacity(t, M, runs, ctx) {
    const series = M.heat_techs.map((nm, i) => ({ name: nm, color: t.s[i], vals: runs.map(r => r.heat_cap_MW[nm] || 0) }))
      .filter(s => s.vals.some(v => v > 1e-9));
    return stackedBars(t, { ctx, runNames: runs.map(r => r.name), series, unit: 'MW', dec: 1, xTitle: 'Installed heating capacity (MW)' });
  }

  function hourlyProfile(t, runs, key, mode, label) {
    const series = runs.map((r, i) => ({ name: r.name, color: t.s[i], values: r.hourly_kW[key].map(v => v / 1000), start: r.start }));
    const indexAxis = runs.length > 1 && new Set(runs.map(r => r.start)).size > 1;
    return timeSeries(t, { series, mode, unit: 'MW', dec: 1, yTitle: label + ' (MW)', rangemode: 'tozero', indexAxis });
  }

  /* ---- plants */
  function pvByYear(t, plants) {
    const rows = plants.rows.filter(r => r[1] === 'Photovoltaic');
    const muns = Array.from(new Set(plants.rows.map(r => r[0]))).sort();
    const years = Array.from(new Set(rows.map(r => r[3]))).sort((a, b) => a - b);
    const data = muns.map((m, i) => ({
      type: 'bar', name: m, x: years,
      y: years.map(y => rows.filter(r => r[0] === m && r[3] === y).reduce((a, r) => a + (r[2] || 0), 0)),
      marker: { color: t.s[MUN_SLOT_BASE - 1 + i], line: { color: t.surface, width: 2 } },
      hovertemplate: `%{x}<br>${m}: %{y:,.0f} kWp<extra></extra>`,
    }));
    return {
      data, height: 340,
      layout: baseLayout(t, {
        barmode: 'stack',
        xaxis: axisStyle(t, { title: axisTitle(t, 'Year of commissioning'), showgrid: false, dtick: 2 }),
        yaxis: axisStyle(t, { title: axisTitle(t, 'Installed PV capacity (kWp)') }),
      }),
      table: {
        columns: ['Year'].concat(muns.map(m => m + ' (kWp)')),
        rows: years.map((y, k) => [y].concat(data.map(d => fmt(d.y[k], 0)))),
      },
    };
  }

  function powerByCategory(t, plants) {
    const muns = Array.from(new Set(plants.rows.map(r => r[0]))).sort();
    const cats = Array.from(new Set(plants.rows.map(r => r[1])));
    const catOrder = Object.keys(CAT_SLOT);
    cats.sort((a, b) => (catOrder.indexOf(a) < 0 ? 99 : catOrder.indexOf(a)) - (catOrder.indexOf(b) < 0 ? 99 : catOrder.indexOf(b)));
    const data = cats.map(c => ({
      type: 'bar', name: c, x: muns,
      y: muns.map(m => plants.rows.filter(r => r[0] === m && r[1] === c).reduce((a, r) => a + (r[2] || 0), 0)),
      width: 0.4,
      marker: { color: CAT_SLOT[c] ? t.s[CAT_SLOT[c] - 1] : t.other, line: { color: t.surface, width: 2 } },
      hovertemplate: `%{x}<br>${c}: %{y:,.0f} kW<extra></extra>`,
    }));
    return {
      data, height: 340,
      layout: baseLayout(t, {
        barmode: 'stack',
        xaxis: axisStyle(t, { showgrid: false }),
        yaxis: axisStyle(t, { title: axisTitle(t, 'Installed power (kW)') }),
      }),
      table: {
        columns: ['Municipality'].concat(cats.map(c => c + ' (kW)')),
        rows: muns.map((m, k) => [m].concat(data.map(d => fmt(d.y[k], 0)))),
      },
    };
  }

  function plantMap(t, plants, geo) {
    const lat0 = 47.545;
    const data = [];
    geo.municipalities.forEach(m => {
      const x = [], y = [];
      m.rings.forEach(ring => { ring.forEach(p => { x.push(p[0]); y.push(p[1]); }); x.push(null); y.push(null); });
      data.push({ type: 'scatter', mode: 'lines', x, y, hoverinfo: 'skip', showlegend: false, line: { color: t.axis, width: 1 } });
    });
    const withXY = plants.rows.filter(r => r[4] !== null && r[5] !== null);
    const maxP = Math.max.apply(null, withXY.map(r => r[2] || 0));
    // powers span 3 kW to several MW: marker diameter on a log scale (6 px at <= 1 kW, 36 px at the largest plant)
    const D_MIN = 6, D_MAX = 36, lmax = Math.log10(Math.max(maxP, 10));
    const diam = p => D_MIN + (D_MAX - D_MIN) * Math.max(0, Math.log10(Math.max(p || 0, 1))) / lmax;
    const cats = Array.from(new Set(withXY.map(r => r[1])));
    const catOrder = Object.keys(CAT_SLOT);
    cats.sort((a, b) => (catOrder.indexOf(a) < 0 ? 99 : catOrder.indexOf(a)) - (catOrder.indexOf(b) < 0 ? 99 : catOrder.indexOf(b)));
    cats.forEach(c => {
      const rr = withXY.filter(r => r[1] === c).sort((a, b) => (b[2] || 0) - (a[2] || 0));   // small ones on top
      data.push({
        type: 'scatter', mode: 'markers', name: c, x: rr.map(r => r[5]), y: rr.map(r => r[4]),
        text: rr.map(r => `${c}<br>${r[0]} · ${fmt(r[2], 1)} kW · since ${r[3]}`),
        hovertemplate: '%{text}<extra></extra>',
        marker: {
          color: CAT_SLOT[c] ? t.s[CAT_SLOT[c] - 1] : t.other, opacity: 0.8, sizemode: 'diameter',
          size: rr.map(r => diam(r[2])), line: { color: t.surface, width: 1 },
        },
      });
    });
    // size key in the lower left corner of the map
    const xs = [], ys = [];
    geo.municipalities.forEach(m => m.rings.forEach(ring => ring.forEach(p => { xs.push(p[0]); ys.push(p[1]); })));
    const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    const keys = [[10, '10 kW'], [100, '100 kW'], [1000, '1 MW']].concat(maxP >= 5000 ? [[maxP, fmt(maxP / 1000, 1) + ' MW']] : []);
    const kx = keys.map((_, i) => x0 + (x1 - x0) * (0.02 + 0.07 * i)), ky = keys.map(() => y0 + (y1 - y0) * 0.04);
    data.push({
      type: 'scatter', mode: 'markers+text', x: kx, y: ky, text: keys.map(k => k[1]), textposition: 'top center',
      textfont: { color: t.muted, size: 11 }, hoverinfo: 'skip', showlegend: false, cliponaxis: false,
      marker: { size: keys.map(k => diam(k[0])), color: 'rgba(0,0,0,0)', line: { color: t.muted, width: 1 } },
    });
    const annotations = geo.municipalities.map(m => {
      const pts = m.rings.reduce((a, ring) => a.concat(ring), []);
      const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      return { x: cx, y: cy, text: m.name, showarrow: false, font: { color: t.muted, size: 12 } };
    });
    return {
      data, height: 520,
      layout: baseLayout(t, {
        margin: { l: 8, r: 8, t: 40, b: 8 }, annotations, hovermode: 'closest',
        xaxis: axisStyle(t, { visible: false, showgrid: false, zeroline: false }),
        yaxis: axisStyle(t, { visible: false, showgrid: false, zeroline: false, scaleanchor: 'x', scaleratio: 1 / Math.cos(lat0 * Math.PI / 180) }),
      }),
      table: {
        columns: ['Municipality', 'Category', 'Power (kW)', 'Since'],
        rows: plants.rows.slice().sort((a, b) => (b[2] || 0) - (a[2] || 0)).slice(0, 60).map(r => [r[0], r[1], fmt(r[2], 1), r[3]]),
        note: 'Largest 60 plants; coordinates are rounded and addresses are not published.',
      },
    };
  }

  /* ------------------------------------------------------------ mounting */
  function tableHTML(tb) {
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    let h = '<table><thead><tr>' + tb.columns.map(c => `<th scope="col">${esc(c)}</th>`).join('') + '</tr></thead><tbody>';
    tb.rows.forEach(r => { h += '<tr>' + r.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>'; });
    h += '</tbody></table>';
    if (tb.note) h += `<p class="meta" style="margin:6px 0 0">${esc(tb.note)}</p>`;
    return h;
  }

  function segmented(options, value, onChange) {
    const el = document.createElement('span');
    el.className = 'seg'; el.setAttribute('role', 'group');
    options.forEach(o => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = o.label; b.setAttribute('aria-pressed', String(o.value === value));
      b.addEventListener('click', () => {
        el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
        onChange(o.value);
      });
      el.appendChild(b);
    });
    return el;
  }

  /** toggle chips for highlighting at most `max` series. selected: [{value, slot}] (mutated); a series keeps its
   *  colour slot while it stays selected, and the oldest selection is dropped when a new one exceeds `max`. */
  function chips(options, selected, max, onChange) {
    const el = document.createElement('span');
    el.className = 'chips'; el.setAttribute('role', 'group');
    const paint = () => el.querySelectorAll('button').forEach(b => {
      const s = selected.find(x => x.value === b.dataset.value);
      b.setAttribute('aria-pressed', String(!!s));
      b.querySelector('.sw').style.background = s ? `var(--s${s.slot + 1})` : 'var(--other)';
    });
    options.forEach(o => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.value = o.value;
      b.innerHTML = '<span class="sw" aria-hidden="true"></span>';
      b.appendChild(document.createTextNode(o.label));
      b.addEventListener('click', () => {
        const i = selected.findIndex(x => x.value === o.value);
        if (i >= 0) selected.splice(i, 1);
        else {
          if (selected.length >= max) selected.shift();
          const used = selected.map(x => x.slot);
          let slot = 0;
          while (used.includes(slot)) slot++;
          selected.push({ value: o.value, slot });
        }
        paint();
        onChange();
      });
      el.appendChild(b);
    });
    paint();
    return el;
  }

  /** card = {el, redraw()}; build(theme) -> spec */
  function makeCard(parent, o) {
    const art = document.createElement('article');
    art.className = 'card' + (o.small ? ' small' : '');
    art.innerHTML = '<header><div><h3></h3><p class="sub"></p></div><div class="ctrl"></div></header>' +
      '<div class="plot" role="img"></div><details class="tbl"><summary>Table view</summary><div class="tbl-body"></div></details>';
    art.querySelector('h3').textContent = o.title;
    const sub = art.querySelector('.sub');
    if (o.sub) sub.textContent = o.sub; else sub.remove();
    const plot = art.querySelector('.plot');
    plot.setAttribute('aria-label', o.title);
    if (o.source) {                      // {text, href}: data source shown under the chart
      const src = document.createElement('p');
      src.className = 'src';
      src.append('Source: ');
      const a = document.createElement('a');
      a.href = o.source.href; a.textContent = o.source.text; a.target = '_blank'; a.rel = 'noopener';
      src.appendChild(a);
      plot.after(src);
    }
    const details = art.querySelector('details');
    const tbody = art.querySelector('.tbl-body');
    if (o.controls) o.controls(art.querySelector('.ctrl'), () => card.redraw());
    parent.appendChild(art);

    const card = {
      el: art, plot, o,
      redraw() {
        card._w = plot.clientWidth;
        const spec = o.build(theme(), { width: card._w });
        plot.style.height = spec.height + 'px';
        window.Plotly.react(plot, spec.data, Object.assign({ height: spec.height, autosize: true }, spec.layout),
          { displayModeBar: false, responsive: true });
        card.spec = spec;
        if (details.open) tbody.innerHTML = tableHTML(spec.table);
      },
    };
    details.addEventListener('toggle', () => { if (details.open && card.spec) tbody.innerHTML = tableHTML(card.spec.table); });
    registry.push(card);
    card.redraw();
    // the grid may reflow after the card is drawn: re-measure whenever the plot width changes
    if (window.ResizeObserver) {
      new ResizeObserver(() => {
        if (Math.abs(plot.clientWidth - (card._w || 0)) > 2) {
          clearTimeout(card._rt);
          card._rt = setTimeout(() => card.redraw(), 60);
        }
      }).observe(plot);
    }
    return card;
  }

  function cleanup() {
    for (let i = registry.length - 1; i >= 0; i--) if (!document.body.contains(registry[i].el)) registry.splice(i, 1);
  }
  function rerenderAll() { cleanup(); registry.forEach(c => c.redraw()); }

  window.DTC = {
    theme, fmt, makeCard, segmented, chips, cleanup, rerenderAll, makeTimes,
    DEMAND_SLOT, DEMAND_LABEL, DEMAND_UNIT, SOLAR_LABEL, ecLabel,
    build: {
      timeSeries, costEmission, costBreakdown, emissionBreakdown, supplyBreakdown, heatCapacity, hourlyProfile,
      pvByYear, powerByCategory, plantMap,
    },
  };
})();
