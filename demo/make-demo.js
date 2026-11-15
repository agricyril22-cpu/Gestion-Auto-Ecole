// Enregistre la vidéo de démonstration de Gestion Auto-École.
// Usage : servir www/ sur http://localhost:8766 puis `node demo/make-demo.js`
const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, 'out');
const URL = 'http://localhost:8766/index.html';

/* ---------- Données fictives de démonstration ---------- */
function seed() {
  let r = 7; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const t = todayISO(); const add = (n) => addDays(t, n);
  const cats = CATS_DEFAUT.map(c => ({ ...c, id: c.code, tarif: { AM: 60000, A1: 120000, A2: 150000, A: 180000, B: 250000, BE: 120000, C1: 300000, C: 400000, CE: 250000, D1: 350000, D: 450000, DE: 250000 }[c.code] }));
  const mons = [['KONAN', 'Serge', 'B, BE'], ['DIABATÉ', 'Moussa', 'B, C, CE'], ['ASSI', 'Clarisse', 'A, A2, B']].map(([n, p, c], i) => ({ id: 'm' + i, nom: n, prenom: p, categories: c, telephone: '07 00 00 0' + i + ' 1' + i, autorisation: 'AE-' + (2101 + i), autorisationExp: i === 2 ? add(40) : add(500), actif: true }));
  const vehs = [
    { id: 'v0', modele: 'Toyota Yaris', immat: 'AB-214-CI', categorie: 'B', statut: 'dispo', km: 48210, vidangeKm: 48500, assuranceExp: add(18), visiteExp: add(160) },
    { id: 'v1', modele: 'Peugeot 208', immat: 'AC-877-CI', categorie: 'B', statut: 'dispo', km: 31540, vidangeKm: 35000, assuranceExp: add(210), visiteExp: add(90) },
    { id: 'v2', modele: 'Yamaha YBR 125', immat: 'MT-310-CI', categorie: 'A', statut: 'dispo', km: 12050, vidangeKm: 14000, assuranceExp: add(120), visiteExp: add(300) }
  ];
  const V = vehs.map(vehLabel), M = mons.map(monName);
  const people = [['KONÉ', 'Mariam', 'F', 'B', 'conduite'], ['TRAORÉ', 'Ibrahim', 'M', 'B', 'code'], ['MENSAH', 'Ama', 'F', 'B', 'examen'], ['N’GUESSAN', 'Paul', 'M', 'C', 'conduite'], ['DIOP', 'Fatou', 'F', 'B', 'diplome'], ['BAMBA', 'Yao', 'M', 'A', 'conduite'], ['OUÉDRAOGO', 'Salif', 'M', 'B', 'inscrit'], ['KOUAMÉ', 'Grâce', 'F', 'B', 'code'], ['SOW', 'Aminata', 'F', 'B', 'conduite'], ['ADJOVI', 'Koffi', 'M', 'CE', 'conduite'], ['TOURÉ', 'Awa', 'F', 'B', 'diplome'], ['EKRA', 'Jean-Marc', 'M', 'B', 'code'], ['CAMARA', 'Bintou', 'F', 'A2', 'inscrit'], ['YAO', 'Christelle', 'F', 'B', 'abandon']];
  const apps = people.map(([nom, prenom, sexe, cat, statut], i) => {
    const ins = add(-12 - i * 17); const tot = cats.find(c => c.code === cat).tarif; const p = [];
    const parts = statut === 'diplome' ? [0.5, 0.5] : i % 3 === 0 ? [0.4] : [0.4, 0.3];
    parts.forEach((k, j) => p.push({ montant: Math.round(tot * k / 5000) * 5000, date: addDays(ins, j * 21), mode: pick(['Espèces', 'Mobile money', 'Virement']), motif: j ? 'Deuxième versement' : 'Acompte à l’inscription', no: '' }));
    const lv = {}; const lvl = { inscrit: 0, code: 0.3, conduite: 1.6, examen: 2.4, diplome: 3, abandon: 0.5 }[statut];
    COMPETENCES.forEach((g, gi) => g.items.forEach((_, ii) => lv[gi + '-' + ii] = Math.max(0, Math.min(3, Math.round(lvl - gi * 0.5 + rnd() * 0.8)))));
    return { id: 'a' + i, dossier: '', nom, prenom, sexe, categorie: cat, statut, dateInscription: ins, dateNaissance: (1985 + (i * 3) % 20) + '-0' + (1 + i % 9) + '-1' + (i % 9), telephone: '05 0' + i + ' 00 00 ' + (10 + i), piece: 'CI00' + (40210 + i * 37), adresse: 'Quartier ' + pick(['Plateau', 'Cocody', 'Riviera', 'Marcory', 'Yopougon']), montantTotal: tot, paiements: p, livret: lv, docs: { 0: true, 1: true, 2: i % 4 !== 1, 3: i % 3 !== 0, 4: true, 5: i % 5 !== 2 }, ...(statut === 'diplome' ? { datePermis: add(-20 - i) } : {}) };
  });
  apps.slice().sort((a, b) => a.dateInscription.localeCompare(b.dateInscription)).forEach((a, k) => a.dossier = 'AE-2026-' + String(k + 1).padStart(4, '0'));
  let rn = 0; apps.flatMap(a => a.paiements).sort((x, y) => x.date.localeCompare(y.date)).forEach(p => p.no = 'R-2026-' + String(++rn).padStart(5, '0'));
  const ses = []; const mon = monday(t);
  for (let d = -7; d < 14; d++) {
    const day = addDays(mon, d); if (toDate(day).getDay() === 0) continue;
    ['07:30', '09:00', '10:30', '14:00', '15:30'].forEach((h, k) => {
      if (rnd() < 0.35) return;
      const a = pick(apps.filter(x => ['conduite', 'examen'].includes(x.statut)));
      const past = day < t;
      ses.push({ id: 's' + ses.length, date: day, heure: h, duree: k === 2 ? 90 : 60, type: 'conduite', apprenantId: a.id, moniteur: M[k % 3], vehicule: a.categorie === 'A' ? V[2] : V[k % 2], statut: past ? 'effectuee' : 'prevue' });
    });
    if (d % 2 === 0) ses.push({ id: 's' + ses.length, date: day, heure: '17:00', duree: 120, type: 'code', apprenantId: '', groupe: 'Code — groupe du soir', moniteur: M[2], statut: day < t ? 'effectuee' : 'prevue' });
  }
  const dc = addDays(mon, 8); ses.push({ id: 'sx1', date: dc, heure: '11:00', duree: 60, type: 'conduite', apprenantId: 'a0', moniteur: M[0], vehicule: V[0], statut: 'prevue' }, { id: 'sx2', date: dc, heure: '11:30', duree: 60, type: 'conduite', apprenantId: 'a8', moniteur: M[0], vehicule: V[1], statut: 'prevue' });
  const exs = [
    { id: 'e0', date: add(5), heure: '08:00', type: 'code', categorie: 'B', lieu: 'Centre d’examen de la ville', candidats: [{ id: 'a1', resultat: 'attente' }, { id: 'a7', resultat: 'attente' }, { id: 'a11', resultat: 'attente' }] },
    { id: 'e1', date: add(12), heure: '07:30', type: 'conduite', categorie: 'B', lieu: 'Centre d’examen de la ville', candidats: [{ id: 'a2', resultat: 'attente' }, { id: 'a0', resultat: 'attente' }] },
    { id: 'e2', date: add(-30), heure: '08:00', type: 'code', categorie: 'B', lieu: 'Centre d’examen de la ville', candidats: [{ id: 'a0', resultat: 'admis' }, { id: 'a8', resultat: 'admis' }, { id: 'a2', resultat: 'admis' }, { id: 'a13', resultat: 'ajourne' }] },
    { id: 'e3', date: add(-21), heure: '07:30', type: 'conduite', categorie: 'B', lieu: 'Centre d’examen de la ville', candidats: [{ id: 'a4', resultat: 'admis' }, { id: 'a10', resultat: 'admis' }, { id: 'a6', resultat: 'absent' }] },
    { id: 'e4', date: add(-60), heure: '08:00', type: 'conduite', categorie: 'C', lieu: 'Centre poids lourds', candidats: [{ id: 'a3', resultat: 'ajourne' }] }
  ];
  const deps = []; const DC = ['Carburant', 'Entretien véhicule', 'Salaires', 'Loyer', 'Électricité / eau', 'Frais d’examen'];
  for (let mI = 0; mI < 11; mI++) DC.forEach((c, k) => { if (rnd() < 0.25 && c !== 'Salaires' && c !== 'Loyer') return; deps.push({ id: 'd' + deps.length, date: `2026-${String(mI + 1).padStart(2, '0')}-${String(3 + k * 4).padStart(2, '0')}`, categorie: c, libelle: c === 'Salaires' ? 'Salaires des moniteurs' : c === 'Carburant' ? 'Carburant véhicules école' : c, montant: { Carburant: 90000, 'Entretien véhicule': 45000, Salaires: 450000, Loyer: 150000, 'Électricité / eau': 35000, 'Frais d’examen': 60000 }[c] + Math.round(rnd() * 8) * 5000, mode: 'Espèces', vehicule: c === 'Carburant' || c === 'Entretien véhicule' ? pick(V) : '' }); });
  // historique d'encaissements sur l'année
  for (let mI = 0; mI < 10; mI++) { const n = 3 + Math.floor(rnd() * 5); for (let k = 0; k < n; k++) { const a = apps[(mI + k) % apps.length]; a.paiements.push({ montant: 50000 + Math.round(rnd() * 6) * 25000, date: `2026-${String(mI + 1).padStart(2, '0')}-${String(5 + k * 3).padStart(2, '0')}`, mode: pick(['Espèces', 'Mobile money']), motif: 'Versement', no: 'R-2026-' + String(++rn).padStart(5, '0') }); } }
  apps.forEach(a => { const s = a.paiements.reduce((x, p) => x + p.montant, 0); if (a.statut === 'diplome' || s > a.montantTotal) a.montantTotal = Math.max(a.montantTotal, s); });
  const quiz = [];
  apps.filter(a => ['code', 'conduite', 'examen'].includes(a.statut)).forEach((a, i) => { for (let k = 0; k < 3; k++) quiz.push({ id: 'q' + quiz.length, apprenantId: a.id, date: add(-k * 6 - i), mode: k === 0 ? 'examen' : 'mixte', score: k === 0 ? 30 + Math.floor(rnd() * 10) : 6 + Math.floor(rnd() * 5), total: k === 0 ? 40 : 10 }); });
  applyState({ apprenants: apps, seances: ses, examens: exs, categories: cats, quiz, moniteurs: mons, vehicules: vehs, depenses: deps,
    config: { initDone: true, nom: 'Auto-École La Réussite', adresse: '12, avenue des Écoles', ville: 'Centre-ville', telephone: '00 00 00 00 00', email: 'contact@exemple.com', agrement: 'AE-0457', devise: 'FCFA', seuilCode: 35, directeur: 'M. Directeur Exemple' } });
  saveLocal(); render();
}

