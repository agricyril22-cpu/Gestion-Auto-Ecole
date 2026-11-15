/* ============ Utilitaires ============ */
const APP_VERSION = '2.0.0';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
const iso = d => { const z = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); };
const todayISO = () => iso(new Date());
const toDate = s => new Date(s + 'T00:00:00');
const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + n); return iso(d); };
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
const monday = s => { const d = toDate(s); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return iso(d); };
const fmtDate = (s, o) => { if (!s) return '—'; const d = toDate(s); return isNaN(d) ? '—' : d.toLocaleDateString('fr-FR', o || { day: '2-digit', month: 'short', year: 'numeric' }); };
const fmtLong = s => fmtDate(s, { day: 'numeric', month: 'long', year: 'numeric' });
const by = k => (a, b) => String(a[k] ?? '').localeCompare(String(b[k] ?? ''));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sum = (arr, f) => arr.reduce((t, x) => t + (Number(f(x)) || 0), 0);
function age(dn) { if (!dn) return null; const d = toDate(dn), t = new Date(); if (isNaN(d)) return null; let a = t.getFullYear() - d.getFullYear(); if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--; return a; }
const mins = t => { const [h, m] = String(t || '0:0').split(':'); return (+h || 0) * 60 + (+m || 0); };

function enLettres(n) {
  n = Math.round(Math.abs(Number(n) || 0)); if (n === 0) return 'zéro';
  const u = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const d = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
  const diz = r => { if (r < 20) return u[r]; const di = Math.floor(r / 10), un = r % 10;
    if (di === 7 || di === 9) return d[di] + (di === 7 && un === 1 ? ' et ' : '-') + u[10 + un];
    if (un === 0) return d[di] + (di === 8 ? 's' : '');
    if (un === 1 && di !== 8) return d[di] + ' et un';
    return d[di] + '-' + u[un]; };
  const cent = (x, final) => { let s = ''; const c = Math.floor(x / 100), r = x % 100;
    if (c) { s = c === 1 ? 'cent' : u[c] + ' cent'; if (r === 0 && c > 1 && final) s += 's'; }
    if (r) s += (s ? ' ' : '') + diz(r); return s; };
  const parts = [];
  for (const [v, name] of [[1e9, 'milliard'], [1e6, 'million'], [1e3, 'mille']]) {
    const q = Math.floor(n / v); if (!q) continue;
    if (v === 1e3) parts.push(q === 1 ? 'mille' : cent(q, false) + ' mille');
    else parts.push(cent(q, true) + ' ' + name + (q > 1 ? 's' : ''));
    n %= v;
  }
  if (n) parts.push(cent(n, true));
  return parts.join(' ');
}

/* ============ Environnement ============ */
const IN_ARTIFACT = !!(window.claude && typeof window.claude.use === 'function');
const IS_PWA = !!window.AE_PWA;
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; scheduleRender(); });
window.addEventListener('appinstalled', () => { deferredInstall = null; toast('Application installée'); scheduleRender(); });
if (IS_PWA && 'serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
function applyTheme() { let t = 'auto'; try { t = localStorage.getItem('ae-theme') || 'auto'; } catch (e) {} if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); }
if (!IN_ARTIFACT) applyTheme();

/* ============ État & stockage ============ */
const COLS = ['apprenants', 'seances', 'examens', 'categories', 'quiz', 'moniteurs', 'vehicules', 'depenses'];
const S = { config: {}, mode: 'loading', loaded: {}, note: '', ro: false,
  view: 'tableau', f: { q: '', statut: '', cat: '' }, week: monday(todayISO()), moniteur: '', exTab: 'avenir', fam: 'all',
  finYear: new Date().getFullYear(), finMonth: new Date().getMonth(), repYear: new Date().getFullYear(), appTab: 'resume' };
COLS.forEach(c => S[c] = []);
let DB = null;
const cfg = () => ({ nom: 'Mon auto-école', devise: 'FCFA', seuilCode: 35, moniteurs: [], vehicules: [], ...S.config });
const money = n => (Number(n) || 0).toLocaleString('fr-FR') + ' ' + esc(cfg().devise || '');

