# Sisslerfeld energy digital twin: public page

A static, read-only web page that shows results of the Sisslerfeld energy system digital twin
(NCCR Sisslerfeld, Urban Energy Systems Lab, Empa). It needs no server and no network access once loaded:
all charts are drawn in the browser from pre-computed data files.

**This repository contains only the published copy.** The energy model, the detailed input data and the
simulation pipeline are maintained internally; they are not part of this repository.

## Run locally

Any static file server works, and the page also opens directly from disk:

```bash
python -m http.server --directory site 8000     # then open http://localhost:8000
# or simply open site/index.html in a browser
```

No build step, no `npm`. The charting library (Plotly.js, MIT) is bundled in `site/vendor/`.

## Layout

```
site/
  index.html  css/  js/  assets/  vendor/
  config.js          contact, "request a scenario" settings
  data/
    manifest.js      list of runs, slider definitions, scenario lookup
    runs/*.js        one result file per simulation run
    profiles/*.js    demand and PV profiles per weather year
    weather/*.js     hourly weather
    plants.js geo.js electricity production plants, municipality outlines
tools/check_site.py  sanity checks (also run by CI before every deploy)
.github/workflows/pages.yml   deploys site/ to GitHub Pages
```

Data files are plain scripts that call `window.DT.set("<key>", {...})`, so the page does not depend on
`fetch()` and works from `file://` as well.

## Data files are generated, do not edit them

`site/data/` is produced by an internal export step that keeps only what is allowed to be public (aggregated
model results, normalised industrial profile, public plant data without street addresses). Changes to these
files belong in that export, not here. `python tools/check_site.py site` verifies the files before they are
published.

## Configure the "Request this scenario" button

Edit `site/config.js`:

* **Without a form** (default): the button opens a pre-filled e-mail to the contact.
* **With a Microsoft Form:** create a form with one dropdown per slider parameter plus the profile date, open
  *Share, Get pre-filled URL*, fill in a sample answer for every question and copy the link. Each answer
  appears in the link as `r<id>=<value>`. Put the form link into `requestFormUrl` and map the parameter names to
  those ids in `requestFormParams` (keys: `profile`, `industrial demand`, `population`, `industrial efficiency`,
  `PV installation`, `heating renew`, `EV share`, `carbon price`). The page then opens the form with the current
  slider values already filled in.

A scenario can also be shared as a link: `index.html?scenario=profile=2025-07-07; industrial demand=20; ...`.

## Publish with GitHub Pages

Repository *Settings, Pages, Source: GitHub Actions*. Every push to `main` runs the checks and deploys `site/`.

## Sources and licences

* Electricity production plants: Swiss Federal Office of Energy (BFE), opendata.swiss
* Weather: Open-Meteo.com (CC BY 4.0)
* Map image and municipality boundaries: swisstopo
* Plotly.js: MIT (see `site/vendor/PLOTLY_LICENSE`)

The licence of the data and of the page code is still to be decided.