/* ---------- Habillage vidéo : sous-titres, cartons, curseur ---------- */
function overlay() {
  const st = document.createElement('style');
  st.textContent = `
  #demo-cap{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);max-width:1000px;width:max-content;background:rgba(16,20,27,.9);color:#fff;font:600 21px/1.35 Barlow,Arial,sans-serif;padding:12px 22px 12px 20px;border-radius:12px;border-left:6px solid #f2b705;z-index:9000;box-shadow:0 10px 30px rgba(0,0,0,.35);transition:opacity .35s}
  #demo-cap small{display:block;font-weight:500;font-size:15px;color:#c9d1db;margin-top:2px}
  #demo-card{position:fixed;inset:0;z-index:9500;display:grid;place-items:center;text-align:center;color:#e6eaef;background:#2b3038;transition:opacity .6s;
    background-image:repeating-linear-gradient(to bottom,#f2b705 0 40px,transparent 40px 72px);background-size:6px 100%;background-repeat:no-repeat;background-position:center top}
  #demo-card div{background:#2b3038;padding:28px 46px;border-radius:16px}
  #demo-card h1{font:800 64px/1.05 "Barlow Condensed",Arial,sans-serif;margin:0 0 10px;color:#fff}
  #demo-card p{font:500 24px/1.4 Barlow,Arial,sans-serif;margin:0;color:#c9d1db}
  #demo-card ul{list-style:none;padding:0;margin:18px 0 0;font:500 22px/1.7 Barlow,Arial,sans-serif;text-align:left;display:inline-block}
  #demo-card li::before{content:"";display:inline-block;width:14px;height:4px;background:#f2b705;border-radius:2px;margin-right:12px;vertical-align:middle}
  #demo-cursor{position:fixed;width:22px;height:22px;margin:-3px 0 0 -3px;z-index:9999;pointer-events:none;transition:transform .12s}
  #demo-cursor.down{transform:scale(.8)}
  .demo-ring{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #f2b705;z-index:9998;pointer-events:none;animation:dr .5s ease-out forwards}
  @keyframes dr{from{opacity:1;transform:scale(.3)}to{opacity:0;transform:scale(1.4)}}
  #print.show{display:block!important;position:fixed;inset:0;z-index:8000;overflow:auto;background:#5b6573;padding:28px 0}
  #print.show .doc{max-width:800px;margin:0 auto;padding:40px 48px;box-shadow:0 10px 40px rgba(0,0,0,.4)}`;
  document.head.appendChild(st);
  const c = document.createElement('div'); c.id = 'demo-cursor';
  c.innerHTML = '<svg width="22" height="26" viewBox="0 0 22 26"><path d="M2 2 L2 21 L7 16 L11 25 L15 23 L11 15 L18 15 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  document.body.appendChild(c);
  addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', e => { c.classList.add('down'); const r = document.createElement('div'); r.className = 'demo-ring'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; document.body.appendChild(r); setTimeout(() => r.remove(), 600); }, true);
  addEventListener('mouseup', () => c.classList.remove('down'), true);
  const dd = document.createElement('dialog'); dd.id = 'demo-doc'; dd.style.cssText = 'border:0;padding:0;width:860px;max-width:96vw;max-height:94vh;background:#5b6573;border-radius:10px;overflow:auto';
  document.body.appendChild(dd);
  window.print = () => { dd.innerHTML = '<div style="padding:22px">' + document.getElementById('print').innerHTML + '</div>'; dd.querySelector('.doc').style.cssText = 'padding:36px 44px;box-shadow:0 10px 40px rgba(0,0,0,.4)'; dd.showModal(); };
}