const IDB = {
  db: null,
  open() { return new Promise((res, rej) => { const r = indexedDB.open('autoecole-pro', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async get(k) { this.db = this.db || await this.open(); return new Promise((res, rej) => { const q = this.db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  async set(k, v) { this.db = this.db || await this.open(); return new Promise((res, rej) => { const t = this.db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); }
};
function snapshotState() { const d = { config: S.config, version: APP_VERSION }; COLS.forEach(c => d[c] = S[c]); return d; }
function applyState(d) { COLS.forEach(c => S[c] = Array.isArray(d[c]) ? d[c] : []); S.config = d.config || {}; }
async function loadLocal() {
  let d = null;
  try { d = await IDB.get('state'); } catch (e) {}
  if (!d) { try { d = JSON.parse(localStorage.getItem('autoecole-pro-state') || localStorage.getItem('autoecole-local-v1') || 'null'); } catch (e) {} }
  if (d) applyState(d);
}
let saveT = 0;
function saveLocal() {
  clearTimeout(saveT);
  saveT = setTimeout(async () => {
    const d = snapshotState();
    try { await IDB.set('state', d); } catch (e) { try { localStorage.setItem('autoecole-pro-state', JSON.stringify(d)); } catch (e2) { toast('Enregistrement local impossible : espace du navigateur plein ?'); } }
  }, 200);
}
function writeErr(e) {
  const c = e && e.code;
  if (c === 'invalid_argument') toast('Enregistrement refusé : vous n’avez peut-être pas le droit de modifier ces données.');
  else if (c === 'quota_exceeded') toast('Espace de stockage plein : supprimez d’anciennes données.');
  else toast('Enregistrement impossible pour le moment. Réessayez dans un instant.');
}
async function put(col, id, data) {
  const body = JSON.parse(JSON.stringify(data)); delete body.id;
  if (DB) { try { await DB.collection(col).doc(id).set(body); } catch (e) { writeErr(e); throw e; } }
  else { const arr = S[col]; const i = arr.findIndex(x => x.id === id); const row = { ...body, id }; if (i >= 0) arr[i] = row; else arr.push(row); saveLocal(); scheduleRender(); }
}
async function del(col, id) {
  if (DB) { try { await DB.collection(col).doc(id).delete(); } catch (e) { writeErr(e); throw e; } }
  else { S[col] = S[col].filter(x => x.id !== id); saveLocal(); scheduleRender(); }
}
async function putConfig(data) {
  if (DB) { try { await DB.doc('config/ecole').set(data); } catch (e) { writeErr(e); throw e; } }
  else { S.config = data; saveLocal(); scheduleRender(); }
}

async function startLocal() {
  S.mode = 'local'; await loadLocal(); COLS.forEach(c => S.loaded[c] = true);
  if (!S.config.initDone) {
    if (!S.categories.length) S.categories = CATS_DEFAUT.map(c => ({ ...c, id: c.code }));
    S.config = { ...S.config, initDone: true }; saveLocal();
  }
  scheduleRender();
  if (S.config.pinHash) showLock();
}
async function init() {
  route();
  if (!IN_ARTIFACT) { await startLocal(); return; }
  const c = window.claude;
  const timer = setTimeout(() => { if (!COLS.every(k => S.loaded[k])) { S.note = 'Les données ne répondent pas encore. Vérifiez votre connexion ; la page se mettra à jour toute seule.'; scheduleRender(); } }, 10000);
  let db = null; try { db = await c.use('db'); } catch (e) { db = null; }
  if (!db) { clearTimeout(timer); await startLocal(); return; }
  DB = db; S.mode = 'db';
  c.use('user').then(async u => { if (!u) return; try { const w = await u.can('data.write'); if (w === false) { document.body.classList.add('ro'); S.ro = true; scheduleRender(); } } catch (e) {} }).catch(() => {});
  COLS.forEach(col => {
    DB.collection(col).onSnapshot(snap => {
      S[col] = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      S.loaded[col] = true;
      if (!snap.metadata.fromCache && COLS.every(k => S.loaded[k])) { clearTimeout(timer); S.note = ''; }
      scheduleRender();
    }, () => { clearTimeout(timer); S.note = 'La connexion aux données a été interrompue. Rechargez la page plus tard.'; scheduleRender(); });
  });
  DB.doc('config/ecole').onSnapshot(d => { S.config = d.exists ? d.data() : {}; scheduleRender(); }, () => {});
}

/* ============ Sécurité locale (code PIN) ============ */
async function hashPin(p) {
  const txt = 'autoecole:' + p;
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  catch (e) { let h = 5381; for (const ch of txt) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0; return 'd' + h.toString(16); }
}
function showLock() {
  if ($('#lock')) return;
  const el = document.createElement('div'); el.className = 'lock'; el.id = 'lock';
  el.innerHTML = `<form id="lock-form"><strong style="font-family:var(--f-display);font-size:1.6rem">${esc(cfg().nom)}</strong><span>Saisissez le code d’accès</span><input id="lock-pin" type="password" inputmode="numeric" autocomplete="current-password" aria-label="Code d’accès" required><button class="btn">Déverrouiller</button><small id="lock-msg" style="color:var(--mark)"></small></form>`;
  document.body.appendChild(el);
  setTimeout(() => $('#lock-pin').focus(), 50);
  $('#lock-form').addEventListener('submit', async e => { e.preventDefault(); const h = await hashPin($('#lock-pin').value);
    if (h === S.config.pinHash) el.remove(); else { $('#lock-msg').textContent = 'Code incorrect.'; $('#lock-pin').value = ''; } });
}

/* ============ Fichiers : téléchargement, impression, images ============ */
async function saveFile(name, data, mime) {
  if (IN_ARTIFACT) {
    try { const d = await window.claude.use('downloads'); if (!d) { toast('Le téléchargement n’est pas disponible dans cette vue.'); return; } await d.save({ filename: name, data }); }
    catch (e) { if (e && e.code !== 'declined') toast('Téléchargement impossible ici.'); }
    return;
  }
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000);
}
const DOC_CSS = () => { const css = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n'); const i = css.indexOf('.doc {'); return i >= 0 ? css.slice(i) : ''; };
function printDoc(title, html) {
  const full = `<div class="doc">${html}</div>`;
  if (!IN_ARTIFACT) { $('#print').innerHTML = full; setTimeout(() => window.print(), 80); return; }
  const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;600&display=swap"><style>body{margin:0;padding:24px;background:#fff} @page{size:A4;margin:14mm} ${DOC_CSS()}</style></head><body>${full}<script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`;
  saveFile(title.replace(/[^\w\-À-ÿ ]+/g, '').trim().replace(/\s+/g, '_') + '.html', page, 'text/html');
}
function pickFile(accept) {
  return new Promise(res => { const inp = $('#file-in'); inp.value = ''; inp.accept = accept || ''; inp.onchange = () => res(inp.files[0] || null); inp.click(); });
}
function readAsText(f) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsText(f); }); }
function resizeImage(file, max, type = 'image/jpeg') {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); const x = c.getContext('2d'); if (type === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); } x.drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL(type, 0.82)); }; img.onerror = () => rej(new Error('image')); img.src = r.result; };
    r.onerror = () => rej(r.error); r.readAsDataURL(file);
  });
}
const csvCell = v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const toCSV = (head, rows) => '﻿' + [head, ...rows].map(r => r.map(csvCell).join(';')).join('\r\n');

