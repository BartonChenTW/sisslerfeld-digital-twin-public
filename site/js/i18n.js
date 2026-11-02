/* English / German (Switzerland). English is the source language:
 *   I18N.L('English text', {var: value})  -> German text when the page is in German, else the English text;
 *                                            {var} placeholders are filled in either way
 *   <el data-i18n="key">English</el>      -> innerHTML replaced by HTML_DE[key] when the page is in German
 * Language: ?lang=de|en, else the stored choice, else the browser language. Swiss spelling (ss, not ß).
 */
(function () {
  'use strict';
  const q = new URLSearchParams(location.search);
  let lang = q.get('lang');
  if (lang !== 'de' && lang !== 'en') {
    try { lang = localStorage.getItem('dt-lang'); } catch (e) { lang = null; }
  }
  if (lang !== 'de' && lang !== 'en') lang = /^de\b/i.test(navigator.language || '') ? 'de' : 'en';
  try { localStorage.setItem('dt-lang', lang); } catch (e) { /* storage may be blocked */ }

  /* ---------------------------------------------------------------- strings built by the scripts */
  const DE = {
    // general
    'Theme: {mode}': 'Darstellung: {mode}', 'auto': 'automatisch', 'light': 'hell', 'dark': 'dunkel',
    'Something went wrong while loading "{where}": {msg}': 'Beim Laden von «{where}» ist ein Fehler aufgetreten: {msg}',
    'Table view': 'Tabelle', 'Source: ': 'Quelle: ', 'Daily mean': 'Tagesmittel', 'Hourly': 'Stündlich',
    'Select at least one run.': 'Mindestens einen Lauf auswählen.',
    // units
    'MCHF/yr': 'Mio. CHF/a', 'GWh/yr': 'GWh/a', 'ktCO2-eq/yr': 'kt CO2-eq/a', 'tCO2/yr': 't CO2/a', 'ktCO2/yr': 'kt CO2/a',
    // result tiles and cards
    'Total cost': 'Gesamtkosten', 'Emissions': 'Emissionen', 'Electricity import': 'Strombezug',
    'Peak grid import': 'Maximaler Netzbezug', 'PV generation': 'PV-Produktion',
    'Total cost vs emissions': 'Gesamtkosten und Emissionen',
    'Highlighted: selected run(s); grey: all other runs': 'Hervorgehoben: ausgewählte Läufe; grau: alle anderen Läufe',
    'Cost breakdown': 'Kostenaufteilung', 'MCHF per year; income counts as negative': 'Mio. CHF pro Jahr; Erlöse zählen negativ',
    'Energy supply': 'Energieversorgung', 'Annual energy by carrier, GWh per year': 'Jährliche Energie nach Energieträger, GWh pro Jahr',
    'Carbon emissions': 'CO2-Emissionen', 'tCO2-eq per year by energy carrier': 't CO2-eq pro Jahr nach Energieträger',
    'Residential heating systems': 'Heizsysteme der Wohngebäude', 'Installed capacity by technology, MW': 'Installierte Leistung nach Technologie, MW',
    'Electricity import from the grid': 'Strombezug aus dem Netz',
    'Power over the simulated year, MW': 'Leistung über das simulierte Jahr, MW', ' (first three runs shown)': ' (die ersten drei Läufe)',
    // chart axes, tables, tooltips
    'Other runs': 'Andere Läufe', 'Run': 'Lauf', 'Profile': 'Profil', 'Year': 'Jahr', 'Municipality': 'Gemeinde', 'Category': 'Kategorie',
    'Total cost (MCHF/yr)': 'Gesamtkosten (Mio. CHF/a)', 'Emissions (ktCO2-eq/yr)': 'Emissionen (kt CO2-eq/a)',
    'Cost (MCHF/yr), income negative': 'Kosten (Mio. CHF/a), Erlöse negativ', ' (export credit)': ' (Gutschrift Export)',
    'Carbon emissions (tCO2-eq/yr)': 'CO2-Emissionen (t CO2-eq/a)', 'Energy supply (GWh/yr)': 'Energieversorgung (GWh/a)',
    'PV self-consumption': 'PV-Eigenverbrauch', 'PV export': 'PV-Einspeisung',
    'Installed heating capacity (MW)': 'Installierte Heizleistung (MW)',
    'Hour': 'Stunde', 'Day': 'Tag', 'Hour of the simulated year': 'Stunde des simulierten Jahres', 'Day of the simulated year': 'Tag des simulierten Jahres',
    'Month of the simulated year (mean)': 'Monat des simulierten Jahres (Mittel)', 'Month (mean)': 'Monat (Mittel)', 'Month {n}': 'Monat {n}',
    'Year of commissioning': 'Jahr der Inbetriebnahme', 'Installed PV capacity (kWp)': 'Installierte PV-Leistung (kWp)',
    'Installed power (kW)': 'Installierte Leistung (kW)', 'Power (kW)': 'Leistung (kW)', 'Since': 'Seit', 'since': 'seit', 'Other': 'Andere',
    'Largest 60 plants; coordinates are rounded and addresses are not published.': 'Die 60 grössten Anlagen; Koordinaten gerundet, Adressen werden nicht veröffentlicht.',
    // energy carriers, cost items, technologies
    'Electricity': 'Strom', 'Natural gas': 'Erdgas', 'Waste heat': 'Abwärme', 'Industrial wood': 'Industrieholz', 'Wood': 'Holz',
    'Oil': 'Heizöl', 'Hydrogen': 'Wasserstoff', 'Steam': 'Dampf',
    'Energy import cost': 'Energiebezug', 'CO2 import cost': 'CO2-Kosten Bezug', 'Capital cost': 'Kapitalkosten',
    'Fixed O&M cost': 'Fixe Betriebskosten', 'Variable O&M cost': 'Variable Betriebskosten', 'Energy export income': 'Erlös Energieexport',
    'Carbon export income': 'Erlös CO2-Export', 'Load shifting': 'Lastverschiebung',
    'Heat pump': 'Wärmepumpe', 'Electric boiler': 'Elektrokessel', 'Gas boiler': 'Gaskessel', 'Wood boiler': 'Holzkessel', 'Oil boiler': 'Ölkessel',
    'Photovoltaic': 'Photovoltaik', 'Biomass': 'Biomasse', 'Hydroelectric power': 'Wasserkraft',
    // profiles
    'Space heating': 'Raumwärme', 'Space cooling': 'Raumkühlung', 'Hot water': 'Warmwasser', 'Building electricity': 'Gebäudestrom',
    'Electric vehicles': 'Elektrofahrzeuge', 'Industrial production (normalised shape)': 'Industrieproduktion (normierter Verlauf)',
    'kWh/h (normalised to 1 GWh/yr)': 'kWh/h (normiert auf 1 GWh/a)',
    'Flat roof': 'Flachdach', 'North': 'Nord', 'North-east': 'Nordost', 'East': 'Ost', 'South-east': 'Südost', 'South': 'Süd',
    'South-west': 'Südwest', 'West': 'West', 'North-west': 'Nordwest', 'Ground-mounted': 'Freifläche',
    'Solar irradiation by roof orientation': 'Solarstrahlung nach Dachausrichtung',
    'kW/m² (kWh/m² per hour). Pick up to 3 orientations to highlight; the others are shown in grey.':
      'kW/m² (kWh/m² pro Stunde). Bis zu 3 Ausrichtungen hervorheben; die übrigen sind grau.',
    'Other orientations': 'Andere Ausrichtungen', 'Irradiation (kW/m²)': 'Einstrahlung (kW/m²)',
    'No profile data is published for {d}; the simulation results for this date are still available below.':
      'Für {d} sind keine Profile veröffentlicht; die Simulationsergebnisse dieses Datums stehen unten trotzdem zur Verfügung.',
    'Reference year 2016: the profiles are the underlying training data. The industrial profile is a normalised shape (1 GWh/yr).':
      'Referenzjahr 2016: Die Profile sind die zugrundeliegenden Trainingsdaten. Das Industrieprofil ist ein normierter Verlauf (1 GWh/a).',
    'Profiles of {d}: PV and demand are estimated from the weather of the preceding 365 days with a machine-learning model trained on 2016/2018 data. The industrial profile is a normalised shape.':
      'Profile vom {d}: PV und Nachfrage sind mit einem auf Daten von 2016/2018 trainierten Machine-Learning-Modell aus dem Wetter der vorangehenden 365 Tage geschätzt. Das Industrieprofil ist ein normierter Verlauf.',
    '2016 (reference year)': '2016 (Referenzjahr)', ' · results only': ' · nur Ergebnisse',
    // scenario parameters (labels from the data)
    'Industrial demand increase rate (%)': 'Zunahme Industrienachfrage (%)', 'Population growth (%)': 'Bevölkerungswachstum (%)',
    'Industrial energy saving (%)': 'Energieeinsparung Industrie (%)', 'Max PV installation (MW)': 'Maximale PV-Leistung (MW)',
    'Heating system renovation rate (%)': 'Sanierungsrate Heizsysteme (%)', 'EV penetration (%)': 'Anteil Elektrofahrzeuge (%)',
    'Carbon price (CHF/tCO2)': 'CO2-Preis (CHF/t CO2)',
    // overview
    'Prototype: results are model outputs under stated assumptions, not forecasts, and may change as the model is updated.':
      'Prototyp: Die Ergebnisse sind Modellrechnungen unter den genannten Annahmen, keine Prognosen, und können sich mit Weiterentwicklungen des Modells ändern.',
    'Data build {built} · latest weather profile {profile} · plant data snapshot {plants} · {n} simulation runs':
      'Datenstand {built} · neuestes Wetterprofil {profile} · Anlagendaten vom {plants} · {n} Simulationsläufe',
    'The latest monthly simulation (run {name}, weather up to {profile}): {cost} MCHF/yr, {co2} ktCO2-eq/yr.':
      'Die neueste Monatssimulation (Lauf {name}, Wetter bis {profile}): {cost} Mio. CHF/a, {co2} kt CO2-eq/a.',
    'All {n} pre-computed runs in one table; compare up to three.': 'Alle {n} vorberechneten Läufe in einer Tabelle; bis zu drei vergleichen.',
    // energy data
    'Snapshot of {snap} (latest commissioning {latest}) · {n} plants, of which {npv} PV with {mwp} MWp. Source: BFE, opendata.swiss.':
      'Stand {snap} (neueste Inbetriebnahme {latest}) · {n} Anlagen, davon {npv} PV mit {mwp} MWp. Quelle: BFE, opendata.swiss.',
    'Swiss Federal Office of Energy (BFE), Electricity production plants, opendata.swiss (snapshot {snap})':
      'Bundesamt für Energie (BFE), Elektrizitätsproduktionsanlagen, opendata.swiss (Stand {snap})',
    'Installed PV capacity by year': 'Installierte PV-Leistung nach Jahr', 'kWp, by municipality': 'kWp, nach Gemeinde',
    'Installed power by technology': 'Installierte Leistung nach Technologie', 'kW, by municipality': 'kW, nach Gemeinde',
    'Electricity production plants': 'Elektrizitätsproduktionsanlagen',
    'Marker size shows the installed power (log scale, see key); positions are rounded':
      'Die Punktgrösse zeigt die installierte Leistung (logarithmische Skala, siehe Legende); Positionen gerundet',
    'Hourly weather of the 365 days before {d} (UTC). The PV and demand profiles are simulated from it. Source: Open-Meteo.com.':
      'Stündliches Wetter der 365 Tage vor dem {d} (UTC). Daraus werden die PV- und Nachfrageprofile berechnet. Quelle: Open-Meteo.com.',
    'Outdoor temperature': 'Aussentemperatur', 'Shortwave solar radiation': 'Globalstrahlung',
    'Temperature (°C)': 'Temperatur (°C)', 'Irradiance (W/m²)': 'Einstrahlung (W/m²)', 'Mean per day or hourly': 'Tagesmittel oder stündlich',
    // today
    'Run "{name}" · simulated {date} · weather profile {profile}': 'Lauf «{name}» · gerechnet am {date} · Wetterprofil {profile}',
    '{from} to {to}': '{from} bis {to}',
    // sandbox
    'Pre-computed run found:': 'Vorberechneter Lauf gefunden:', '(simulated {date}).': '(gerechnet am {date}).',
    ' Compare with the reference run of this profile ({name})': ' Mit dem Referenzlauf dieses Profils vergleichen ({name})',
    'This combination has not been simulated yet.': 'Diese Kombination wurde noch nicht simuliert.',
    'The closest pre-computed runs are listed below; or request this scenario.': 'Unten stehen die ähnlichsten vorberechneten Läufe; oder fordern Sie dieses Szenario an.',
    'Set the sliders to this pre-computed run': 'Regler auf diesen vorberechneten Lauf setzen',
    'Request this scenario': 'Dieses Szenario anfordern', 'Copy scenario code': 'Szenario-Code kopieren', 'Copied': 'Kopiert', 'Copy failed': 'Kopieren fehlgeschlagen',
    "Requests are reviewed by {who} and run on Empa's systems; the result is added to this page. If you leave an e-mail address you will be notified.":
      'Anfragen werden von {who} geprüft und auf Systemen der Empa gerechnet; das Ergebnis erscheint auf dieser Seite. Mit Angabe einer E-Mail-Adresse werden Sie benachrichtigt.',
    'the team': 'dem Team',
    'Please simulate this scenario for the Sisslerfeld digital twin:': 'Bitte dieses Szenario für den digitalen Zwilling Sisslerfeld simulieren:',
    '(Optional: your name / reason)': '(Optional: Ihr Name / Zweck)', 'Sisslerfeld digital twin: scenario request': 'Digitaler Zwilling Sisslerfeld: Szenario-Anfrage',
    'industry +%v%': 'Industrie +%v%', 'population +%v%': 'Bevölkerung +%v%', 'industry saving %v%': 'Einsparung Industrie %v%',
    'PV max %v MW': 'PV max. %v MW', 'heating renovation %v%': 'Heizungssanierung %v%', 'EV %v%': 'E-Fahrzeuge %v%',
    'CO2 price %v CHF/t': 'CO2-Preis %v CHF/t', 'profile {d}': 'Profil {d}', 'default settings': 'Standardeinstellungen',
    // runs
    'Ind. demand +%': 'Industrie +%', 'Population +%': 'Bevölkerung +%', 'Ind. saving %': 'Einspar. Ind. %', 'PV max MW': 'PV max. MW',
    'Heating renov. %': 'Heizungssan. %', 'EV %': 'E-Fahrz. %', 'CO2 price CHF/t': 'CO2-Preis CHF/t',
    'Date': 'Datum', 'Cost MCHF/yr': 'Kosten Mio. CHF/a', 'Total annual cost': 'Jährliche Gesamtkosten', 'CO2 kt/yr': 'CO2 kt/a',
    'Total annual emissions': 'Jährliche Gesamtemissionen', 'Note': 'Bemerkung', 'Compare {name}': '{name} vergleichen',
    'same scenario as {id}': 'gleiches Szenario wie {id}', '{n} of {m} runs shown': '{n} von {m} Läufen angezeigt',
    'You can compare up to three runs: untick one first.': 'Es lassen sich höchstens drei Läufe vergleichen: zuerst einen abwählen.',
    'Total cost vs emissions of all runs': 'Gesamtkosten und Emissionen aller Läufe', 'Highlighted: runs ticked in the table': 'Hervorgehoben: in der Tabelle ausgewählte Läufe',
    'auto-generated': 'automatisch erzeugt', 'single-hub, stage reference': 'Single-Hub, Referenzstufe',
    'multi-hub, stage reference': 'Multi-Hub, Referenzstufe', 'multi-hub, stage 2040': 'Multi-Hub, Stufe 2040',
    // footer
    'Contact:': 'Kontakt:', 'Contact': 'Kontakt', 'Data and software': 'Daten und Software',
    'Electricity production plants: Swiss Federal Office of Energy (BFE), via {a}. Street addresses are not shown and coordinates are rounded.':
      'Elektrizitätsproduktionsanlagen: Bundesamt für Energie (BFE), über {a}. Adressen werden nicht gezeigt, Koordinaten sind gerundet.',
    'Weather: {a} (CC BY 4.0).': 'Wetter: {a} (CC BY 4.0).', 'Map and municipality boundaries: © swisstopo.': 'Karte und Gemeindegrenzen: © swisstopo.',
    'Charts: {a} (MIT), bundled with this page.': 'Diagramme: {a} (MIT), mit dieser Seite ausgeliefert.',
    'Energy model: {ehubx} (open source, GPL-3.0), {uesl}, {empa}.': 'Energiemodell: {ehubx} (Open Source, GPL-3.0), {uesl}, {empa}.',
    'Prototype. Results are model outputs under stated assumptions, not forecasts.': 'Prototyp. Die Ergebnisse sind Modellrechnungen unter den genannten Annahmen, keine Prognosen.',
    'Source on GitHub': 'Quellcode auf GitHub',
  };

  /* ---------------------------------------------------------------- static page text (data-i18n="key") */
  const HTML_DE = {
    'title.home': 'Digitaler Zwilling Energie Sisslerfeld',
    'title.data': 'Energiedaten · Digitaler Zwilling Energie Sisslerfeld',
    'title.today': 'Heutiges System · Digitaler Zwilling Energie Sisslerfeld',
    'title.sandbox': 'Sandkasten · Digitaler Zwilling Energie Sisslerfeld',
    'title.runs': 'Alle Läufe · Digitaler Zwilling Energie Sisslerfeld',
    'nav.home': 'Übersicht', 'nav.data': '1 · Energiedaten', 'nav.today': '2 · Heutiges System',
    'nav.sandbox': '3 · Sandkasten', 'nav.runs': '4 · Alle Läufe',
    'noscript': 'Diese Seite benötigt JavaScript, um die Diagramme zu zeichnen.',
    'hero.badge': 'Prototyp',
    'hero.h1': 'Digitaler Zwilling des Energiesystems Sisslerfeld',
    'hero.lead': 'Ein Ergebnis des Projekts NCCR Sisslerfeld, entwickelt vom Urban Energy Systems Lab der Empa. ' +
      'Erkunden Sie, wie sich das Energiesystem des Sisslerfelds heute und unter anderen Annahmen zu Industrie, ' +
      'Bevölkerung, PV, Heizung, Mobilität und CO2-Preis verhält.',
    'hero.map': 'Karte: © swisstopo',
    'about.h2': 'Über diese Seite',
    'about.lead': 'Dies ist eine statische Kopie des digitalen Zwillings zum Anschauen. Alle Zahlen sind mit dem ' +
      'Energy-Hub-Modell der Empa (ehubX) <strong>vorberechnet</strong> und hier veröffentlicht; die Seite läuft ' +
      'vollständig in Ihrem Browser und braucht keinen Server. Detaillierte Modelleingaben (Technologie- und ' +
      'Kostenparameter, Daten einzelner Unternehmen) sind nicht Teil dieser Kopie.',
    'about.explore': 'Erkunden',
    'go.data.t': 'Energiedaten des Gebiets',
    'go.data.d': 'Elektrizitätsproduktionsanlagen in den vier Gemeinden und das Wetter des vergangenen Jahres.',
    'go.today.t': 'Heutiges Energiesystem',
    'go.sandbox.t': 'Energiesystem-Sandkasten',
    'go.sandbox.d': 'Industrie, Bevölkerung, PV, Heizung, Mobilität und CO2-Preis verändern; noch nicht simulierte Szenarien anfordern.',
    'go.runs.t': 'Alle Simulationsläufe',
    'data.h2': '1 · Energiedaten des Gebiets',
    'data.lead': 'Elektrizitätsproduktionsanlagen in Stein, Eiken, Münchwilen und Sisseln sowie das Wetter des vergangenen ' +
      'Jahres, aus dem die simulierten PV- und Nachfrageprofile berechnet werden.',
    'data.h3a': '1a · Elektrizitätsproduktionsanlagen', 'data.h3b': '1b · Wetter der letzten 365 Tage',
    'today.h2': '2 · Heutiges Energiesystem',
    'today.lead': 'Das Energiesystem des Sisslerfelds, simuliert mit dem Wetter der letzten 365 Tage und den heutigen ' +
      'Einstellungen. Jeden Monat kommt ein neuer Lauf dazu.',
    'today.assume.h': 'Was «heute» hier bedeutet',
    'today.a1': '<strong>Eine Simulation, keine Messung und keine Prognose.</strong> Die Zahlen stammen aus dem ' +
      'Energy-Hub-Modell ehubX. Sie zeigen, wie ein kostenoptimales Energiesystem für das Gebiet die Nachfrage unter ' +
      'heutigen Bedingungen decken würde. Es sind keine gemessenen Daten der Anlagen und Netze im Gebiet.',
    'today.a2': '<strong>Wetter des vergangenen Jahres.</strong> «Heute» verwendet das stündliche Wetter der 365 Tage ' +
      'vor dem Lauf, bis zum Ende des Vortags (UTC); für diesen Lauf: <span id="today-window">das Jahr vor dem ' +
      'Profildatum</span>. Die Daten stammen aus dem historischen Wetterarchiv von Open-Meteo für einen Punkt im Gebiet ' +
      '(47.55°&nbsp;N, 8.01°&nbsp;O); die letzten Tage des Zeitfensters können vorläufige Werte sein.',
    'today.a3': '<strong>Nachfrage- und Solarprofile werden aus diesem Wetter geschätzt.</strong> Raumwärme, ' +
      'Raumkühlung, Warmwasser und Gebäudestrom stammen aus Machine-Learning-Modellen (Random Forests) mit ' +
      'Aussentemperatur, Stunde und Wochentag; die Solarstrahlung jeder Dachausrichtung aus Temperatur, ' +
      'Globalstrahlung, Tag des Jahres und Stunde. Trainiert sind die Modelle mit den Nachfrageprofilen 2016 und den ' +
      'Solarprofilen 2018 des Modells.',
    'today.a4': '<strong>Die Industrie wird nicht neu geschätzt.</strong> Das Profil der Industrieproduktion ist der ' +
      'normierte Verlauf von 2016, ausgerichtet auf den Kalender des Wetterzeitfensters. Die jährliche ' +
      'Industrienachfrage bleibt auf dem Referenzniveau.',
    'today.a5': '<strong>Alles andere mit den heutigen Einstellungen.</strong> Die Szenarioparameter stehen auf ihren ' +
      'Standardwerten: <span id="today-params"></span>. Technologiekosten und Energiepreise für den Bezug sind feste ' +
      'Modelleingaben, keine aktuellen Marktpreise.',
    'today.a6': '<strong>Modellaufbau.</strong> Das ganze Gebiet wird als ein Energy Hub abgebildet, jede Stunde des ' +
      'Jahres wird simuliert (keine Typtage), und das Modell minimiert die jährlichen Gesamtkosten in Kenntnis des ' +
      'ganzen Jahres.',
    'today.a7': '<strong>Monatliche Aktualisierung.</strong> Am ersten Tag jedes Monats kommt ein neuer Lauf mit dem ' +
      'Wetter bis zum Ende des Vormonats dazu; frühere «Heute»-Läufe (Namen mit R und dem Laufdatum) bleiben unter ' +
      '<a href="runs.html">Alle Läufe</a>.',
    'sandbox.h2': '3 · Energiesystem-Sandkasten',
    'sandbox.lead': 'Ändern Sie die wichtigsten Annahmen und sehen Sie das simulierte System. Jede Kombination ist ein ' +
      'vorberechneter Lauf; ist Ihre noch nicht simuliert, können Sie sie anfordern.',
    'sandbox.h3a': '3a · Zeitreihen', 'sandbox.profile': 'Wetterjahr (Profil):', 'sandbox.demand': 'Nachfrageprofile',
    'sandbox.h3b': '3b · Wichtigste Modellparameter',
    'runs.h2': '4 · Alle Simulationsläufe',
    'runs.lead': 'Alle vorberechneten Läufe. Bis zu drei auswählen, um sie unten zu vergleichen.',
    'runs.show': 'Anzeigen:', 'runs.all': 'alle Läufe', 'runs.single': 'Single-Hub-Läufe', 'runs.multi': 'Multi-Hub-Läufe',
    'runs.compare': 'Vergleich',
  };

  function L(s, vars) {
    let out = lang === 'de' && Object.prototype.hasOwnProperty.call(DE, s) ? DE[s] : s;
    if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
    return out;
  }

  /** links to the other pages carry the language, so that a shared link opens in the same language */
  function withLang(href) {
    const [path, hash] = href.split('#');
    const [file, query] = path.split('?');
    const p = new URLSearchParams(query || '');
    p.set('lang', lang);
    return `${file}?${p.toString()}${hash !== undefined ? '#' + hash : ''}`;
  }

  function applyHtml(root) {
    document.documentElement.lang = lang === 'de' ? 'de-CH' : 'en';
    if (lang === 'de') {
      (root || document).querySelectorAll('[data-i18n]').forEach(e => {
        const k = e.getAttribute('data-i18n');
        if (HTML_DE[k] !== undefined) e.innerHTML = HTML_DE[k];
      });
    }
    (root || document).querySelectorAll('a[href]').forEach(a => {
      const h = a.getAttribute('href');
      if (/^[\w-]+\.html([?#].*)?$/.test(h)) a.setAttribute('href', withLang(h));
    });
    const btn = document.getElementById('lang-btn');
    if (btn) {
      btn.textContent = lang === 'de' ? 'English' : 'Deutsch';
      btn.setAttribute('lang', lang === 'de' ? 'en' : 'de');
      btn.onclick = () => {
        const next = lang === 'de' ? 'en' : 'de';
        try { localStorage.setItem('dt-lang', next); } catch (e) { /* ignore */ }
        const p = new URLSearchParams(location.search);
        p.set('lang', next);
        location.search = p.toString();
      };
    }
  }

  window.I18N = {
    lang, L, applyHtml, withLang,
    locale: lang === 'de' ? 'de-CH' : 'en-US',
    // Plotly locale: month names on time axes, Swiss number format (1'234.5)
    plotlyLocale: {
      moduleType: 'locale', name: 'de-CH', dictionary: {},
      format: {
        days: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
        shortDays: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
        months: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
        shortMonths: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
        date: '%d.%m.%Y', decimal: '.', thousands: '’',
      },
    },
  };
  applyHtml();
})();
