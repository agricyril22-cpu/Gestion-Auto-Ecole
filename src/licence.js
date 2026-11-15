/* ============ Licence, période d'essai et mot de passe d'installation ============ */
const LIC = { status: 'none', daysLeft: 0, licence: null, deviceId: '', reason: '', eff: todayISO(), raw: {} };
const LIC_CHAMPS = ['produit', 'id', 'client', 'ecole', 'appareil', 'type', 'emise', 'expire'];
const licCanon = p => JSON.stringify(Object.fromEntries(LIC_CHAMPS.map(k => [k, String(p[k] ?? '')])));
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const DESK = window.AE_DESKTOP || null;

const LicStore = {
  async read() {
    const parts = [];
    try { parts.push(JSON.parse(localStorage.getItem('ae-lic') || '{}')); } catch (e) {}
    try { const v = await IDB.get('licence-state'); if (v) parts.push(v); } catch (e) {}
    if (DESK) { try { parts.unshift(DESK.get() || {}); } catch (e) {} }
    const out = {};
    for (const p of parts) {
      if (!out.deviceId && p.deviceId) out.deviceId = p.deviceId;
      if (p.firstRun && (!out.firstRun || p.firstRun < out.firstRun)) out.firstRun = p.firstRun;
      if (p.lastSeen && (!out.lastSeen || p.lastSeen > out.lastSeen)) out.lastSeen = p.lastSeen;
      if (!out.licence && p.licence) out.licence = p.licence;
      if (p.installUnlocked) out.installUnlocked = true;
    }
    return out;
  },
  async write(s) {
    try { localStorage.setItem('ae-lic', JSON.stringify(s)); } catch (e) {}
    try { await IDB.set('licence-state', s); } catch (e) {}
    if (DESK) { try { DESK.set(s); } catch (e) {} }
  }
};
function newDeviceId() {
  const a = new Uint8Array(6); crypto.getRandomValues(a);
  const h = [...a].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `AE-${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}`;
}
async function sha256hex(t) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }

async function verifyLicence(file) {
  if (!file || typeof file !== 'object' || !file.licence || !file.signature) return { ok: false, why: 'Ce fichier n’est pas un fichier de licence valide.' };
  const p = file.licence;
  if (p.produit !== 'gestion-auto-ecole') return { ok: false, why: 'Cette licence concerne un autre logiciel.' };
  try {
    const key = await crypto.subtle.importKey('jwk', LICENCE_CLE_PUBLIQUE, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b64d(file.signature), new TextEncoder().encode(licCanon(p)));
    if (!ok) return { ok: false, why: 'Signature invalide : cette licence n’a pas été délivrée par l’éditeur ou elle a été modifiée.' };
  } catch (e) { return { ok: false, why: 'La licence n’a pas pu être vérifiée sur cet appareil.' }; }
  if (p.appareil && p.appareil !== '*' && p.appareil !== LIC.deviceId) return { ok: false, why: `Cette licence a été délivrée pour un autre appareil (${p.appareil}). L’identifiant de cet appareil est ${LIC.deviceId}.` };
  if (p.expire && p.expire < LIC.eff) return { ok: false, why: `Cette licence a expiré le ${fmtLong(p.expire)}.` };
  return { ok: true };
}

function computeTrial() {
  const used = Math.max(0, daysBetween(LIC.raw.firstRun, LIC.eff));
  LIC.daysLeft = Math.max(0, (Number(LICENCE_CONFIG.essaiJours) || 30) - used);
  LIC.status = LIC.daysLeft > 0 ? 'trial' : 'expired';
}

async function licenceInit() {
  if (IN_ARTIFACT) { LIC.status = 'online'; return; }
  const s = await LicStore.read(); const t = todayISO();
  if (!s.deviceId) s.deviceId = newDeviceId();
  if (!s.firstRun) s.firstRun = t;
  s.lastSeen = s.lastSeen && s.lastSeen > t ? s.lastSeen : t;   // une horloge reculée ne prolonge pas l'essai
  LIC.raw = s; LIC.deviceId = s.deviceId; LIC.eff = s.lastSeen;
  await LicStore.write(s);
  await installGate();
  LIC.licence = null; LIC.reason = '';
  if (s.licence) {
    const v = await verifyLicence(s.licence);
    if (v.ok) { LIC.status = 'licensed'; LIC.licence = s.licence.licence; return; }
    LIC.reason = v.why;
  }
  computeTrial();
  if (LIC.status === 'expired') await licenceGate();
}

async function importLicence(msgEl) {
  const f = await pickFile('.lic,.json,application/json'); if (!f) return false;
  let data; try { data = JSON.parse(await readAsText(f)); } catch (e) { data = null; }
  const v = await verifyLicence(data);
  if (!v.ok) { if (msgEl) msgEl.textContent = v.why; else toast(v.why); return false; }
  LIC.raw.licence = data; await LicStore.write(LIC.raw);
  LIC.status = 'licensed'; LIC.licence = data.licence; LIC.reason = '';
  toast('Licence activée : merci !'); scheduleRender(); return true;
}

function gateShell(id, inner) {
  const el = document.createElement('div'); el.className = 'lock'; el.id = id; el.style.zIndex = id === 'install-gate' ? 120 : 110;
  el.innerHTML = `<div class="gate">${inner}</div>`; document.body.appendChild(el); return el;
}