/* ============ Calculs métier ============ */
const appById = id => S.apprenants.find(a => a.id === id);
const nomC = a => a ? `${a.prenom || ''} ${a.nom || ''}`.trim() || 'Sans nom' : 'Apprenant supprimé';
const initials = a => ((a?.prenom || '')[0] || '') + ((a?.nom || '')[0] || '');
const avatar = (a, sm) => `<div class="avatar ${sm ? 'sm' : ''}">${a && a.photo ? `<img src="${esc(a.photo)}" alt="">` : esc(initials(a).toUpperCase() || '?')}</div>`;
const catsSorted = () => S.categories.slice().sort((a, b) => (a.ordre ?? 99) - (b.ordre ?? 99) || by('code')(a, b));
const catBy = code => S.categories.find(c => c.code === code);
const paye = a => sum(a.paiements || [], p => p.montant);
const reste = a => Math.max(0, (Number(a.montantTotal) || 0) - paye(a));
const minutesConduite = (a, mon) => sum(S.seances.filter(s => s.apprenantId === a.id && s.type === 'conduite' && s.statut === 'effectuee' && (!mon || s.moniteur === mon)), s => s.duree);
const minutesCode = a => sum(S.seances.filter(s => s.apprenantId === a.id && s.type === 'code' && s.statut === 'effectuee'), s => s.duree);
const fmtH = m => { const h = Math.floor(m / 60), r = Math.round(m % 60); return r ? `${h} h ${String(r).padStart(2, '0')}` : `${h} h`; };
const exPill = a => a && a.exemple ? ' <span class="pill ex">exemple</span>' : '';
const monName = m => `${m.prenom || ''} ${m.nom || ''}`.trim();
const vehLabel = v => `${v.modele || 'Véhicule'} (${v.immat || '—'})`;
const allMoniteurs = () => [...new Set([...S.moniteurs.filter(m => m.actif !== false).map(monName), ...(cfg().moniteurs || []), ...S.seances.map(s => s.moniteur).filter(Boolean)])].filter(Boolean);
const allVehicules = () => [...new Set([...S.vehicules.map(vehLabel), ...(cfg().vehicules || []), ...S.seances.map(s => s.vehicule).filter(Boolean)])].filter(Boolean);
const livretPct = a => { const n = COMPETENCES.reduce((t, g) => t + g.items.length, 0); const lv = a.livret || {}; let s = 0; COMPETENCES.forEach((g, gi) => g.items.forEach((_, ii) => s += Number(lv[gi + '-' + ii] || 0))); return Math.round(100 * s / (3 * n)); };
const docsManquants = a => DOCS.filter((_, i) => !(a.docs || {})[i]);
function nextDossier() { const y = new Date().getFullYear(); const re = new RegExp('^AE-' + y + '-(\\d+)$'); const n = Math.max(0, ...S.apprenants.map(a => { const m = re.exec(a.dossier || ''); return m ? +m[1] : 0; })); return `AE-${y}-${String(n + 1).padStart(4, '0')}`; }
function nextRecu() { const y = new Date().getFullYear(); const re = new RegExp('^R-' + y + '-(\\d+)$'); const n = Math.max(0, ...S.apprenants.flatMap(a => (a.paiements || []).map(p => { const m = re.exec(p.no || ''); return m ? +m[1] : 0; }))); return `R-${y}-${String(n + 1).padStart(5, '0')}`; }
function overlaps(a, b) { if (a.date !== b.date) return false; const a1 = mins(a.heure), a2 = a1 + (+a.duree || 60), b1 = mins(b.heure), b2 = b1 + (+b.duree || 60); return a1 < b2 && b1 < a2; }
function conflicts(se) {
  if (se.statut === 'annulee') return [];
  return S.seances.filter(o => o.id !== se.id && o.statut !== 'annulee' && overlaps(se, o)).map(o => {
    const why = [];
    if (se.moniteur && o.moniteur === se.moniteur) why.push('moniteur ' + se.moniteur);
    if (se.vehicule && o.vehicule === se.vehicule) why.push('véhicule ' + se.vehicule);
    if (se.apprenantId && o.apprenantId === se.apprenantId) why.push('apprenant');
    return why.length ? { o, why } : null;
  }).filter(Boolean);
}
const allPayments = () => S.apprenants.flatMap(a => (a.paiements || []).map((p, i) => ({ ...p, a, i })));