(async () => {
  const browser = await chromium.launch();
  /* ========== Partie ordinateur ========== */
  const ctx = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1280, height: 720 }, recordVideo: { dir: OUT, size: { width: 1280, height: 720 } } });
  const p = await ctx.newPage();
  await p.goto(URL); await p.waitForTimeout(600);
  await p.evaluate(overlay); await p.evaluate(seed);
  const W = ms => p.waitForTimeout(ms);
  const cap = (t, s) => p.evaluate(([t, s]) => { let c = document.getElementById('demo-cap'); if (!c) { c = document.createElement('div'); c.id = 'demo-cap'; document.body.appendChild(c); } c.style.opacity = t ? 1 : 0; c.innerHTML = t + (s ? `<small>${s}</small>` : ''); }, [t, s || '']);
  const card = async (h, sub, items, ms) => { await p.evaluate(([h, sub, items]) => { let c = document.getElementById('demo-card'); if (!c) { c = document.createElement('div'); c.id = 'demo-card'; document.body.appendChild(c); } c.style.opacity = 1; c.hidden = false; c.innerHTML = `<div><h1>${h}</h1><p>${sub}</p>${items ? '<ul>' + items.map(i => `<li>${i}</li>`).join('') + '</ul>' : ''}</div>`; }, [h, sub, items || null]); await W(ms); await p.evaluate(() => { const c = document.getElementById('demo-card'); c.style.opacity = 0; setTimeout(() => c.hidden = true, 650); }); await W(650); };
  let mx = 640, my = 360;
  const moveTo = async (sel, opt = {}) => { const el = p.locator(sel).first(); await el.scrollIntoViewIfNeeded(); const b = await el.boundingBox(); const x = b.x + b.width * (opt.fx || .5), y = b.y + b.height * (opt.fy || .5); const steps = 22; for (let i = 1; i <= steps; i++) { const k = i / steps, e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; await p.mouse.move(mx + (x - mx) * e, my + (y - my) * e); await W(14); } mx = x; my = y; };
  const click = async (sel, pause = 500) => { await moveTo(sel); await W(180); await p.mouse.down(); await W(90); await p.mouse.up(); await W(pause); };
  const type = async (sel, txt) => { await click(sel, 150); await p.locator(sel).first().fill(''); await p.keyboard.type(txt, { delay: 55 }); await W(200); };
  const nav = async v => { await click(`#nav a[data-v="${v}"]`, 700); await p.evaluate(() => scrollTo({ top: 0 })); };
  const scroll = async (y, ms = 900) => { await p.evaluate(y => scrollTo({ top: y, behavior: 'smooth' }), y); await W(ms); };
  const closeDoc = () => p.evaluate(() => document.getElementById('demo-doc').close());
  const docScroll = () => p.evaluate(() => document.getElementById('demo-doc').scrollTo({ top: 400, behavior: 'smooth' }));
  await p.mouse.move(mx, my);

  // Introduction
  await card('Gestion Auto-École', 'Toute la gestion de votre auto-école dans une seule application', ['Inscriptions, paiements et reçus', 'Planning, examens, moniteurs et véhicules', 'Finances et rapports', 'Code de la route et examen blanc', 'Installable sur ordinateur, tablette et téléphone'], 5200);

  // Tableau de bord
  await cap('Le tableau de bord', 'Les chiffres clés de l’école en un coup d’œil'); await W(3200);
  await moveTo('.kpis .kpi:nth-child(5)'); await W(1400);
  await scroll(300); await cap('« À traiter » : les alertes automatiques', 'Assurance qui expire, vidange à prévoir, paiements en retard, conflits de planning…'); await W(3800);
  await moveTo('.alert:nth-child(1)', { fx: .4 }); await W(1200);
  await scroll(620); await cap('Prochains examens et séances du jour'); await W(2600);

  // Apprenants
  await nav('apprenants'); await cap('Les apprenants', 'Photo, n° de dossier, catégorie, statut, heures de conduite, livret et reste à payer'); await W(3400);
  await type('#q-app', 'kou'); await cap('Recherche instantanée', 'Par nom, n° de dossier, téléphone ou pièce d’identité'); await W(1800);
  await p.locator('#q-app').fill(''); await p.evaluate(() => { S.f.q = ''; render(); }); await W(500);
  await click('main [data-act="new-app"]', 800); await cap('Inscrire un nouvel apprenant', 'Le numéro de dossier est attribué automatiquement');
  await type('#i-nom', 'Ouattara'); await type('#i-prenom', 'Nadia'); await click('#i-dateNaissance', 200); await p.locator('#i-dateNaissance').fill('2005-04-18'); await W(500);
  await type('#i-telephone', '07 12 34 56 78'); await type('#i-piece', 'CI0051289');
  await p.selectOption('#i-categorie', 'B'); await W(500);
  await moveTo('#i-montantTotal'); await cap('Le tarif de la catégorie est repris automatiquement'); await W(1800);
  await click('#frm-app footer .btn:not(.ghost)', 1200);
  await cap('La fiche de l’apprenant', 'Résumé, paiements, livret, séances, examens et documents'); await W(2600);

  // Paiement + reçu
  await click('[data-act="apptab"][data-v="paiements"]', 600); await cap('Encaisser un paiement');
  await type('#p-montant', '100000'); await p.selectOption('#p-mode', 'Mobile money'); await type('#p-motif', 'Acompte à l’inscription');
  await click('#frm-pay button', 1200); await cap('Chaque paiement reçoit un numéro de reçu'); await W(1500);
  await click('#dlg-body [data-act="recu"]', 600); await cap('Reçu prêt à imprimer ou à enregistrer en PDF', 'Avec le montant en lettres et la situation du compte'); await W(2600); await docScroll(); await W(2000); await closeDoc(); await W(400);

  // Livret
  await click('[data-act="apptab"][data-v="livret"]', 700); await cap('Le livret d’apprentissage', '19 compétences évaluées de « Non abordé » à « Acquis »');
  for (const [k, v] of [['0-0', '3'], ['0-1', '3'], ['0-2', '2'], ['1-0', '1']]) { await moveTo('#lv-' + k); await p.selectOption('#lv-' + k, v); await W(450); }
  await W(1000);

  // Dossier & documents
  await click('[data-act="apptab"][data-v="dossier"]', 700); await cap('Pièces du dossier et documents officiels');
  for (const i of [0, 1, 2]) await click('#doc-' + i, 300);
  await click('#dlg-body [data-act="contrat"]', 600); await cap('Contrat de formation généré automatiquement'); await W(2000); await docScroll(); await W(2000); await closeDoc();
  await click('#dlg-body [data-act="fiche"]', 600); await cap('Fiche d’inscription'); await W(2600); await closeDoc(); await W(300);
  await click('#dlg-body [data-act="close"]', 500);

  // Planning
  await nav('planning'); await cap('Le planning de la semaine', 'Séances de conduite et de code, par moniteur et par véhicule'); await W(3000);
  await click('[data-act="wk"][data-n="7"]', 900); await cap('Les conflits d’horaire sont signalés en rouge', 'Même moniteur, véhicule ou apprenant réservé deux fois'); await moveTo('.sess.conf'); await W(3000);
  await click('.head [data-act="new-seance"]', 800); await cap('Planifier une séance en quelques clics');
  await click('#i-heure', 200); await p.locator('#i-heure').fill('16:00'); await W(400); await p.selectOption('#i-apprenantId', 'a5'); await W(300); await type('#i-moniteur', 'Clarisse ASSI'); await type('#i-vehicule', 'Yamaha YBR 125 (MT-310-CI)');
  await click('#frm-se footer .btn:not(.ghost)', 1000);

  // Examens
  await nav('examens'); await cap('Les examens', 'Code, plateau et conduite, avec la liste des candidats'); await W(2600);
  await click('.xcard', 900); await cap('Saisir les résultats', 'Le statut de l’apprenant se met à jour tout seul');
  await moveTo('#dlg-body select.res-sel'); await p.selectOption('#dlg-body select.res-sel >> nth=0', 'admis'); await W(2200);
  await click('#dlg-body [data-act="print-ex"]', 600); await cap('Liste des candidats à imprimer'); await W(2600); await closeDoc();
  await click('#dlg-body [data-act="close"]', 400);

  // Moniteurs & véhicules
  await nav('moniteurs'); await cap('Les moniteurs', 'Heures du mois, séances à venir, autorisation d’enseigner'); await W(3000);
  await nav('vehicules'); await cap('Le parc de véhicules', 'Kilométrage, échéances d’assurance, de visite technique et de vidange'); await W(3400);

  // Finances & rapports
  await nav('finances'); await cap('Les finances', 'Encaissements, dépenses et résultat du mois et de l’année'); await W(2800);
  await scroll(330, 1200); await moveTo('.chart rect >> nth=18'); await W(2400);
  await scroll(0, 600); await click('main [data-act="new-dep"]', 700); await cap('Saisir une dépense');
  await type('#i-montant', '85000'); await type('#i-libelle', 'Plein Toyota Yaris'); await type('#i-vehicule', 'Toyota Yaris (AB-214-CI)');
  await click('#frm-dep footer .btn:not(.ghost)', 900);
  await nav('rapports'); await cap('Les rapports', 'Inscriptions, réussite aux examens, activité des moniteurs, exports Excel'); await W(2600);
  await scroll(420, 1200); await W(2000); await scroll(820, 1000); await W(1600);

  // Catégories
  await nav('categories'); await cap('Les catégories de permis', 'De AM à DE : âge minimum, heures prévues et tarifs modifiables'); await W(3200);

  // Code de la route
  await nav('code'); await cap('Les leçons du code de la route', '13 leçons : priorités, distances, dépassement, feux, accidents…'); await W(2400);
  await click('details.lesson:nth-child(4) summary', 900); await W(2200);
  await nav('panneaux'); await cap('53 panneaux de signalisation', 'Classés par famille, avec leur signification'); await W(2400);
  for (const f of ['danger', 'interdiction', 'obligation', 'priorite']) await click(`[data-act="fam"][data-v="${f}"]`, 1000);
  await click('[data-act="fam"][data-v="all"]', 600);

  // Quiz
  await nav('quiz'); await cap('L’entraînement au code', 'Séries de 10 questions avec correction, scores enregistrés par apprenant'); await W(2200);
  await p.selectOption('#qz-mode', 'panneaux'); await W(300); await p.selectOption('#qz-app', 'a1'); await W(400);
  await click('[data-act="qz-start"]', 900);
  for (let q = 0; q < 2; q++) { const b = await p.evaluate(() => Q.items[Q.i].b); await click(`[data-act="qz-ans"][data-k="${q === 0 ? b : (b + 1) % 4}"]`, 1800); await click('[data-act="qz-next"]', 700); }
  await click('[data-act="qz-quit"]', 600);
  await p.selectOption('#qz-mode', 'examen'); await W(300); await click('[data-act="qz-start"]', 900);
  await cap('L’examen blanc', '40 questions, chronomètre de 25 minutes, seuil de réussite réglable'); await W(2600);
  await click('[data-act="qz-ans"][data-k="2"]', 500); await click('[data-act="qz-valid"]', 900); await W(1200);
  await click('[data-act="qz-quit"]', 500);

  // Paramètres
  await nav('parametres'); await cap('Les paramètres', 'Logo et coordonnées de l’école, repris sur tous les documents'); await W(2800);
  await scroll(560, 1100); await cap('Sauvegarde, code d’accès, thème clair ou sombre'); await W(2400);
  await click('[data-act="theme"][data-v="dark"]', 1400); await nav('tableau'); await cap('Le mode sombre'); await W(2400);
  await nav('parametres'); await scroll(560, 600); await click('[data-act="theme"][data-v="auto"]', 600);
  await scroll(1100, 1000); await cap('L’installation sur tous les appareils'); await W(2600);
  await cap(''); await card('Installable partout', 'Fonctionne aussi sans connexion internet', ['Windows, macOS et Linux', 'Android : téléphones et tablettes', 'iPhone et iPad'], 4200);
  await p.evaluate(() => { const c = document.getElementById('demo-card'); c.hidden = false; c.style.opacity = 1; c.innerHTML = '<div><h1>Sur téléphone</h1><p>La même application, adaptée aux petits écrans</p></div>'; });
  await W(1500);
  const desktopVideo = await p.video().path(); await ctx.close();

  /* ========== Partie téléphone ========== */
  const mctx = await browser.newContext({ locale: 'fr-FR', viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, recordVideo: { dir: OUT, size: { width: 390, height: 844 } } });
  const m = await mctx.newPage(); await m.goto(URL); await m.waitForTimeout(500);
  await m.evaluate(overlay); await m.evaluate(seed); await m.evaluate(() => document.getElementById('demo-cursor').remove());
  const MW = ms => m.waitForTimeout(ms);
  const tap = async (sel, ms = 900) => { await m.locator(sel).first().scrollIntoViewIfNeeded(); await m.locator(sel).first().tap(); await MW(ms); };
  await MW(1800); await m.evaluate(() => scrollTo({ top: 600, behavior: 'smooth' })); await MW(1800); await m.evaluate(() => scrollTo({ top: 0, behavior: 'smooth' })); await MW(800);
  await tap('#nav a[data-v="apprenants"]', 1500); await m.evaluate(() => scrollTo({ top: 300, behavior: 'smooth' })); await MW(1500);
  await tap('tbody tr', 1600); await tap('[data-act="apptab"][data-v="paiements"]', 1800); await tap('#dlg-body [data-act="close"]', 600);
  await m.evaluate(() => document.querySelector('#nav a[data-v="planning"]').scrollIntoView({ inline: 'center' })); await MW(500);
  await tap('#nav a[data-v="planning"]', 1500); await m.evaluate(() => scrollTo({ top: 500, behavior: 'smooth' })); await MW(1600);
  await m.evaluate(() => document.querySelector('#nav a[data-v="panneaux"]').scrollIntoView({ inline: 'center' })); await MW(400);
  await tap('#nav a[data-v="panneaux"]', 1400); await m.evaluate(() => scrollTo({ top: 700, behavior: 'smooth' })); await MW(1500);
  await m.evaluate(() => document.querySelector('#nav a[data-v="quiz"]').scrollIntoView({ inline: 'center' })); await MW(300);
  await tap('#nav a[data-v="quiz"]', 900); await m.selectOption('#qz-mode', 'panneaux'); await tap('[data-act="qz-start"]', 1300);
  const b = await m.evaluate(() => Q.items[0].b); await tap(`[data-act="qz-ans"][data-k="${b}"]`, 2600);
  const mobileVideo = await m.video().path(); await mctx.close();

  /* ========== Carton de fin ========== */
  const ectx = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1280, height: 720 }, recordVideo: { dir: OUT, size: { width: 1280, height: 720 } } });
  const e = await ectx.newPage(); await e.goto(URL); await e.evaluate(overlay);
  await e.evaluate(() => { const c = document.createElement('div'); c.id = 'demo-card'; c.innerHTML = '<div><h1>Gestion Auto-École</h1><p>Inscriptions · Paiements · Planning · Examens · Moniteurs · Véhicules · Finances · Code de la route</p><ul><li>Version installable : application web hors ligne</li><li>Version bureau : .exe · .dmg · .AppImage · .deb</li><li>Version en ligne partagée</li></ul></div>'; document.body.appendChild(c); });
  await e.waitForTimeout(6000);
  const endVideo = await e.video().path(); await ectx.close();
  await browser.close();
  console.log(JSON.stringify({ desktopVideo, mobileVideo, endVideo }));
})();
