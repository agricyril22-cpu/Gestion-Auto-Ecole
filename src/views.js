/* ============ Rendu ============ */
let rq = 0;
function scheduleRender() { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; render(); }); }
const VIEWS = ['tableau', 'apprenants', 'planning', 'examens', 'moniteurs', 'vehicules', 'finances', 'rapports', 'categories', 'code', 'panneaux', 'quiz', 'parametres'];
function route() { const h = (location.hash || '').slice(1); S.view = VIEWS.includes(h) ? h : 'tableau'; scheduleRender(); }
window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });

function render() {
  const main = $('#main');
  const ae = document.activeElement; const fid = ae && ae.id && main.contains(ae) ? ae.id : null; let ss = null; try { ss = fid ? ae.selectionStart : null; } catch (e) {}
  document.querySelectorAll('#nav a').forEach(a => { if (a.dataset.v === S.view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $('#brand-name').textContent = cfg().nom;
  $('#foot').innerHTML = (S.mode === 'db' ? 'Données en ligne, partagées' : S.mode === 'local' ? 'Données enregistrées sur cet appareil' : 'Chargement…') + (deferredInstall ? `<button class="btn sm" data-act="install">Installer l’application</button>` : '') + `<span style="font-size:.72rem">Version ${APP_VERSION}</span>`;
  const V = { tableau: vTableau, apprenants: vApprenants, planning: vPlanning, examens: vExamens, moniteurs: vMoniteurs, vehicules: vVehicules, finances: vFinances, rapports: vRapports, categories: vCategories, code: vCode, panneaux: vPanneaux, quiz: vQuiz, parametres: vParametres };
  const banner = (S.note ? `<div class="banner">${esc(S.note)}</div>` : '') + (S.ro ? `<div class="banner">Consultation seule : vous pouvez voir les données mais pas les modifier.</div>` : '');
  main.innerHTML = banner + V[S.view]();
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus(); try { if (ss != null) el.setSelectionRange(ss, ss); } catch (e) {} } }
}
const loading = col => !S.loaded[col];
const head = (title, sub, actions = '') => `<div class="head"><div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div><div class="row">${actions}</div></div>`;
const statutPill = s => `<span class="pill ${STATUT_CLS[s] || ''}">${esc(STATUTS[s] || s || '—')}</span>`;
const dateChip = s => { const d = toDate(s); return `<div class="date-chip"><b class="num">${d.getDate()}</b><small>${d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}</small></div>`; };
const yearOpts = (id, val) => { const ys = new Set([new Date().getFullYear()]); S.apprenants.forEach(a => a.dateInscription && ys.add(+a.dateInscription.slice(0, 4))); S.depenses.forEach(d => d.date && ys.add(+d.date.slice(0, 4))); return `<select id="${id}" aria-label="Année">${[...ys].sort((a, b) => b - a).map(y => `<option ${y === val ? 'selected' : ''}>${y}</option>`).join('')}</select>`; };

/* ---- Graphique en barres (SVG) ---- */
function barChart(labels, series, opts = {}) {
  const W = 720, H = opts.h || 230, L = 64, R = 10, Tp = 14, B = 26;
  const max = Math.max(1, ...series.flatMap(s => s.values));
  const nice = (() => { const p = Math.pow(10, Math.floor(Math.log10(max))); for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= max) return m * p; return 10 * p; })();
  const y = v => Tp + (H - Tp - B) * (1 - v / nice);
  const gw = (W - L - R) / labels.length, bw = Math.min(22, (gw - 8) / series.length);
  const fmt = v => v >= 1e6 ? (v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M' : v >= 1e3 ? (v / 1e3).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' k' : String(v);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'Graphique')}"><g class="grid">`;
  for (let i = 0; i <= 4; i++) { const v = nice * i / 4; s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${fmt(v)}</text>`; }
  s += '</g>';
  labels.forEach((lb, i) => {
    const x0 = L + i * gw + (gw - bw * series.length) / 2;
    series.forEach((se, k) => { const v = se.values[i] || 0; const h = (H - Tp - B) * v / nice; s += `<rect x="${x0 + k * bw}" y="${y(v)}" width="${bw - 2}" height="${Math.max(0, h)}" rx="3" style="fill:${se.color}"><title>${esc(lb)} — ${esc(se.name)} : ${v.toLocaleString('fr-FR')}</title></rect>`; });
    s += `<text x="${L + i * gw + gw / 2}" y="${H - 8}" text-anchor="middle">${esc(lb)}</text>`;
  });
  return s + '</svg>' + (series.length > 1 ? `<div class="legend">${series.map(se => `<span><i style="background:${se.color}"></i>${esc(se.name)}</span>`).join('')}</div>` : '');
}

/* ---- Tableau de bord ---- */
function vTableau() {
  const t = todayISO(), in30 = addDays(t, 30);
  const actifs = S.apprenants.filter(a => !['diplome', 'abandon'].includes(a.statut));
  const exAvenir = S.examens.filter(e => e.date >= t).sort(by('date'));
  const ex30 = exAvenir.filter(e => e.date <= in30);
  const sj = S.seances.filter(s => s.date === t).sort(by('heure'));
  const res = S.examens.flatMap(e => (e.candidats || []).map(c => c.resultat));
  const ad = res.filter(r => r === 'admis').length, aj = res.filter(r => r === 'ajourne').length;
  const taux = ad + aj ? Math.round(100 * ad / (ad + aj)) + ' %' : '—';
  const totalDu = sum(S.apprenants.filter(a => a.statut !== 'abandon'), reste);
  const mois = t.slice(0, 7);
  const recMois = sum(allPayments().filter(p => (p.date || '').startsWith(mois)), p => p.montant);
  const depMois = sum(S.depenses.filter(d => (d.date || '').startsWith(mois)), d => d.montant);
  const alerts = computeAlerts();
  const empty = !loading('apprenants') && S.apprenants.length === 0;
  return head('Tableau de bord', fmtDate(t, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    `<button class="btn w" data-act="new-app">Inscrire un apprenant</button><button class="btn ghost w" data-act="new-seance">Planifier une séance</button><button class="btn ghost w" data-act="new-dep">Saisir une dépense</button>`) +
  (empty ? `<div class="card"><h3>Bienvenue dans votre espace de gestion</h3><ol class="steps"><li>Renseignez les coordonnées et le logo de l’école dans les <a href="#parametres">paramètres</a>.</li><li>Ajoutez vos <a href="#moniteurs">moniteurs</a> et vos <a href="#vehicules">véhicules</a>.</li><li>Vérifiez les tarifs des <a href="#categories">catégories de permis</a>.</li><li>Inscrivez votre premier apprenant.</li></ol></div>` : '') +
  `<div class="kpis">
    <div class="kpi"><span>Apprenants en formation</span><b>${actifs.length}</b><small>${S.apprenants.length} dossiers au total</small></div>
    <div class="kpi"><span>Séances aujourd’hui</span><b>${sj.filter(s => s.statut !== 'annulee').length}</b><small>${sj.filter(s => s.statut === 'effectuee').length} effectuées</small></div>
    <div class="kpi"><span>Examens sous 30 jours</span><b>${ex30.length}</b><small>${sum(ex30, e => (e.candidats || []).length)} candidats</small></div>
    <div class="kpi"><span>Taux de réussite</span><b>${taux}</b><small>${ad} admis · ${aj} ajournés</small></div>
    <div class="kpi"><span>Encaissé ce mois</span><b class="num" style="font-size:1.45rem">${money(recMois)}</b><small>Dépenses : ${money(depMois)}</small></div>
    <div class="kpi"><span>Reste à encaisser</span><b class="num" style="font-size:1.45rem">${money(totalDu)}</b><small>sur l’ensemble des dossiers</small></div>
  </div>
  ${alerts.length ? `<div class="card"><h3>À traiter (${alerts.length})</h3><div class="alerts">${alerts.slice(0, 12).map(a => `<div class="alert ${a.lvl}"><span>${esc(a.txt)}</span><button class="btn ghost sm" data-act="${a.act}" data-id="${esc(a.id)}">Voir</button></div>`).join('')}</div></div>` : ''}
  <div class="grid g2">
    <div class="card"><h3>Prochains examens</h3><div class="list">${exAvenir.slice(0, 5).map(e => `<div class="li" data-act="open-ex" data-id="${e.id}" style="cursor:pointer">${dateChip(e.date)}<div class="t" style="flex:1"><b>${esc(EXT[e.type] || e.type)} · <span class="catbadge">${esc(e.categorie || '?')}</span>${exPill(e)}</b><small>${esc(e.heure || '')} ${e.lieu ? '· ' + esc(e.lieu) : ''}</small></div><span class="pill acc">${(e.candidats || []).length} cand.</span></div>`).join('') || '<p class="empty">Aucun examen programmé.</p>'}</div></div>
    <div class="card"><h3>Séances du jour</h3><div class="list">${sj.map(s => `<div class="li" data-act="edit-seance" data-id="${s.id}" style="cursor:pointer"><div class="t"><b>${esc(s.heure || '')} · ${s.type === 'code' ? 'Code' : 'Conduite'} — ${s.apprenantId ? esc(nomC(appById(s.apprenantId))) : esc(s.groupe || 'Séance collective')}</b><small>${esc(s.moniteur || 'Moniteur non précisé')}${s.vehicule ? ' · ' + esc(s.vehicule) : ''}</small></div><span class="pill ${s.statut === 'effectuee' ? 'ok' : s.statut === 'annulee' ? 'bad' : ''}">${SEANCE_ST[s.statut] || ''}</span></div>`).join('') || '<p class="empty">Aucune séance prévue aujourd’hui.</p>'}</div></div>
  </div>`;
}

/* ---- Apprenants ---- */
function vApprenants() {
  const q = S.f.q.trim().toLowerCase();
  const rows = S.apprenants.filter(a => (!q || [a.nom, a.prenom, a.telephone, a.piece, a.dossier].join(' ').toLowerCase().includes(q)) && (!S.f.statut || a.statut === S.f.statut) && (!S.f.cat || a.categorie === S.f.cat))
    .sort((a, b) => by('nom')(a, b) || by('prenom')(a, b));
  return head('Apprenants', `${S.apprenants.length} dossier(s)`, `<button class="btn ghost" data-act="csv" data-id="apprenants">Exporter (Excel)</button><button class="btn w" data-act="new-app">Inscrire un apprenant</button>`) +
  `<div class="filters">
    <input id="q-app" type="search" placeholder="Rechercher par nom, n° de dossier, téléphone…" value="${esc(S.f.q)}" aria-label="Rechercher">
    <select id="f-statut" aria-label="Filtrer par statut"><option value="">Tous les statuts</option>${Object.entries(STATUTS).map(([k, v]) => `<option value="${k}" ${S.f.statut === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <select id="f-cat" aria-label="Filtrer par catégorie"><option value="">Toutes catégories</option>${catsSorted().map(c => `<option value="${esc(c.code)}" ${S.f.cat === c.code ? 'selected' : ''}>${esc(c.code)}</option>`).join('')}</select>
  </div>` +
  (loading('apprenants') ? '<p class="empty">Chargement des apprenants…</p>' : rows.length === 0 ? `<div class="card"><p class="empty">${S.apprenants.length ? 'Aucun apprenant ne correspond à ces filtres.' : 'Aucun apprenant inscrit. Cliquez sur « Inscrire un apprenant » pour commencer.'}</p></div>` :
  `<div class="tw"><table><thead><tr><th>Apprenant</th><th>Dossier</th><th>Permis</th><th>Statut</th><th>Conduite</th><th>Livret</th><th class="r">Reste à payer</th></tr></thead><tbody>${rows.map(a => {
    const c = catBy(a.categorie); const req = (c && c.heuresConduite) || 0; const m = minutesConduite(a); const pct = req ? Math.min(100, Math.round(100 * m / 60 / req)) : 0; const miss = docsManquants(a).length;
    return `<tr data-act="open-app" data-id="${a.id}"><td><div class="who">${avatar(a, true)}<div><b>${esc(nomC(a))}</b>${exPill(a)}<br><small style="color:var(--muted)">${esc(a.telephone || '')}</small></div></div></td><td class="num"><small>${esc(a.dossier || '—')}</small>${miss && !['diplome', 'abandon'].includes(a.statut) ? `<br><span class="pill warn">${miss} pièce(s)</span>` : ''}</td><td><span class="catbadge">${esc(a.categorie || '?')}</span></td><td>${statutPill(a.statut)}</td><td><div class="row" style="flex-wrap:nowrap"><div class="bar ${pct >= 100 ? 'ok' : ''}" style="flex:1"><i style="width:${pct}%"></i></div><small class="num">${fmtH(m)}${req ? ' / ' + req + ' h' : ''}</small></div></td><td class="num">${livretPct(a)} %</td><td class="r num">${reste(a) ? money(reste(a)) : '<span class="pill ok">Soldé</span>'}</td></tr>`;
  }).join('')}</tbody></table></div>`);
}

/* ---- Planning ---- */
function vPlanning() {
  const t = todayISO();
  const days = [...Array(7)].map((_, i) => addDays(S.week, i));
  const mons = allMoniteurs();
  const list = S.seances.filter(s => s.date >= days[0] && s.date <= days[6] && (!S.moniteur || s.moniteur === S.moniteur));
  const nb = list.filter(s => s.statut !== 'annulee'); const hC = sum(nb.filter(s => s.type === 'conduite'), s => s.duree);
  return head('Planning des séances', `Semaine du ${fmtDate(days[0], { day: 'numeric', month: 'long' })} au ${fmtDate(days[6], { day: 'numeric', month: 'long', year: 'numeric' })} · ${nb.length} séance(s), ${fmtH(hC)} de conduite`,
    `<button class="btn ghost" data-act="wk" data-n="-7" aria-label="Semaine précédente">‹ Préc.</button><button class="btn ghost" data-act="wk" data-n="0">Cette semaine</button><button class="btn ghost" data-act="wk" data-n="7" aria-label="Semaine suivante">Suiv. ›</button><button class="btn ghost" data-act="print-week">Imprimer</button><button class="btn w" data-act="new-seance">Nouvelle séance</button>`) +
  `<div class="filters"><select id="f-mon" aria-label="Filtrer par moniteur"><option value="">Tous les moniteurs</option>${mons.map(m => `<option ${S.moniteur === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></div>
  <div class="week">${days.map(d => { const ss = list.filter(s => s.date === d).sort(by('heure'));
    return `<div class="day ${d === t ? 'today' : ''}"><h4><span>${fmtDate(d, { weekday: 'long' })}</span><small class="num">${fmtDate(d, { day: 'numeric', month: 'short' })}</small></h4>${ss.map(s => { const cf = conflicts(s).length; return `<div class="sess ${s.type} ${s.statut} ${cf ? 'conf' : ''}" data-act="edit-seance" data-id="${s.id}"><b class="num">${esc(s.heure || '')} · ${s.type === 'code' ? 'Code' : 'Conduite'} (${fmtH(+s.duree || 0)})</b><span>${s.apprenantId ? esc(nomC(appById(s.apprenantId))) : esc(s.groupe || 'Séance collective')}</span><small>${esc(s.moniteur || '')}${s.vehicule ? ' · ' + esc(s.vehicule) : ''}</small>${cf ? '<small class="conflict">Conflit d’horaire</small>' : ''}</div>`; }).join('')}<button class="btn link sm w" data-act="new-seance" data-date="${d}" style="justify-self:start">+ Ajouter</button></div>`; }).join('')}</div>`;
}

/* ---- Examens ---- */
function vExamens() {
  const t = todayISO();
  const all = S.examens.slice().sort(by('date'));
  const rows = S.exTab === 'avenir' ? all.filter(e => e.date >= t) : all.filter(e => e.date < t).reverse();
  return head('Examens', 'Sessions d’examen, candidats et résultats', `<button class="btn ghost" data-act="csv" data-id="examens">Exporter (Excel)</button><button class="btn w" data-act="new-ex">Programmer un examen</button>`) +
  `<div class="tabs" role="group" aria-label="Période"><button data-act="extab" data-v="avenir" aria-pressed="${S.exTab === 'avenir'}">À venir (${all.filter(e => e.date >= t).length})</button><button data-act="extab" data-v="passes" aria-pressed="${S.exTab === 'passes'}">Passés (${all.filter(e => e.date < t).length})</button></div>` +
  (loading('examens') ? '<p class="empty">Chargement…</p>' : rows.length === 0 ? `<div class="card"><p class="empty">${S.exTab === 'avenir' ? 'Aucun examen à venir. Programmez une session pour y inscrire vos candidats.' : 'Aucun examen passé.'}</p></div>` :
  `<div class="cards">${rows.map(e => { const cs = e.candidats || []; const cnt = k => cs.filter(c => c.resultat === k).length;
    return `<div class="xcard" data-act="open-ex" data-id="${e.id}"><div class="top">${dateChip(e.date)}<div><b>${esc(EXT[e.type] || e.type)}</b>${exPill(e)}<div class="meta">${fmtDate(e.date, { weekday: 'long' })} ${e.heure ? 'à ' + esc(e.heure) : ''}</div></div></div><div class="meta">${e.lieu ? esc(e.lieu) : 'Lieu à préciser'}</div><div class="row"><span class="catbadge">${esc(e.categorie || '?')}</span><span class="pill acc">${cs.length} candidat(s)</span>${cnt('admis') ? `<span class="pill ok">${cnt('admis')} admis</span>` : ''}${cnt('ajourne') ? `<span class="pill bad">${cnt('ajourne')} ajourné(s)</span>` : ''}${cnt('absent') ? `<span class="pill warn">${cnt('absent')} absent(s)</span>` : ''}</div></div>`; }).join('')}</div>`);
}

/* ---- Moniteurs ---- */
function vMoniteurs() {
  const t = todayISO(), mois = t.slice(0, 7);
  const rows = S.moniteurs.slice().sort(by('nom'));
  return head('Moniteurs', `${rows.filter(m => m.actif !== false).length} moniteur(s) actif(s)`, `<button class="btn w" data-act="new-mon">Ajouter un moniteur</button>`) +
  (loading('moniteurs') ? '<p class="empty">Chargement…</p>' : rows.length === 0 ? `<div class="card"><p class="empty">Aucun moniteur enregistré. Ajoutez vos moniteurs pour suivre leurs heures et leurs autorisations d’enseigner.</p></div>` :
  `<div class="cards">${rows.map(m => { const n = monName(m); const ss = S.seances.filter(s => s.moniteur === n);
    const hM = sum(ss.filter(s => s.statut === 'effectuee' && (s.date || '').startsWith(mois)), s => s.duree); const av = ss.filter(s => s.date >= t && s.statut === 'prevue').length;
    const exp = m.autorisationExp ? daysBetween(t, m.autorisationExp) : null;
    return `<div class="xcard" data-act="edit-mon" data-id="${m.id}"><div class="top">${avatar(m)}<div><b style="font-family:var(--f-display);font-size:1.2rem">${esc(n)}</b>${exPill(m)}<div class="meta">${esc(m.telephone || '')}</div></div></div><div class="row">${(m.categories || '').split(/[,\s]+/).filter(Boolean).map(c => `<span class="catbadge">${esc(c)}</span>`).join('')}${m.actif === false ? '<span class="pill">Inactif</span>' : ''}</div><div class="facts"><div><span>Heures ce mois</span><b>${fmtH(hM)}</b></div><div><span>À venir</span><b>${av}</b></div><div><span>Autorisation</span><b>${exp == null ? '—' : exp < 0 ? '<span class="conflict">Expirée</span>' : fmtDate(m.autorisationExp, { month: 'short', year: '2-digit' })}</b></div></div></div>`; }).join('')}</div>`);
}

/* ---- Véhicules ---- */
function vVehicules() {
  const t = todayISO();
  const st = { dispo: ['Disponible', 'ok'], garage: ['Au garage', 'warn'], panne: ['En panne', 'bad'] };
  const exp = d => { if (!d) return '—'; const n = daysBetween(t, d); return `<span class="${n < 0 ? 'conflict' : n <= 30 ? 'warn-t' : ''}">${fmtDate(d)}</span>`; };
  return head('Véhicules', `${S.vehicules.length} véhicule(s) au parc`, `<button class="btn w" data-act="new-veh">Ajouter un véhicule</button>`) +
  (loading('vehicules') ? '<p class="empty">Chargement…</p>' : S.vehicules.length === 0 ? `<div class="card"><p class="empty">Aucun véhicule. Ajoutez votre parc pour être alerté des échéances d’assurance, de visite technique et de vidange.</p></div>` :
  `<div class="tw"><table><thead><tr><th>Véhicule</th><th>Catégorie</th><th>État</th><th class="r">Kilométrage</th><th>Assurance</th><th>Visite technique</th><th class="r">Prochaine vidange</th><th class="r">Dépenses (année)</th></tr></thead><tbody>${S.vehicules.slice().sort(by('modele')).map(v => {
    const dep = sum(S.depenses.filter(d => d.vehicule === vehLabel(v) && (d.date || '').startsWith(String(new Date().getFullYear()))), d => d.montant);
    return `<tr data-act="edit-veh" data-id="${v.id}"><td><b>${esc(v.modele || '')}</b>${exPill(v)}<br><small style="color:var(--muted)">${esc(v.immat || '')}</small></td><td><span class="catbadge">${esc(v.categorie || '?')}</span></td><td><span class="pill ${(st[v.statut] || st.dispo)[1]}">${(st[v.statut] || st.dispo)[0]}</span></td><td class="r num">${v.km ? Number(v.km).toLocaleString('fr-FR') + ' km' : '—'}</td><td class="num">${exp(v.assuranceExp)}</td><td class="num">${exp(v.visiteExp)}</td><td class="r num">${v.vidangeKm ? Number(v.vidangeKm).toLocaleString('fr-FR') + ' km' : '—'}</td><td class="r num">${money(dep)}</td></tr>`; }).join('')}</tbody></table></div>`);
}

/* ---- Finances ---- */
function vFinances() {
  const y = S.finYear, m = S.finMonth;
  const ym = (yy, mm) => `${yy}-${String(mm + 1).padStart(2, '0')}`;
  const pays = allPayments(); const deps = S.depenses;
  const rec = MOIS.map((_, i) => sum(pays.filter(p => (p.date || '').startsWith(ym(y, i))), p => p.montant));
  const dep = MOIS.map((_, i) => sum(deps.filter(d => (d.date || '').startsWith(ym(y, i))), d => d.montant));
  const key = ym(y, m);
  const pM = pays.filter(p => (p.date || '').startsWith(key)).sort(by('date'));
  const dM = deps.filter(d => (d.date || '').startsWith(key)).sort(by('date'));
  const rY = sum(rec, x => x), dY = sum(dep, x => x);
  return head('Finances', 'Encaissements, dépenses et résultat', `<button class="btn ghost" data-act="csv" data-id="paiements">Exporter les encaissements</button><button class="btn ghost" data-act="csv" data-id="depenses">Exporter les dépenses</button><button class="btn w" data-act="new-dep">Nouvelle dépense</button>`) +
  `<div class="filters">${yearOpts('fin-year', y)}<select id="fin-month" aria-label="Mois">${MOIS.map((n, i) => `<option value="${i}" ${i === m ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
  <div class="kpis">
    <div class="kpi"><span>Encaissé · ${MOIS[m]} ${y}</span><b class="num" style="font-size:1.45rem">${money(rec[m])}</b><small>${pM.length} paiement(s)</small></div>
    <div class="kpi"><span>Dépenses · ${MOIS[m]} ${y}</span><b class="num" style="font-size:1.45rem">${money(dep[m])}</b><small>${dM.length} dépense(s)</small></div>
    <div class="kpi"><span>Résultat du mois</span><b class="num" style="font-size:1.45rem;color:${rec[m] - dep[m] < 0 ? 'var(--bad)' : 'var(--ok)'}">${money(rec[m] - dep[m])}</b><small>encaissements − dépenses</small></div>
    <div class="kpi"><span>Résultat ${y}</span><b class="num" style="font-size:1.45rem">${money(rY - dY)}</b><small>${money(rY)} encaissés</small></div>
    <div class="kpi"><span>Reste à encaisser</span><b class="num" style="font-size:1.45rem">${money(sum(S.apprenants.filter(a => a.statut !== 'abandon'), reste))}</b><small>tous dossiers</small></div>
  </div>
  <div class="card"><h3>Encaissements et dépenses ${y}</h3>${barChart(MOIS, [{ name: 'Encaissements', values: rec, color: 'var(--accent)' }, { name: 'Dépenses', values: dep, color: 'var(--warn)' }], { label: 'Encaissements et dépenses par mois' })}</div>
  <div class="grid g2">
    <div class="card"><h3>Encaissements de ${MOIS[m]}</h3><div class="list">${pM.map(p => `<div class="li"><div class="t"><b>${esc(nomC(p.a))}</b><small>${fmtDate(p.date)} · ${esc(p.mode || '')} · ${esc(p.no || '')}</small></div><div class="row" style="flex-wrap:nowrap"><b class="num">${money(p.montant)}</b><button class="btn link sm" data-act="recu" data-id="${p.a.id}" data-i="${p.i}">Reçu</button></div></div>`).join('') || '<p class="empty">Aucun encaissement ce mois.</p>'}</div></div>
    <div class="card"><h3>Dépenses de ${MOIS[m]}</h3><div class="list">${dM.map(d => `<div class="li" data-act="edit-dep" data-id="${d.id}" style="cursor:pointer"><div class="t"><b>${esc(d.libelle || d.categorie)}</b>${exPill(d)}<small>${fmtDate(d.date)} · ${esc(d.categorie || '')}${d.vehicule ? ' · ' + esc(d.vehicule) : ''}</small></div><b class="num">${money(d.montant)}</b></div>`).join('') || '<p class="empty">Aucune dépense ce mois.</p>'}</div></div>
  </div>`;
}

/* ---- Rapports ---- */
function vRapports() {
  const y = String(S.repYear);
  const ins = MOIS.map((_, i) => S.apprenants.filter(a => (a.dateInscription || '').startsWith(`${y}-${String(i + 1).padStart(2, '0')}`)).length);
  const insY = S.apprenants.filter(a => (a.dateInscription || '').startsWith(y));
  const cats = catsSorted().map(c => ({ c, n: insY.filter(a => a.categorie === c.code).length })).filter(x => x.n);
  const maxC = Math.max(1, ...cats.map(x => x.n));
  const exY = S.examens.filter(e => (e.date || '').startsWith(y));
  const rows = Object.entries(EXT).map(([k, l]) => { const cs = exY.filter(e => e.type === k).flatMap(e => e.candidats || []); const ad = cs.filter(c => c.resultat === 'admis').length, aj = cs.filter(c => c.resultat === 'ajourne').length, ab = cs.filter(c => c.resultat === 'absent').length; return { l, n: cs.length, ad, aj, ab, t: ad + aj ? Math.round(100 * ad / (ad + aj)) : null }; });
  const mons = allMoniteurs().map(n => { const ss = S.seances.filter(s => s.moniteur === n && (s.date || '').startsWith(y) && s.statut === 'effectuee'); return { n, nb: ss.length, hc: sum(ss.filter(s => s.type === 'conduite'), s => s.duree), hk: sum(ss.filter(s => s.type === 'code'), s => s.duree) }; });
  const ab = insY.filter(a => a.statut === 'abandon').length, dip = S.apprenants.filter(a => (a.datePermis || '').startsWith(y)).length;
  return head('Rapports', 'Statistiques d’activité de l’école', `${yearOpts('rep-year', S.repYear)}<button class="btn ghost" data-act="csv" data-id="seances">Exporter les séances</button>`) +
  `<div class="kpis"><div class="kpi"><span>Inscriptions ${y}</span><b>${insY.length}</b></div><div class="kpi"><span>Permis obtenus ${y}</span><b>${dip}</b></div><div class="kpi"><span>Abandons ${y}</span><b>${ab}</b><small>${insY.length ? Math.round(100 * ab / insY.length) : 0} % des inscrits</small></div><div class="kpi"><span>Heures de conduite ${y}</span><b>${fmtH(sum(mons, x => x.hc))}</b></div></div>
  <div class="card"><h3>Inscriptions par mois</h3>${barChart(MOIS, [{ name: 'Inscriptions', values: ins, color: 'var(--accent)' }], { h: 200, label: 'Inscriptions par mois' })}</div>
  <div class="grid g2">
    <div class="card"><h3>Inscriptions par catégorie</h3>${cats.map(x => `<div class="hbar"><span class="catbadge" style="justify-self:start">${esc(x.c.code)}</span><div class="bar"><i style="width:${100 * x.n / maxC}%"></i></div><b class="num" style="text-align:right">${x.n}</b></div>`).join('') || '<p class="empty">Aucune inscription cette année.</p>'}</div>
    <div class="card"><h3>Résultats aux examens</h3><div class="tw" style="border:0"><table style="min-width:0"><thead><tr><th>Épreuve</th><th class="r">Présentés</th><th class="r">Admis</th><th class="r">Ajournés</th><th class="r">Absents</th><th class="r">Réussite</th></tr></thead><tbody>${rows.map(r => `<tr style="cursor:default"><td>${r.l}</td><td class="r num">${r.n}</td><td class="r num">${r.ad}</td><td class="r num">${r.aj}</td><td class="r num">${r.ab}</td><td class="r num"><b>${r.t == null ? '—' : r.t + ' %'}</b></td></tr>`).join('')}</tbody></table></div></div>
  </div>
  <div class="card"><h3>Activité des moniteurs</h3>${mons.length ? `<div class="tw" style="border:0"><table style="min-width:0"><thead><tr><th>Moniteur</th><th class="r">Séances effectuées</th><th class="r">Heures de conduite</th><th class="r">Heures de code</th></tr></thead><tbody>${mons.map(r => `<tr style="cursor:default"><td>${esc(r.n)}</td><td class="r num">${r.nb}</td><td class="r num">${fmtH(r.hc)}</td><td class="r num">${fmtH(r.hk)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Aucun moniteur.</p>'}</div>`;
}

/* ---- Catégories ---- */
function vCategories() {
  const cats = catsSorted();
  return head('Catégories de permis', 'Âges, volumes horaires et tarifs de chaque formation', `<button class="btn w" data-act="new-cat">Ajouter une catégorie</button>`) +
  `<p class="note">Les âges et volumes horaires proposés sont des valeurs courantes : ajustez-les selon la réglementation de votre pays et vos forfaits.</p>` +
  (loading('categories') ? '<p class="empty">Chargement…</p>' : cats.length === 0 ? `<div class="card"><p>Aucune catégorie enregistrée.</p><p style="margin-top:10px"><button class="btn w" data-act="install-cats">Installer les 12 catégories standard (AM à DE)</button></p></div>` :
  `<div class="cards">${cats.map(c => { const n = S.apprenants.filter(a => a.categorie === c.code && !['diplome', 'abandon'].includes(a.statut)).length;
    return `<div class="xcard" data-act="edit-cat" data-id="${c.id}"><div class="top"><div class="catcode">${esc(c.code)}</div><div><b style="font-family:var(--f-display);font-size:1.2rem">${esc(c.libelle)}</b><div class="meta">${n} apprenant(s) en formation</div></div></div><p class="meta">${esc(c.description || '')}</p><div class="facts"><div><span>Âge min.</span><b>${c.ageMin ?? '—'} ans</b></div><div><span>Code</span><b>${c.heuresCode ?? 0} h</b></div><div><span>Conduite</span><b>${c.heuresConduite ?? 0} h</b></div></div><div class="row" style="justify-content:space-between"><span class="meta">Tarif</span><b class="num">${c.tarif ? money(c.tarif) : '<span class="pill">à définir</span>'}</b></div></div>`; }).join('')}</div>`);
}

/* ---- Code de la route ---- */
function vCode() {
  return head('Code de la route', 'Les règles essentielles à maîtriser avant l’examen théorique', `<a class="btn" href="#quiz">S’entraîner</a><a class="btn ghost" href="#panneaux">Voir les panneaux</a>`) +
  `<div class="lessons">${LECONS.map((l, i) => `<details class="lesson" ${i === 1 ? 'open' : ''}><summary>${esc(l.t)}</summary><div class="body">${l.h}</div></details>`).join('')}</div>`;
}
function vPanneaux() {
  const fams = Object.keys(FAMS);
  const list = SIGNS.filter(s => S.fam === 'all' || s.f === S.fam);
  return head('Panneaux de signalisation', `${SIGNS.length} panneaux classés par famille`, `<a class="btn" href="#quiz">Quiz sur les panneaux</a>`) +
  `<div class="chips" role="group" aria-label="Familles"><button data-act="fam" data-v="all" aria-pressed="${S.fam === 'all'}">Tous</button>${fams.map(f => `<button data-act="fam" data-v="${f}" aria-pressed="${S.fam === f}">${FAMS[f][0]}</button>`).join('')}</div>` +
  (S.fam !== 'all' ? `<p class="famintro">${FAMS[S.fam][1]}</p>` : `<p class="famintro">La forme et la couleur d’un panneau indiquent sa famille avant même de lire le symbole : triangle = danger, rond rouge = interdiction, rond bleu = obligation, carré bleu = indication.</p>`) +
  `<div class="signs">${list.map(s => `<div class="sign"><div class="pic">${svg(s.g)}</div><span class="pill ${s.f === 'danger' || s.f === 'interdiction' ? 'bad' : s.f === 'priorite' ? 'warn' : 'acc'}" style="justify-self:start">${FAMS[s.f][0]}</span><b>${esc(s.n)}</b><p>${esc(s.s)}</p></div>`).join('')}</div>`;
}

/* ---- Entraînement & examen blanc ---- */
let Q = { etat: 'config', mode: 'mixte', app: '', items: [], i: 0, rep: [], sel: null, end: 0 };
let qTimer = 0;
function buildQuiz(mode) {
  const n = mode === 'examen' ? 40 : 10;
  const signQ = s => { const same = shuffle(SIGNS.filter(x => x.id !== s.id && x.f === s.f)); const other = shuffle(SIGNS.filter(x => x.id !== s.id && x.f !== s.f)); const d = [...same.slice(0, 2), ...other].slice(0, 3); const choix = shuffle([s, ...d]); return { kind: 'sign', q: 'Que signifie ce panneau ?', g: s.g, c: choix.map(x => x.n), b: choix.indexOf(s), e: s.s }; };
  const ruleQ = r => { const ord = shuffle(r.c.map((t, i) => ({ t, i }))); return { kind: 'rule', q: r.q, c: ord.map(o => o.t), b: ord.findIndex(o => o.i === r.b), e: r.e }; };
  const signs = shuffle(SIGNS), rules = shuffle(QREGLES);
  let nS = mode === 'panneaux' ? n : mode === 'regles' ? 0 : Math.ceil(n / 2);
  nS = Math.min(nS, signs.length); let nR = Math.min(n - nS, rules.length); if (nS + nR < n) nS = Math.min(signs.length, n - nR);
  return shuffle([...signs.slice(0, nS).map(signQ), ...rules.slice(0, nR).map(ruleQ)]);
}
function stopTimer() { clearInterval(qTimer); qTimer = 0; }
function finishQuiz() {
  stopTimer(); Q.etat = 'fin';
  const sc = Q.rep.filter((r, i) => r === Q.items[i].b).length;
  if (Q.app && !S.ro) put('quiz', uid(), { apprenantId: Q.app, date: todayISO(), mode: Q.mode, score: sc, total: Q.items.length }).then(() => toast('Score enregistré')).catch(() => {});
  render(); window.scrollTo(0, 0);
}
function tickTimer() {
  const left = Math.max(0, Math.round((Q.end - Date.now()) / 1000)); const el = $('#qz-timer');
  if (el) { el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; el.classList.toggle('low', left < 120); }
  if (left <= 0) { toast('Temps écoulé'); finishQuiz(); }
}
function vQuiz() {
  const h = head('Entraînement au code', 'Séries d’entraînement et examen blanc');
  const seuil = Number(cfg().seuilCode) || 35;
  const modeName = m => ({ panneaux: 'Panneaux', regles: 'Règles', mixte: 'Mixte', examen: 'Examen blanc' }[m] || m);
  if (Q.etat === 'config') {
    const apps = S.apprenants.filter(a => !['diplome', 'abandon'].includes(a.statut)).sort(by('nom'));
    const recent = S.quiz.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 10);
    return h + `<div class="quiz"><div class="qcard"><h3>Nouvelle série</h3>
      <div class="grid2"><label class="f"><span>Type</span><select id="qz-mode"><option value="mixte" ${Q.mode === 'mixte' ? 'selected' : ''}>Entraînement mixte (10 questions)</option><option value="panneaux" ${Q.mode === 'panneaux' ? 'selected' : ''}>Panneaux (10 questions)</option><option value="regles" ${Q.mode === 'regles' ? 'selected' : ''}>Règles (10 questions)</option><option value="examen" ${Q.mode === 'examen' ? 'selected' : ''}>Examen blanc (40 questions, 25 min)</option></select></label>
      <label class="f"><span>Apprenant (pour enregistrer le score)</span><select id="qz-app"><option value="">Entraînement libre (non enregistré)</option>${apps.map(a => `<option value="${a.id}" ${Q.app === a.id ? 'selected' : ''}>${esc(nomC(a))}</option>`).join('')}</select></label></div>
      <p class="note">L’examen blanc se déroule sans correction immédiate ; il est réussi à partir de ${seuil} bonnes réponses sur 40 (seuil modifiable dans les paramètres).</p>
      <div><button class="btn" data-act="qz-start">Commencer</button></div></div>
      <div class="card"><h3>Derniers scores enregistrés</h3><div class="list">${recent.map(r => { const ok = r.total === 40 ? r.score >= seuil : r.score >= 8; return `<div class="li"><div class="t"><b>${esc(nomC(appById(r.apprenantId)))}</b><small>${fmtDate(r.date)} · ${modeName(r.mode)}</small></div><span class="pill ${ok ? 'ok' : r.score / r.total >= .5 ? 'warn' : 'bad'} num">${r.score} / ${r.total}</span></div>`; }).join('') || '<p class="empty">Aucun score enregistré. Choisissez un apprenant avant de lancer une série pour garder son résultat.</p>'}</div></div></div>`;
  }
  if (Q.etat === 'fin') {
    const sc = Q.rep.filter((r, i) => r === Q.items[i].b).length; const N = Q.items.length;
    const verdict = Q.mode === 'examen' ? (sc >= seuil ? `Examen blanc réussi (seuil : ${seuil}/${N}).` : `Examen blanc non réussi : il faut au moins ${seuil}/${N}.`) : (sc >= 9 ? 'Excellent, niveau examen.' : sc >= 7 ? 'Bon résultat, encore un peu de révision.' : 'À retravailler : relisez les leçons puis refaites une série.');
    return h + `<div class="quiz"><div class="qcard"><p class="note">${modeName(Q.mode)} terminé${Q.app ? ' · ' + esc(nomC(appById(Q.app))) : ''}</p><div class="score" style="color:${Q.mode === 'examen' ? (sc >= seuil ? 'var(--ok)' : 'var(--bad)') : 'inherit'}">${sc} / ${N}</div><p>${verdict}</p><div class="qprog">${Q.items.map((it, i) => `<i class="${Q.rep[i] === it.b ? 'ok' : 'ko'}"></i>`).join('')}</div><div class="row"><button class="btn" data-act="qz-again">Nouvelle série</button><a class="btn ghost" href="#code">Revoir les leçons</a></div></div>
    <div class="card"><h3>Correction</h3><div class="list">${Q.items.map((it, i) => `<div class="li"><div class="t"><b>${i + 1}. ${it.kind === 'sign' ? 'Panneau : ' + esc(it.c[it.b]) : esc(it.q)}</b><small>${Q.rep[i] === it.b ? 'Bonne réponse' : (Q.rep[i] == null ? 'Sans réponse' : 'Votre réponse : ' + esc(it.c[Q.rep[i]])) + ' — Bonne réponse : ' + esc(it.c[it.b])}</small></div><span class="pill ${Q.rep[i] === it.b ? 'ok' : 'bad'}">${Q.rep[i] === it.b ? '✓' : '✗'}</span></div>`).join('')}</div></div></div>`;
  }
  const it = Q.items[Q.i]; const ans = Q.rep[Q.i]; const exam = Q.mode === 'examen';
  const prog = Q.items.map((x, i) => `<i class="${exam ? (i < Q.i ? 'cur' : '') : (i < Q.i || (i === Q.i && ans != null) ? (Q.rep[i] === x.b ? 'ok' : 'ko') : i === Q.i ? 'cur' : '')}"></i>`).join('');
  const btnCls = k => exam ? (Q.sel === k ? 'sel' : '') : (ans != null ? (k === it.b ? 'good' : k === ans ? 'bad' : '') : '');
  return h + `<div class="quiz"><div class="row" style="justify-content:space-between"><span class="note">Question ${Q.i + 1} sur ${Q.items.length}</span>${exam ? `<span class="timer" id="qz-timer">--:--</span>` : ''}</div><div class="qprog">${prog}</div>
    <div class="qcard">${it.g ? `<div class="pic">${svg(it.g)}</div>` : ''}<h3 style="font-size:1.3rem">${esc(it.q)}</h3>
    <div class="choices">${it.c.map((c, k) => `<button data-act="qz-ans" data-k="${k}" ${!exam && ans != null ? 'disabled' : ''} class="${btnCls(k)}"><span class="k">${'ABCD'[k]}</span>${esc(c)}</button>`).join('')}</div>
    ${exam ? `<div><button class="btn" data-act="qz-valid" ${Q.sel == null ? 'disabled' : ''}>${Q.i + 1 < Q.items.length ? 'Valider et continuer' : 'Valider et terminer'}</button></div>` :
      ans != null ? `<div class="expl"><b>${ans === it.b ? 'Bonne réponse.' : 'Mauvaise réponse.'}</b> ${esc(it.e)}</div><div><button class="btn" data-act="qz-next">${Q.i + 1 < Q.items.length ? 'Question suivante' : 'Voir le résultat'}</button></div>` : ''}
    </div><div><button class="btn link" data-act="qz-quit">Abandonner</button></div></div>`;
}

/* ---- Paramètres ---- */
function vParametres() {
  const c = cfg(); const ex = COLS.reduce((n, k) => n + S[k].filter(x => x.exemple).length, 0);
  let theme = 'auto'; try { theme = localStorage.getItem('ae-theme') || 'auto'; } catch (e) {}
  const standalone = window.matchMedia && matchMedia('(display-mode: standalone)').matches;
  return head('Paramètres', 'Identité de l’école, sauvegardes, sécurité et installation') +
  `<form id="frm-cfg" class="card form" style="max-width:820px"><h3>Identité de l’auto-école</h3><p class="note">Ces informations apparaissent sur les reçus, fiches d’inscription et attestations.</p><div class="grid2">
    <label class="f"><span>Nom de l’auto-école</span><input id="c-nom" name="nom" value="${esc(c.nom)}" required></label>
    <label class="f"><span>N° d’agrément</span><input id="c-agr" name="agrement" value="${esc(c.agrement || '')}"></label>
    <label class="f"><span>Adresse</span><input id="c-adr" name="adresse" value="${esc(c.adresse || '')}"></label>
    <label class="f"><span>Ville</span><input id="c-ville" name="ville" value="${esc(c.ville || '')}"></label>
    <label class="f"><span>Téléphone</span><input id="c-tel" name="telephone" value="${esc(c.telephone || '')}"></label>
    <label class="f"><span>E-mail</span><input id="c-mail" name="email" type="email" value="${esc(c.email || '')}"></label>
    <label class="f"><span>NIF / RCCM</span><input id="c-nif" name="nif" value="${esc(c.nif || '')}"></label>
    <label class="f"><span>Devise</span><input id="c-devise" name="devise" value="${esc(c.devise)}" placeholder="FCFA, €, MAD, DA…"></label>
    <label class="f"><span>Seuil de réussite de l’examen blanc (sur 40)</span><input id="c-seuil" name="seuilCode" type="number" min="1" max="40" value="${esc(c.seuilCode)}"></label>
    <label class="f"><span>Signataire des documents</span><input id="c-dir" name="directeur" value="${esc(c.directeur || '')}" placeholder="Nom du directeur ou de la directrice"></label>
  </div>
  <div class="row">${c.logo ? `<img class="logo-prev" src="${esc(c.logo)}" alt="Logo">` : '<span class="note">Aucun logo</span>'}<button type="button" class="btn ghost sm w" data-act="logo">${c.logo ? 'Changer le logo' : 'Ajouter un logo'}</button>${c.logo ? '<button type="button" class="btn link sm w" data-act="logo-del">Retirer</button>' : ''}</div>
  <div class="w"><button class="btn">Enregistrer</button></div></form>

  <div class="card" style="max-width:820px"><h3>Sauvegarde et restauration</h3><p>Téléchargez régulièrement une copie complète de vos données (fichier .json). Vous pourrez la restaurer sur cet appareil ou sur un autre.</p>
    <div class="row" style="margin-top:10px"><button class="btn" data-act="backup">Télécharger une sauvegarde</button><button class="btn ghost w" data-act="restore">Restaurer une sauvegarde…</button></div>
    ${c.lastBackup ? `<p class="note" style="margin-top:8px">Dernière sauvegarde : ${fmtLong(c.lastBackup)}</p>` : ''}</div>

  ${S.mode === 'local' ? `<div class="card" style="max-width:820px"><h3>Code d’accès</h3><p>Protégez l’ouverture de l’application sur cet appareil par un code.</p>
    <form id="frm-pin" class="row" style="margin-top:10px"><input id="pin-new" type="password" inputmode="numeric" minlength="4" placeholder="${c.pinHash ? 'Nouveau code' : 'Code (4 chiffres ou plus)'}" style="background:var(--surface-2);border:1px solid var(--line);border-radius:8px;padding:8px 10px" aria-label="Nouveau code"><button class="btn">${c.pinHash ? 'Changer le code' : 'Activer le code'}</button>${c.pinHash ? '<button type="button" class="btn ghost" data-act="pin-off">Désactiver</button><button type="button" class="btn ghost" data-act="lock-now">Verrouiller maintenant</button>' : ''}</form>
    <p class="note" style="margin-top:8px">Le code empêche l’accès rapide à l’application. Pour une protection complète, verrouillez aussi la session de l’ordinateur ou du téléphone.</p></div>` : ''}

  ${!IN_ARTIFACT ? `<div class="card" style="max-width:820px"><h3>Apparence</h3><div class="tabs" role="group" aria-label="Thème">${[['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']].map(([k, l]) => `<button data-act="theme" data-v="${k}" aria-pressed="${theme === k}">${l}</button>`).join('')}</div></div>` : ''}

  <div class="card" style="max-width:820px"><h3>Installer l’application</h3>
    ${standalone ? '<p><span class="pill ok">Installée</span> L’application fonctionne en mode autonome, même sans connexion.</p>' : deferredInstall ? '<p><button class="btn" data-act="install">Installer sur cet appareil</button></p>' : ''}
    <ul class="steps"><li><b>Windows, Mac, Linux</b> : ouvrez l’application dans Chrome ou Edge, puis cliquez sur l’icône d’installation à droite de la barre d’adresse (ou menu ⋮ › « Installer »). Des installateurs classiques (.exe, .dmg, .AppImage) sont aussi fournis avec la version bureau.</li><li><b>Android</b> : dans Chrome, menu ⋮ › « Installer l’application » ou « Ajouter à l’écran d’accueil ».</li><li><b>iPhone, iPad</b> : dans Safari, bouton Partager › « Sur l’écran d’accueil ».</li></ul>
    ${IN_ARTIFACT ? '<p class="note" style="margin-top:8px">Cette page en ligne est la version partagée. La version installable se trouve dans le dossier du projet fourni avec l’application.</p>' : ''}</div>

  ${ex ? `<div class="card w" style="max-width:820px"><h3>Données d’exemple</h3><p>${ex} élément(s) marqués « exemple » servent à montrer le fonctionnement. Supprimez-les quand vous saisissez vos vraies données.</p><p style="margin-top:10px"><button class="btn danger" data-act="purge-ex">Supprimer les données d’exemple</button></p></div>` : ''}
  <p class="note">${S.mode === 'db' ? 'Les données sont enregistrées en ligne et partagées avec les personnes à qui vous donnez accès.' : 'Les données sont enregistrées sur cet appareil uniquement. Pensez aux sauvegardes.'} Version ${APP_VERSION}.</p>`;
}