function computeAlerts() {
  const t = todayISO(); const out = [];
  S.examens.filter(e => e.date >= t && daysBetween(t, e.date) <= 7).forEach(e => out.push({ lvl: 'info', txt: `Examen ${EXT[e.type] || e.type} (${e.categorie}) le ${fmtDate(e.date, { weekday: 'long', day: 'numeric', month: 'long' })} — ${(e.candidats || []).length} candidat(s)`, act: 'open-ex', id: e.id }));
  S.vehicules.forEach(v => {
    [['assuranceExp', 'Assurance'], ['visiteExp', 'Visite technique']].forEach(([k, l]) => { if (!v[k]) return; const d = daysBetween(t, v[k]);
      if (d < 0) out.push({ lvl: 'bad', txt: `${l} expirée : ${vehLabel(v)} (depuis le ${fmtDate(v[k])})`, act: 'edit-veh', id: v.id });
      else if (d <= 30) out.push({ lvl: 'warn', txt: `${l} de ${vehLabel(v)} expire le ${fmtDate(v[k])}`, act: 'edit-veh', id: v.id }); });
    if (v.vidangeKm && v.km && Number(v.km) >= Number(v.vidangeKm) - 500) out.push({ lvl: Number(v.km) >= Number(v.vidangeKm) ? 'bad' : 'warn', txt: `Vidange à prévoir : ${vehLabel(v)} (${Number(v.km).toLocaleString('fr-FR')} km / ${Number(v.vidangeKm).toLocaleString('fr-FR')} km)`, act: 'edit-veh', id: v.id });
    if (v.statut === 'panne') out.push({ lvl: 'warn', txt: `${vehLabel(v)} est indisponible (en panne)`, act: 'edit-veh', id: v.id });
  });
  S.moniteurs.filter(m => m.actif !== false && m.autorisationExp).forEach(m => { const d = daysBetween(t, m.autorisationExp);
    if (d < 0) out.push({ lvl: 'bad', txt: `Autorisation d’enseigner expirée : ${monName(m)}`, act: 'edit-mon', id: m.id });
    else if (d <= 60) out.push({ lvl: 'warn', txt: `Autorisation d’enseigner de ${monName(m)} expire le ${fmtDate(m.autorisationExp)}`, act: 'edit-mon', id: m.id }); });
  const actifs = S.apprenants.filter(a => !['diplome', 'abandon'].includes(a.statut));
  actifs.filter(a => reste(a) > 0 && a.dateInscription && daysBetween(a.dateInscription, t) > 30 && paye(a) < (Number(a.montantTotal) || 0) / 2).forEach(a => out.push({ lvl: 'warn', txt: `Paiement en retard : ${nomC(a)} a réglé ${money(paye(a))} sur ${money(a.montantTotal)}`, act: 'open-app', id: a.id }));
  const incomplets = actifs.filter(a => docsManquants(a).length);
  if (incomplets.length) out.push({ lvl: 'info', txt: `${incomplets.length} dossier(s) incomplet(s) : pièces manquantes`, act: 'go', id: 'apprenants' });
  const soon = S.seances.filter(s => s.date >= t && s.date <= addDays(t, 7) && conflicts(s).length);
  if (soon.length) out.push({ lvl: 'bad', txt: `${soon.length} séance(s) en conflit dans les 7 prochains jours (même moniteur, véhicule ou apprenant)`, act: 'go', id: 'planning' });
  return out;
}

/* ============ En-tête des documents imprimables ============ */
function docHead(title, sub) {
  const c = cfg();
  return `<div class="dhd"><div>${c.logo ? `<img src="${esc(c.logo)}" alt="">` : ''}<div class="big">${esc(c.nom)}</div><div class="small">${[c.adresse, c.ville].filter(Boolean).map(esc).join(', ')}${c.telephone ? '<br>Tél. ' + esc(c.telephone) : ''}${c.email ? ' · ' + esc(c.email) : ''}${c.agrement ? '<br>Agrément n° ' + esc(c.agrement) : ''}${c.nif ? ' · NIF/RCCM ' + esc(c.nif) : ''}</div></div><div style="text-align:right"><h1>${title}</h1>${sub ? `<div class="small">${sub}</div>` : ''}</div></div>`;
}
