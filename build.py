#!/usr/bin/env python3
"""Assemble l'application : version PWA (www/), version bureau (electron/app/) et page unique (dist/)."""
import json, os, shutil
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
VERSION = '2.0.0'
TITLE = 'Gestion Auto-École'
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=Barlow:wght@400;500;600&display=swap">'

read = lambda n: open(os.path.join(SRC, n), encoding='utf-8').read()
css, body = read('styles.css'), read('body.html')
js = '\n'.join(read(n) for n in ['data.js', 'core.js', 'views.js', 'dialogs.js'])

def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write(text)

# 1) Page unique (publiée en ligne, données partagées)
write(os.path.join(ROOT, 'dist', 'autoecole-en-ligne.html'),
      f'<title>{TITLE}</title>\n{FONTS}\n<style>{css}</style>\n{body}\n<script>\n{js}\n</script>\n')

# 2) PWA installable
index = f'''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{TITLE}</title>
<meta name="description" content="Gestion complète d'auto-école : inscriptions, paiements, planning, examens, moniteurs, véhicules, finances et code de la route.">
<meta name="theme-color" content="#2b3038">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Auto-École">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
{FONTS}
<style>
:root {{ padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }}
body {{ margin: 0; font-size: 14px; }}
img {{ max-width: 100%; }}
[hidden] {{ display: none !important; }}
{css}
</style>
<script>window.AE_PWA = true;</script>
</head>
<body>
{body}
<script>
{js}
</script>
</body>
</html>
'''
www = os.path.join(ROOT, 'www')
write(os.path.join(www, 'index.html'), index)

manifest = {
    "name": TITLE, "short_name": "Auto-École", "lang": "fr", "dir": "ltr",
    "description": "Inscriptions, paiements, planning, examens, moniteurs, véhicules, finances et code de la route.",
    "start_url": "./index.html", "scope": "./", "display": "standalone", "display_override": ["window-controls-overlay", "standalone"],
    "background_color": "#2b3038", "theme_color": "#2b3038", "orientation": "any", "categories": ["business", "education", "productivity"],
    "icons": [
        {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
        {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
        {"src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}
    ],
    "shortcuts": [
        {"name": "Inscrire un apprenant", "url": "./index.html#apprenants"},
        {"name": "Planning", "url": "./index.html#planning"},
        {"name": "Examens", "url": "./index.html#examens"}
    ]
}
write(os.path.join(www, 'manifest.webmanifest'), json.dumps(manifest, ensure_ascii=False, indent=2))

sw = f'''/* Service worker : fonctionnement hors ligne */
const CACHE = 'autoecole-{VERSION}';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', e => {{ e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); }});
self.addEventListener('activate', e => {{ e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); }});
self.addEventListener('fetch', e => {{
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {{
    e.respondWith(fetch(req).then(r => {{ const copy = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return r; }}).catch(() => caches.match('./index.html')));
    return;
  }}
  if (url.origin === location.origin || /fonts\\.(googleapis|gstatic)\\.com$/.test(url.hostname)) {{
    e.respondWith(caches.match(req).then(hit => {{
      const net = fetch(req).then(r => {{ if (r && (r.ok || r.type === 'opaque')) {{ const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }} return r; }}).catch(() => hit);
      return hit || net;
    }}));
  }}
}});
'''
write(os.path.join(www, 'sw.js'), sw)

# 3) Icônes
def icon(size, maskable=False):
    S = size * 4
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    pad = 0 if maskable else int(S * 0.04)
    d.rounded_rectangle([pad, pad, S - pad, S - pad], radius=0 if maskable else int(S * 0.22), fill=(43, 48, 56, 255))
    k = 0.78 if maskable else 1.0
    c = S / 2
    def P(x, y):
        return (c + (x - 0.5) * S * k, c + (y - 0.5) * S * k)
    d.polygon([P(0.40, 0.42), P(0.60, 0.42), P(0.86, 0.94), P(0.14, 0.94)], fill=(78, 86, 98, 255))
    for y0, y1, w0 in [(0.46, 0.53, 0.012), (0.60, 0.70, 0.017), (0.78, 0.92, 0.024)]:
        d.polygon([P(0.5 - w0, y0), P(0.5 + w0, y0), P(0.5 + w0 * 1.3, y1), P(0.5 - w0 * 1.3, y1)], fill=(242, 183, 5, 255))
    r = 0.20 * S * k
    cx, cy = P(0.5, 0.27)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, 255))
    r2 = r * 0.82
    d.ellipse([cx - r2, cy - r2, cx + r2, cy + r2], fill=(29, 91, 191, 255))
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', int(r * 0.95))
    d.text((cx, cy + r * 0.04), 'AE', font=font, fill=(255, 255, 255, 255), anchor='mm')
    return im.resize((size, size), Image.LANCZOS)

icons = os.path.join(www, 'icons')
os.makedirs(icons, exist_ok=True)
icon(192).save(os.path.join(icons, 'icon-192.png'))
icon(512).save(os.path.join(icons, 'icon-512.png'))
icon(512, True).save(os.path.join(icons, 'maskable-512.png'))
icon(180, True).convert('RGB').save(os.path.join(icons, 'apple-touch-icon.png'))
icon(1024).save(os.path.join(icons, 'icon-1024.png'))
icon(256).save(os.path.join(icons, 'icon-256.png'), sizes=[(256, 256)])
icon(256).save(os.path.join(icons, 'icon.ico'), sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

# 4) Copie pour la version bureau
app_dir = os.path.join(ROOT, 'electron', 'app')
shutil.rmtree(app_dir, ignore_errors=True)
shutil.copytree(www, app_dir)
print('OK : dist/, www/ et electron/app/ générés (version', VERSION + ')')
