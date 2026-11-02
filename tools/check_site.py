"""
Sanity checks for the static site (stdlib only; also run by CI before every deploy):

    python tools/check_site.py site

  - every data file parses and is not too large
  - no field that must never be published (street address, post code, ids, e-mail addresses)
  - the page loads nothing from external hosts (it must work offline)
  - the manifest and the data files agree
Exit code 1 if anything is wrong.
"""

import json
import re
import sys
from pathlib import Path

MAX_FILE_KB = 1500
MAX_TOTAL_MB = 60
FORBIDDEN_KEYS = ('Address', 'PostCode', 'xtf_id', 'email', 'Email')
EMAIL_RE = re.compile(r'[\w.+-]+@[\w-]+\.[\w.-]+')
# tags that LOAD something (plain <a href> links are navigation and fine), CSS url()/@import
EXTERNAL_RE = re.compile(
    r'''<(?:script|img|iframe|link|source|video|audio|embed)\b[^>]*\b(?:src|href)\s*=\s*["']?(?:https?:)?//'''
    r'''|url\(\s*["']?(?:https?:)?//|@import\s+["']?(?:https?:)?//''', re.I)


def parse_data_file(path):
    text = path.read_text(encoding='utf-8')
    m = re.fullmatch(r'window\.DT\.set\(("[^"]+"),(.*)\);\s*', text, re.S)
    if not m:
        raise ValueError('not a window.DT.set(...) file')
    return json.loads(m.group(2)), json.loads(m.group(1))


def main(site):
    site = Path(site)
    data = site / 'data'
    errors = []
    total = 0

    # --- data files
    manifest = None
    for p in sorted(data.rglob('*.js')):
        size = p.stat().st_size
        total += size
        rel = p.relative_to(data).as_posix()
        if size > MAX_FILE_KB * 1024:
            errors.append(f'{rel}: {size/1024:.0f} kB is larger than {MAX_FILE_KB} kB')
        try:
            obj, key = parse_data_file(p)
        except Exception as e:
            errors.append(f'{rel}: {e}')
            continue
        if key != rel[:-3]:
            errors.append(f'{rel}: registers itself as "{key}"')
        raw = p.read_text(encoding='utf-8')
        for k in FORBIDDEN_KEYS:
            if f'"{k}"' in raw:
                errors.append(f'{rel}: forbidden key "{k}"')
        if EMAIL_RE.search(raw):
            errors.append(f'{rel}: contains an e-mail address')
        if rel == 'manifest.js':
            manifest = obj

    # --- everything else (excluding the bundled library)
    for p in sorted(site.rglob('*')):
        if p.is_file():
            total += p.stat().st_size if 'data' not in p.relative_to(site).parts else 0
    for p in list(site.glob('*.html')) + list((site / 'css').glob('*.css')) + list((site / 'js').glob('*.js')):
        if EXTERNAL_RE.search(p.read_text(encoding='utf-8')):
            errors.append(f'{p.relative_to(site).as_posix()}: loads a resource from an external host')

    # --- manifest consistency
    if manifest is None:
        errors.append('data/manifest.js is missing')
    else:
        for r in manifest['runs']:
            if not (data / 'runs' / f'{r["id"]}.js').exists():
                errors.append(f'manifest run "{r["id"]}" has no data file')
        for d in manifest['profiles_available']:
            if not (data / 'profiles' / f'{d}.js').exists():
                errors.append(f'profile {d} has no data file')
        for run_id in manifest['lookup'].values():
            if not any(r['id'] == run_id for r in manifest['runs']):
                errors.append(f'lookup points to unknown run "{run_id}"')
        for need in ('plants.js', 'geo.js'):
            if not (data / need).exists():
                errors.append(f'data/{need} is missing')

    if total > MAX_TOTAL_MB * 1024 * 1024:
        errors.append(f'site is {total/1e6:.1f} MB, limit {MAX_TOTAL_MB} MB')

    if errors:
        print('SITE CHECK FAILED')
        for e in errors:
            print('  -', e)
        return 1
    print(f'site check passed ({total/1e6:.1f} MB)')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else 'site'))