/* Mot de passe d'installation (version bureau macOS / Linux ; sous Windows il est demandé par l'installateur) */
function installGate() {
  return new Promise(resolve => {
    let cfgI = null; try { cfgI = DESK && DESK.install ? DESK.install() : null; } catch (e) {}
    if (!cfgI || !cfgI.hash || cfgI.platform === 'win32' || LIC.raw.installUnlocked) return resolve();
    const el = gateShell('install-gate', `<strong class="gt">Installation protégée</strong><p>Saisissez le mot de passe d’installation fourni avec le logiciel.</p>
      <form id="ig-form"><input id="ig-pwd" type="password" autocomplete="off" aria-label="Mot de passe d’installation" required><button class="btn">Valider</button></form><small id="ig-msg" class="gmsg"></small>`);
    setTimeout(() => $('#ig-pwd').focus(), 50);
    $('#ig-form').addEventListener('submit', async e => { e.preventDefault();
      if (await sha256hex('autoecole-install:' + $('#ig-pwd').value) === cfgI.hash) { LIC.raw.installUnlocked = true; await LicStore.write(LIC.raw); el.remove(); resolve(); }
      else { $('#ig-msg').textContent = 'Mot de passe incorrect.'; $('#ig-pwd').value = ''; } });
  });
}

/* Écran de fin d'essai */
function licenceGate() {
  return new Promise(resolve => {
    const v = LICENCE_CONFIG.vendeur || {};
    const el = gateShell('licence-gate', `<strong class="gt">Période d’essai terminée</strong>
      <p>Les ${LICENCE_CONFIG.essaiJours} jours d’essai gratuit sont écoulés. Pour continuer à utiliser l’application, importez le fichier de licence fourni par votre revendeur.</p>
      ${LIC.reason ? `<p class="gmsg">${esc(LIC.reason)}</p>` : ''}
      <div class="devid"><span>Identifiant de cet appareil, à communiquer pour obtenir votre licence</span><b id="lg-id">${esc(LIC.deviceId)}</b><button type="button" class="btn ghost sm" id="lg-copy">Copier</button></div>
      <button type="button" class="btn" id="lg-import">Importer le fichier de licence (.lic)</button>
      <small id="lg-msg" class="gmsg"></small>
      ${v.nom || v.telephone || v.email ? `<p class="gsmall">Pour acheter une licence : ${esc(v.nom || '')}${v.telephone ? ' · ' + esc(v.telephone) : ''}${v.email ? ' · ' + esc(v.email) : ''}</p>` : ''}
      <p class="gsmall">Vos données sont conservées. <button type="button" class="btn link sm" id="lg-backup">Télécharger une sauvegarde de mes données</button></p>`);
    $('#lg-copy').onclick = async () => { try { await navigator.clipboard.writeText(LIC.deviceId); toast('Identifiant copié'); } catch (e) { const r = document.createRange(); r.selectNodeContents($('#lg-id')); getSelection().removeAllRanges(); getSelection().addRange(r); } };
    $('#lg-import').onclick = async () => { if (await importLicence($('#lg-msg'))) { el.remove(); resolve(); } };
    $('#lg-backup').onclick = () => backup();
  });
}

function licenceBanner() {
  if (LIC.status === 'trial') return `<div class="banner lic"><span>Version d’essai : <b>${LIC.daysLeft} jour${LIC.daysLeft > 1 ? 's' : ''}</b> restant${LIC.daysLeft > 1 ? 's' : ''}.</span><a class="btn sm" href="#parametres">Activer ma licence</a></div>`;
  if (LIC.status === 'licensed' && LIC.licence.expire) { const d = daysBetween(LIC.eff, LIC.licence.expire); if (d <= 30) return `<div class="banner lic"><span>Votre licence expire le <b>${fmtLong(LIC.licence.expire)}</b>. Pensez à la renouveler.</span><a class="btn sm" href="#parametres">Importer une nouvelle licence</a></div>`; }
  return '';
}
function licenceSection() {
  if (IN_ARTIFACT) return '';
  const l = LIC.licence;
  const statut = LIC.status === 'licensed' ? `<span class="pill ok">Licence active</span>` : LIC.status === 'trial' ? `<span class="pill warn">Essai : ${LIC.daysLeft} jour(s) restant(s)</span>` : `<span class="pill bad">Non activée</span>`;
  return `<div class="card" style="max-width:820px"><h3>Licence</h3><div class="row" style="margin-bottom:10px">${statut}</div>
    <div class="info">${l ? `<div><span>Titulaire</span><b>${esc(l.client)}</b></div><div><span>École</span><b>${esc(l.ecole || '—')}</b></div><div><span>N° de licence</span><b>${esc(l.id)}</b></div><div><span>Validité</span><b>${l.expire ? 'Jusqu’au ' + fmtLong(l.expire) : 'Définitive'}</b></div>` : ''}<div><span>Identifiant de cet appareil</span><b id="dev-id">${esc(LIC.deviceId)}</b></div></div>
    ${LIC.reason && LIC.status !== 'licensed' ? `<p class="warn-t" style="margin-top:8px">${esc(LIC.reason)}</p>` : ''}
    <div class="row" style="margin-top:12px"><button class="btn" data-act="lic-import">${l ? 'Remplacer la licence' : 'Importer le fichier de licence'}</button><button class="btn ghost" data-act="lic-copy">Copier l’identifiant de l’appareil</button></div>
    <p class="note" style="margin-top:8px">Pour obtenir une licence, communiquez l’identifiant de cet appareil à votre revendeur${LICENCE_CONFIG.vendeur && LICENCE_CONFIG.vendeur.telephone ? ' (' + esc(LICENCE_CONFIG.vendeur.telephone) + ')' : ''}.</p></div>`;
}
