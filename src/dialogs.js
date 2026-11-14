/* ============ Dialogues & formulaires ============ */
const dlg = $('#dlg');
function openDlg(html) { $('#dlg-body').innerHTML = html; if (!dlg.open) { try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); } } }
function closeDlg() { try { dlg.close(); } catch (e) { dlg.removeAttribute('open'); } }
dlg.addEventListener('click', e => { if (e.target === dlg) closeDlg(); });
const dhead = t => `<header class="dh"><h2>${t}</h2><button type="button" class="icon" data-act="close" aria-label="Fermer">×</button></header>`;
const inp = (label, name, val, attrs = '', type = 'text') => `<label class="f"><span>${label}</span><input id="i-${name}" name="${name}" type="${type}" value="${esc(val ?? '')}" ${attrs}></label>`;
const sel = (label, name, val, opts, attrs = '') => `<label class="f"><span>${label}</span><select id="i-${name}" name="${name}" ${attrs}>${opts.map(([k, v]) => `<option value="${esc(k)}" ${String(val ?? '') === String(k) ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>`;
const area = (label, name, val) => `<label class="f"><span>${label}</span><textarea id="i-${name}" name="${name}">${esc(val ?? '')}</textarea></label>`;
const fd = form => Object.fromEntries(new FormData(form).entries());
const footer = (delAct, id) => `<footer class="df">${delAct && id ? `<button type="button" class="btn ghost" data-act="${delAct}" data-id="${id}">Supprimer</button>` : ''}<button type="button" class="btn ghost" data-act="close">Annuler</button><button class="btn">Enregistrer</button></footer>`;
let toastT = 0;
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 3400); }

/* ---- Apprenant : formulaire ---- */
function formApprenant(a) {
  const isNew = !a; a = a || { statut: 'inscrit', dateInscription: todayISO(), categorie: (catsSorted().find(c => c.code === 'B') || catsSorted()[0] || {}).code };
  const cats = catsSorted(); let photo = a.photo || '';
  openDlg(`<form id="frm-app" class="form" data-id="${a.id || ''}">${dhead(isNew ? 'Inscrire un apprenant' : 'Modifier l’apprenant')}
    <div class="row">${avatar(a)}<button type="button" class="btn ghost sm" id="btn-photo">${a.photo ? 'Changer la photo' : 'Ajouter une photo'}</button><span class="note">${isNew ? 'N° de dossier attribué automatiquement' : 'Dossier ' + esc(a.dossier || '—')}</span></div>
    <p class="section-title">Identité</p>
    <div class="grid2">${inp('Nom', 'nom', a.nom, 'required autocomplete="off"')}${inp('Prénom(s)', 'prenom', a.prenom, 'required autocomplete="off"')}
    ${sel('Sexe', 'sexe', a.sexe, [['', '—'], ['F', 'Féminin'], ['M', 'Masculin']])}${inp('Date de naissance', 'dateNaissance', a.dateNaissance, '', 'date')}
    ${inp('Lieu de naissance', 'lieuNaissance', a.lieuNaissance)}${inp('Nationalité', 'nationalite', a.nationalite)}
    ${inp('N° pièce d’identité', 'piece', a.piece)}${inp('Profession', 'profession', a.profession)}</div>
    <p class="section-title">Contact</p>
    <div class="grid2">${inp('Téléphone', 'telephone', a.telephone, '', 'tel')}${inp('E-mail', 'email', a.email, '', 'email')}
    ${inp('Adresse', 'adresse', a.adresse)}${inp('Personne à prévenir (nom et téléphone)', 'urgence', a.urgence)}</div>
    <p class="section-title">Formation</p>
    <div class="grid2">${sel('Catégorie de permis', 'categorie', a.categorie, cats.length ? cats.map(c => [c.code, c.code + ' — ' + c.libelle]) : [['', 'Aucune catégorie : ajoutez-en d’abord']])}
    ${sel('Statut', 'statut', a.statut, Object.entries(STATUTS))}
    ${inp('Date d’inscription', 'dateInscription', a.dateInscription, 'required', 'date')}
    ${inp('Coût total de la formation (' + esc(cfg().devise) + ')', 'montantTotal', a.montantTotal, 'min="0" step="any"', 'number')}
    ${inp('N° de livret / dossier préfecture', 'numLivret', a.numLivret)}${inp('Date d’obtention du permis', 'datePermis', a.datePermis, '', 'date')}</div>
    ${area('Notes', 'notes', a.notes)}
    <p class="warn-t" id="age-warn" hidden></p>
    ${footer()}</form>`);
  const f = $('#frm-app');
  $('#btn-photo').onclick = async () => { const file = await pickFile('image/*'); if (!file) return; try { photo = await resizeImage(file, 260); f.querySelector('.avatar').innerHTML = `<img src="${photo}" alt="">`; } catch (e) { toast('Image illisible.'); } };
  const check = () => { const c = catBy(f.categorie.value); const ag = age(f.dateNaissance.value); const w = $('#age-warn');
    if (c && ag != null && c.ageMin && ag < c.ageMin) { w.textContent = `Attention : ${ag} ans, l’âge minimum pour la catégorie ${c.code} est ${c.ageMin} ans.`; w.hidden = false; } else w.hidden = true;
    if (c && c.tarif && !f.montantTotal.value) f.montantTotal.value = c.tarif; };
  f.categorie.addEventListener('change', check); f.dateNaissance.addEventListener('change', check); check();
  f.addEventListener('submit', async e => { e.preventDefault(); const d = fd(f); const id = f.dataset.id || uid(); const old = appById(id) || {};
    const row = { ...old, ...d, nom: d.nom.trim().toUpperCase(), prenom: d.prenom.trim(), montantTotal: Number(d.montantTotal) || 0, paiements: old.paiements || [], photo, dossier: old.dossier || nextDossier() };
    if (!photo) delete row.photo;
    try { await put('apprenants', id, row); toast(isNew ? 'Apprenant inscrit · dossier ' + row.dossier : 'Modifications enregistrées'); S.appTab = 'resume'; openApp(id, row); } catch (e) {} });
}

/* ---- Apprenant : fiche détaillée ---- */
function openApp(id, fallback) {
  const a = appById(id) || (fallback ? { ...fallback, id } : null); if (!a) return;
  const c = catBy(a.categorie); const m = minutesConduite(a); const req = (c && c.heuresConduite) || 0; const pct = req ? Math.min(100, Math.round(100 * m / 60 / req)) : 0;
  const ag = age(a.dateNaissance);
  const tabs = [['resume', 'Résumé'], ['paiements', 'Paiements'], ['livret', 'Livret'], ['seances', 'Séances et examens'], ['dossier', 'Dossier et documents']];
  let body = '';
  if (S.appTab === 'resume') {
    const qz = S.quiz.filter(q => q.apprenantId === a.id).sort((x, y) => String(y.date).localeCompare(String(x.date)));
    body = `<div class="info"><div><span>N° de dossier</span><b>${esc(a.dossier || '—')}</b></div><div><span>Téléphone</span><b>${esc(a.telephone || '—')}</b></div><div><span>Naissance</span><b>${fmtDate(a.dateNaissance)}${ag != null ? ` (${ag} ans)` : ''}</b></div><div><span>Pièce d’identité</span><b>${esc(a.piece || '—')}</b></div><div><span>Adresse</span><b>${esc(a.adresse || '—')}</b></div><div><span>Personne à prévenir</span><b>${esc(a.urgence || '—')}</b></div><div><span>Inscription</span><b>${fmtDate(a.dateInscription)}</b></div>${a.datePermis ? `<div><span>Permis obtenu</span><b>${fmtDate(a.datePermis)}</b></div>` : ''}</div>
    ${a.notes ? `<p class="expl">${esc(a.notes)}</p>` : ''}
    <div class="sect"><h3>Progression</h3>
      <div class="hbar" style="grid-template-columns:120px minmax(0,1fr) 110px"><span>Conduite</span><div class="bar ${pct >= 100 ? 'ok' : ''}"><i style="width:${pct}%"></i></div><b class="num" style="text-align:right">${fmtH(m)}${req ? ' / ' + req + ' h' : ''}</b></div>
      <div class="hbar" style="grid-template-columns:120px minmax(0,1fr) 110px"><span>Code</span><div class="bar"><i style="width:${c && c.heuresCode ? Math.min(100, Math.round(100 * minutesCode(a) / 60 / c.heuresCode)) : 0}%"></i></div><b class="num" style="text-align:right">${fmtH(minutesCode(a))}${c && c.heuresCode ? ' / ' + c.heuresCode + ' h' : ''}</b></div>
      <div class="hbar" style="grid-template-columns:120px minmax(0,1fr) 110px"><span>Compétences</span><div class="bar"><i style="width:${livretPct(a)}%"></i></div><b class="num" style="text-align:right">${livretPct(a)} %</b></div>
      <div class="hbar" style="grid-template-columns:120px minmax(0,1fr) 110px"><span>Paiement</span><div class="bar ok"><i style="width:${a.montantTotal ? Math.min(100, Math.round(100 * paye(a) / a.montantTotal)) : 0}%"></i></div><b class="num" style="text-align:right">${money(paye(a))}</b></div></div>
    ${qz.length ? `<div class="sect"><h3>Scores au code</h3><div class="row">${qz.slice(0, 12).map(q => `<span class="pill ${q.total === 40 ? (q.score >= (Number(cfg().seuilCode) || 35) ? 'ok' : 'bad') : q.score >= 8 ? 'ok' : q.score >= 5 ? 'warn' : 'bad'} num" title="${fmtDate(q.date)}">${q.score}/${q.total}</span>`).join('')}</div></div>` : ''}`;
  } else if (S.appTab === 'paiements') {
    body = `<div class="kpis"><div class="kpi"><span>Coût total</span><b class="num" style="font-size:1.3rem">${money(a.montantTotal)}</b></div><div class="kpi"><span>Payé</span><b class="num" style="font-size:1.3rem">${money(paye(a))}</b></div><div class="kpi"><span>Reste</span><b class="num" style="font-size:1.3rem;color:${reste(a) ? 'var(--warn)' : 'var(--ok)'}">${money(reste(a))}</b></div></div>
    <div class="list">${(a.paiements || []).map((p, i) => `<div class="li"><div class="t"><b class="num">${money(p.montant)}</b><small>${fmtDate(p.date)} · ${esc(p.mode || '')} · ${esc(p.no || '')}${p.motif ? ' · ' + esc(p.motif) : ''}</small></div><div class="row" style="flex-wrap:nowrap"><button class="btn ghost sm" data-act="recu" data-id="${a.id}" data-i="${i}">Reçu</button><button class="btn link sm w" data-act="del-pay" data-id="${a.id}" data-i="${i}">Retirer</button></div></div>`).join('') || '<p class="empty">Aucun paiement enregistré.</p>'}</div>
    <form id="frm-pay" class="payrow w" data-id="${a.id}"><label class="f"><span>Montant</span><input id="p-montant" name="montant" type="number" min="1" step="any" required value="${reste(a) || ''}"></label><label class="f"><span>Date</span><input id="p-date" name="date" type="date" value="${todayISO()}" required></label><label class="f"><span>Mode</span><select id="p-mode" name="mode">${MODES_PAY.map(x => `<option>${x}</option>`).join('')}</select></label><label class="f"><span>Motif</span><input id="p-motif" name="motif" placeholder="Acompte, frais d’examen…"></label><button class="btn">Encaisser</button></form>
    <div class="row"><button class="btn ghost sm" data-act="releve" data-id="${a.id}">Imprimer le relevé de compte</button></div>`;
  } else if (S.appTab === 'livret') {
    const lv = a.livret || {};
    body = `<p class="note">Évaluez chaque compétence au fil des leçons. Progression globale : <b>${livretPct(a)} %</b>.</p><div class="livret">${COMPETENCES.map((g, gi) => `<div><h4>${gi + 1}. ${esc(g.g)}</h4>${g.items.map((it, ii) => { const k = gi + '-' + ii, v = Number(lv[k] || 0); return `<div class="comp"><span>${esc(it)}</span><select id="lv-${k}" class="lv${v}" data-act-change="livret" data-app="${a.id}" data-k="${k}" aria-label="${esc(it)}" ${S.ro ? 'disabled' : ''}>${NIVEAUX.map((n, x) => `<option value="${x}" ${x === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`; }).join('')}</div>`).join('')}</div>`;
  } else if (S.appTab === 'seances') {
    const seances = S.seances.filter(s => s.apprenantId === a.id).sort((x, y) => (y.date + y.heure).localeCompare(x.date + x.heure));
    const exams = S.examens.filter(e => (e.candidats || []).some(x => x.id === a.id)).sort(by('date'));
    body = `<div class="sect"><h3>Séances (${seances.length})</h3><div class="list">${seances.slice(0, 30).map(s => `<div class="li"><div class="t"><b>${fmtDate(s.date)} · ${esc(s.heure || '')} · ${s.type === 'code' ? 'Code' : 'Conduite'} (${fmtH(+s.duree || 0)})</b><small>${esc(s.moniteur || '')}${s.notes ? ' · ' + esc(s.notes) : ''}</small></div><span class="pill ${s.statut === 'effectuee' ? 'ok' : s.statut === 'annulee' ? 'bad' : ''}">${SEANCE_ST[s.statut]}</span></div>`).join('') || '<p class="empty">Aucune séance.</p>'}</div><div class="w"><button class="btn ghost sm" data-act="new-seance" data-app="${a.id}">Planifier une séance</button></div></div>
    <div class="sect"><h3>Examens</h3><div class="list">${exams.map(e => { const r = e.candidats.find(x => x.id === a.id).resultat; return `<div class="li"><div class="t"><b>${fmtDate(e.date)} · ${esc(EXT[e.type] || e.type)}</b><small>${esc(e.lieu || '')}</small></div><span class="pill ${RES_CLS[r] || ''}">${RES[r] || r}</span></div>`; }).join('') || '<p class="empty">Pas encore inscrit à un examen.</p>'}</div></div>`;
  } else {
    const dc = a.docs || {};
    body = `<div class="sect"><h3>Pièces du dossier</h3><div class="docs">${DOCS.map((d, i) => `<label><input type="checkbox" id="doc-${i}" data-act-change="doc" data-app="${a.id}" data-i="${i}" ${dc[i] ? 'checked' : ''} ${S.ro ? 'disabled' : ''}> ${esc(d)}</label>`).join('')}</div></div>
    <div class="sect"><h3>Documents à imprimer</h3><div class="row"><button class="btn ghost" data-act="fiche" data-id="${a.id}">Fiche d’inscription</button><button class="btn ghost" data-act="contrat" data-id="${a.id}">Contrat de formation</button><button class="btn ghost" data-act="attestation" data-id="${a.id}">Attestation de formation</button><button class="btn ghost" data-act="releve" data-id="${a.id}">Relevé de compte</button></div>
    <p class="note">${IN_ARTIFACT ? 'Ici, chaque document est téléchargé en fichier .html qui s’imprime à l’ouverture.' : 'Le document s’ouvre dans la fenêtre d’impression : choisissez votre imprimante ou « Enregistrer en PDF ».'}</p></div>`;
  }
  openDlg(`${dhead(esc(nomC(a)))}
    <div class="row">${avatar(a)}<div style="display:grid;gap:6px"><div class="row">${statutPill(a.statut)}<span class="catbadge">${esc(a.categorie || '?')}</span>${c ? `<span class="note">${esc(c.libelle)}</span>` : ''}${exPill(a)}</div><span class="note">Dossier ${esc(a.dossier || '—')}</span></div></div>
    <div class="dtabs" role="group" aria-label="Sections de la fiche">${tabs.map(([k, l]) => `<button data-act="apptab" data-v="${k}" data-id="${a.id}" aria-pressed="${S.appTab === k}">${l}</button>`).join('')}</div>
    ${body}
    <footer class="df w"><button class="btn ghost" data-act="del-app" data-id="${a.id}">Supprimer le dossier</button><button class="btn" data-act="edit-app" data-id="${a.id}">Modifier</button></footer>`);
  const pf = $('#frm-pay');
  if (pf) pf.addEventListener('submit', async e => { e.preventDefault(); const d = fd(pf); const cur = appById(a.id) || a;
    const p = { montant: Number(d.montant), date: d.date, mode: d.mode, motif: d.motif.trim(), no: nextRecu() };
    const row = { ...cur, paiements: [...(cur.paiements || []), p] };
    try { await put('apprenants', a.id, row); toast('Paiement enregistré · reçu ' + p.no); openApp(a.id, row); } catch (e) {} });
}

/* ---- Documents imprimables ---- */
function docRecu(a, i) {
  const p = (a.paiements || [])[i]; if (!p) return; const c = cfg();
  const avant = sum((a.paiements || []).slice(0, i), x => x.montant);
  printDoc('Reçu ' + (p.no || ''), docHead('Reçu de paiement', `N° ${esc(p.no || '—')}<br>Le ${fmtLong(p.date)}`) +
    `<table><tr><th style="width:35%">Reçu de</th><td><b>${esc(nomC(a))}</b> — dossier ${esc(a.dossier || '—')}</td></tr><tr><th>Formation</th><td>Permis ${esc(a.categorie || '')} ${catBy(a.categorie) ? '— ' + esc(catBy(a.categorie).libelle) : ''}</td></tr><tr><th>Motif</th><td>${esc(p.motif || 'Frais de formation')}</td></tr><tr><th>Mode de paiement</th><td>${esc(p.mode || '')}</td></tr><tr><th>Montant</th><td class="big">${money(p.montant)}</td></tr><tr><th>Arrêté à la somme de</th><td><i>${esc(enLettres(p.montant))} ${esc(c.devise || '')}</i></td></tr></table>
    <h2>Situation du compte</h2><table><tr><th>Coût total de la formation</th><th>Déjà versé avant ce reçu</th><th>Ce versement</th><th>Reste à payer</th></tr><tr><td>${money(a.montantTotal)}</td><td>${money(avant)}</td><td>${money(p.montant)}</td><td><b>${money(Math.max(0, (a.montantTotal || 0) - avant - p.montant))}</b></td></tr></table>
    <div class="sign"><div>Signature de l’apprenant</div><div>Pour ${esc(c.nom)}${c.directeur ? '<br>' + esc(c.directeur) : ''}</div></div>`);
}
function docFiche(a) {
  const c = catBy(a.categorie);
  printDoc('Fiche inscription ' + nomC(a), docHead('Fiche d’inscription', `Dossier ${esc(a.dossier || '—')}<br>Inscrit le ${fmtLong(a.dateInscription)}`) +
    `<div style="display:flex;gap:18px;align-items:flex-start">${a.photo ? `<img src="${esc(a.photo)}" style="width:110px;height:140px;object-fit:cover;border:1px solid #999">` : '<div style="width:110px;height:140px;border:1px dashed #999;display:grid;place-items:center;font-size:9pt;color:#666">Photo</div>'}
    <table style="flex:1"><tr><th>Nom</th><td><b>${esc(a.nom || '')}</b></td><th>Prénom(s)</th><td>${esc(a.prenom || '')}</td></tr><tr><th>Né(e) le</th><td>${fmtDate(a.dateNaissance)}</td><th>À</th><td>${esc(a.lieuNaissance || '')}</td></tr><tr><th>Sexe</th><td>${esc(a.sexe || '')}</td><th>Nationalité</th><td>${esc(a.nationalite || '')}</td></tr><tr><th>Pièce d’identité</th><td>${esc(a.piece || '')}</td><th>Profession</th><td>${esc(a.profession || '')}</td></tr><tr><th>Téléphone</th><td>${esc(a.telephone || '')}</td><th>E-mail</th><td>${esc(a.email || '')}</td></tr><tr><th>Adresse</th><td colspan="3">${esc(a.adresse || '')}</td></tr><tr><th>Personne à prévenir</th><td colspan="3">${esc(a.urgence || '')}</td></tr></table></div>
    <h2>Formation choisie</h2><table><tr><th>Catégorie</th><td><b>${esc(a.categorie || '')}</b> — ${esc(c ? c.libelle : '')}</td></tr><tr><th>Volume prévu</th><td>${c ? `${c.heuresCode} h de code, ${c.heuresConduite} h de conduite` : ''}</td></tr><tr><th>Coût de la formation</th><td>${money(a.montantTotal)}</td></tr></table>
    <h2>Pièces fournies</h2><table>${DOCS.map((d, i) => `<tr><td style="width:30px;text-align:center">${(a.docs || {})[i] ? '☑' : '☐'}</td><td>${esc(d)}</td></tr>`).join('')}</table>
    <p class="small">Je soussigné(e) certifie l’exactitude des renseignements ci-dessus et déclare avoir pris connaissance du règlement intérieur de l’établissement.</p>
    <div class="sign"><div>Date et signature de l’apprenant</div><div>Cachet et signature de l’auto-école</div></div>`);
}
function docContrat(a) {
  const c = catBy(a.categorie), k = cfg();
  printDoc('Contrat ' + nomC(a), docHead('Contrat de formation', `Dossier ${esc(a.dossier || '—')}`) +
    `<p>Entre <b>${esc(k.nom)}</b>${k.agrement ? ', agrément n° ' + esc(k.agrement) : ''}, ${esc([k.adresse, k.ville].filter(Boolean).join(', '))}, ci-après « l’établissement »,</p><p>et <b>${esc(nomC(a))}</b>, né(e) le ${fmtDate(a.dateNaissance)}, pièce d’identité n° ${esc(a.piece || '…')}, ci-après « l’élève »,</p><p>il est convenu ce qui suit.</p>
    <h2>Article 1 — Objet</h2><p>L’établissement s’engage à dispenser à l’élève la formation théorique et pratique préparant au permis de conduire de catégorie <b>${esc(a.categorie || '')}</b>${c ? ' (' + esc(c.libelle) + ')' : ''}.</p>
    <h2>Article 2 — Contenu et durée</h2><p>La formation comprend environ ${c ? c.heuresCode : '…'} heures de cours de code et ${c ? c.heuresConduite : '…'} heures de conduite. Ce volume est indicatif : il peut être ajusté selon la progression constatée dans le livret d’apprentissage.</p>
    <h2>Article 3 — Prix et paiement</h2><p>Le coût de la formation est fixé à <b>${money(a.montantTotal)}</b> (${esc(enLettres(a.montantTotal || 0))} ${esc(k.devise || '')}). Chaque versement donne lieu à un reçu numéroté.</p>
    <h2>Article 4 — Obligations de l’élève</h2><p>L’élève s’engage à être ponctuel, à prévenir au moins 24 heures à l’avance en cas d’absence à une leçon et à respecter le règlement intérieur. Une leçon non décommandée à temps peut être due.</p>
    <h2>Article 5 — Présentation aux examens</h2><p>L’établissement présente l’élève aux examens lorsque son niveau le permet. Les frais d’examen éventuels sont précisés lors de l’inscription.</p>
    <h2>Article 6 — Résiliation</h2><p>Le contrat peut être résilié par l’une ou l’autre des parties par écrit. Les prestations effectuées restent dues.</p>
    <p style="margin-top:16px">Fait en deux exemplaires, le ${fmtLong(todayISO())}${k.ville ? ', à ' + esc(k.ville) : ''}.</p>
    <div class="sign"><div>L’élève (« lu et approuvé »)</div><div>Pour l’établissement${k.directeur ? '<br>' + esc(k.directeur) : ''}</div></div>`);
}
function docAttestation(a) {
  const c = catBy(a.categorie), k = cfg();
  printDoc('Attestation ' + nomC(a), docHead('Attestation de formation', `Dossier ${esc(a.dossier || '—')}`) +
    `<p style="margin-top:20px">Je soussigné(e) ${esc(k.directeur || '…………………………')}, responsable de l’établissement d’enseignement de la conduite <b>${esc(k.nom)}</b>${k.agrement ? ' (agrément n° ' + esc(k.agrement) + ')' : ''}, atteste que :</p>
    <p class="big" style="text-align:center;margin:18px 0">${esc(nomC(a))}</p>
    <p>né(e) le ${fmtDate(a.dateNaissance)}${a.lieuNaissance ? ' à ' + esc(a.lieuNaissance) : ''}, a suivi dans notre établissement la formation au permis de conduire de catégorie <b>${esc(a.categorie || '')}</b>${c ? ' (' + esc(c.libelle) + ')' : ''}, depuis le ${fmtLong(a.dateInscription)}.</p>
    <table><tr><th>Heures de code effectuées</th><td>${fmtH(minutesCode(a))}</td></tr><tr><th>Heures de conduite effectuées</th><td>${fmtH(minutesConduite(a))}</td></tr><tr><th>Compétences acquises (livret)</th><td>${livretPct(a)} %</td></tr>${a.datePermis ? `<tr><th>Permis obtenu le</th><td>${fmtLong(a.datePermis)}</td></tr>` : ''}</table>
    <p>Cette attestation est délivrée à l’intéressé(e) pour servir et valoir ce que de droit.</p>
    <p style="margin-top:16px">Fait le ${fmtLong(todayISO())}${k.ville ? ', à ' + esc(k.ville) : ''}.</p>
    <div class="sign"><div style="visibility:hidden">—</div><div>Signature et cachet<br><span class="stamp">${esc(k.nom)}</span></div></div>`);
}
function docReleve(a) {
  printDoc('Relevé ' + nomC(a), docHead('Relevé de compte', `${esc(nomC(a))}<br>Dossier ${esc(a.dossier || '—')}`) +
    `<table><tr><th>Date</th><th>N° reçu</th><th>Mode</th><th>Motif</th><th style="text-align:right">Montant</th></tr>${(a.paiements || []).map(p => `<tr><td>${fmtDate(p.date)}</td><td>${esc(p.no || '')}</td><td>${esc(p.mode || '')}</td><td>${esc(p.motif || '')}</td><td style="text-align:right">${money(p.montant)}</td></tr>`).join('') || '<tr><td colspan="5">Aucun paiement</td></tr>'}
    <tr><th colspan="4">Total versé</th><th style="text-align:right">${money(paye(a))}</th></tr><tr><th colspan="4">Coût de la formation</th><th style="text-align:right">${money(a.montantTotal)}</th></tr><tr><th colspan="4">Reste à payer</th><th style="text-align:right">${money(reste(a))}</th></tr></table>
    <p class="small">Relevé édité le ${fmtLong(todayISO())}.</p>`);
}
function docExamen(e) {
  printDoc('Examen ' + e.date, docHead('Liste des candidats', `${esc(EXT[e.type] || e.type)} — catégorie ${esc(e.categorie || '')}<br>${fmtDate(e.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${e.heure ? ' à ' + esc(e.heure) : ''}`) +
    `<p>Lieu : <b>${esc(e.lieu || '—')}</b>${e.examinateur ? ' · Examinateur : ' + esc(e.examinateur) : ''}</p>
    <table><tr><th>#</th><th>Nom et prénom(s)</th><th>Dossier</th><th>Né(e) le</th><th>Pièce d’identité</th><th>Résultat</th></tr>${(e.candidats || []).map((c, i) => { const a = appById(c.id); return `<tr><td>${i + 1}</td><td>${esc(nomC(a))}</td><td>${esc(a?.dossier || '')}</td><td>${a ? fmtDate(a.dateNaissance) : ''}</td><td>${esc(a?.piece || '')}</td><td>${c.resultat === 'attente' ? '' : esc(RES[c.resultat] || '')}</td></tr>`; }).join('')}</table>
    <div class="sign"><div>Le responsable de l’établissement</div><div>L’examinateur</div></div>`);
}
function docSemaine() {
  const days = [...Array(7)].map((_, i) => addDays(S.week, i));
  printDoc('Planning ' + S.week, docHead('Planning de la semaine', `Du ${fmtLong(days[0])} au ${fmtLong(days[6])}${S.moniteur ? '<br>Moniteur : ' + esc(S.moniteur) : ''}`) +
    days.map(d => { const ss = S.seances.filter(s => s.date === d && (!S.moniteur || s.moniteur === S.moniteur) && s.statut !== 'annulee').sort(by('heure')); return ss.length ? `<h2>${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}</h2><table><tr><th>Heure</th><th>Type</th><th>Apprenant</th><th>Moniteur</th><th>Véhicule</th></tr>${ss.map(s => `<tr><td>${esc(s.heure)} (${fmtH(+s.duree || 0)})</td><td>${s.type === 'code' ? 'Code' : 'Conduite'}</td><td>${s.apprenantId ? esc(nomC(appById(s.apprenantId))) : esc(s.groupe || 'Collective')}</td><td>${esc(s.moniteur || '')}</td><td>${esc(s.vehicule || '')}</td></tr>`).join('')}</table>` : ''; }).join('') || '<p>Aucune séance cette semaine.</p>');
}

/* ---- Séance ---- */
function formSeance(s, preset = {}) {
  const isNew = !s;
  s = s || { date: preset.date || todayISO(), heure: '08:00', duree: 60, type: 'conduite', statut: 'prevue', apprenantId: preset.app || '' };
  const apps = S.apprenants.filter(a => !['abandon', 'diplome'].includes(a.statut) || a.id === s.apprenantId).sort(by('nom'));
  openDlg(`<form id="frm-se" class="form" data-id="${s.id || ''}">${dhead(isNew ? 'Nouvelle séance' : 'Modifier la séance')}
    <div class="grid2">${inp('Date', 'date', s.date, 'required', 'date')}${inp('Heure de début', 'heure', s.heure, 'required', 'time')}
    ${sel('Type', 'type', s.type, [['conduite', 'Conduite'], ['code', 'Code de la route']])}${inp('Durée (minutes)', 'duree', s.duree, 'min="15" step="15" required', 'number')}
    ${sel('Apprenant', 'apprenantId', s.apprenantId, [['', '— Séance collective / non attribuée —'], ...apps.map(a => [a.id, nomC(a) + ' (' + (a.categorie || '?') + ')'])])}
    ${inp('Groupe (séance collective)', 'groupe', s.groupe, 'placeholder="ex. Code — groupe du matin"')}
    ${inp('Moniteur', 'moniteur', s.moniteur, 'list="dl-mon" autocomplete="off"')}${inp('Véhicule', 'vehicule', s.vehicule, 'list="dl-veh" autocomplete="off"')}
    ${sel('Statut', 'statut', s.statut, Object.entries(SEANCE_ST))}${inp('Kilométrage en fin de séance', 'kmFin', s.kmFin, 'min="0"', 'number')}</div>
    <datalist id="dl-mon">${allMoniteurs().map(m => `<option value="${esc(m)}">`).join('')}</datalist><datalist id="dl-veh">${allVehicules().map(m => `<option value="${esc(m)}">`).join('')}</datalist>
    ${area('Observations du moniteur', 'notes', s.notes)}
    <p class="conflict" id="se-conf" hidden></p>
    ${footer('del-seance', isNew ? '' : s.id)}</form>`);
  const f = $('#frm-se');
  f.addEventListener('input', () => { delete f.dataset.force; $('#se-conf').hidden = true; });
  f.addEventListener('submit', async e => { e.preventDefault(); const d = fd(f); const id = f.dataset.id || uid(); const old = S.seances.find(x => x.id === id) || {};
    const row = { ...old, ...d, id, duree: Number(d.duree) || 60, kmFin: d.kmFin ? Number(d.kmFin) : '' };
    const cf = conflicts(row);
    if (cf.length && !f.dataset.force) { const w = $('#se-conf'); w.textContent = 'Conflit : ' + cf.map(x => `${x.why.join(', ')} déjà pris à ${x.o.heure}`).join(' ; ') + '. Cliquez à nouveau sur « Enregistrer » pour confirmer.'; w.hidden = false; f.dataset.force = '1'; return; }
    try {
      await put('seances', id, row);
      if (row.kmFin && row.vehicule) { const v = S.vehicules.find(x => vehLabel(x) === row.vehicule); if (v && Number(row.kmFin) > Number(v.km || 0)) await put('vehicules', v.id, { ...v, km: Number(row.kmFin) }); }
      toast('Séance enregistrée'); closeDlg();
    } catch (e) {} });
}

/* ---- Examen ---- */
function formExamen(e) {
  const isNew = !e; e = e || { date: addDays(todayISO(), 14), heure: '08:00', type: 'code', categorie: 'B', candidats: [] };
  openDlg(`<form id="frm-ex" class="form" data-id="${e.id || ''}">${dhead(isNew ? 'Programmer un examen' : 'Modifier l’examen')}
    <div class="grid2">${inp('Date', 'date', e.date, 'required', 'date')}${inp('Heure', 'heure', e.heure, '', 'time')}
    ${sel('Épreuve', 'type', e.type, Object.entries(EXT))}${sel('Catégorie', 'categorie', e.categorie, catsSorted().map(c => [c.code, c.code + ' — ' + c.libelle]))}
    ${inp('Lieu / centre d’examen', 'lieu', e.lieu)}${inp('Examinateur', 'examinateur', e.examinateur)}
    ${inp('Frais d’examen par candidat (' + esc(cfg().devise) + ')', 'frais', e.frais, 'min="0" step="any"', 'number')}</div>
    <div class="f"><span>Candidats</span><div class="checks" id="ex-cands"></div></div>
    ${footer('del-ex', isNew ? '' : e.id)}</form>`);
  const f = $('#frm-ex'); const chosen = new Set((e.candidats || []).map(c => c.id));
  const fill = () => { f.querySelectorAll('#ex-cands input').forEach(i => i.checked ? chosen.add(i.value) : chosen.delete(i.value));
    const list = S.apprenants.filter(a => (a.categorie === f.categorie.value && !['diplome', 'abandon'].includes(a.statut)) || chosen.has(a.id)).sort(by('nom'));
    $('#ex-cands').innerHTML = list.map(a => `<label><input type="checkbox" value="${a.id}" ${chosen.has(a.id) ? 'checked' : ''}> ${esc(nomC(a))} <span class="note">· ${esc(STATUTS[a.statut] || '')}${reste(a) ? ' · reste ' + money(reste(a)) : ''}</span></label>`).join('') || '<p class="empty">Aucun apprenant en formation dans cette catégorie.</p>'; };
  f.categorie.addEventListener('change', fill); fill();
  f.addEventListener('submit', async ev => { ev.preventDefault(); const d = fd(f); const id = f.dataset.id || uid(); const old = S.examens.find(x => x.id === id) || {};
    const ids = [...f.querySelectorAll('#ex-cands input:checked')].map(i => i.value);
    const prev = Object.fromEntries((old.candidats || []).map(c => [c.id, c.resultat]));
    const row = { ...old, ...d, frais: Number(d.frais) || 0, candidats: ids.map(i => ({ id: i, resultat: prev[i] || 'attente' })) };
    try {
      await put('examens', id, row);
      for (const i of ids) { const a = appById(i); if (a && !prev[i] && ['inscrit', 'code', 'conduite'].includes(a.statut)) await put('apprenants', a.id, { ...a, statut: 'examen', statutAvant: a.statut }); }
      toast('Examen enregistré'); openEx(id, row);
    } catch (e) {} });
}
function openEx(id, fallback) {
  const e = S.examens.find(x => x.id === id) || (fallback ? { ...fallback, id } : null); if (!e) return;
  const cs = e.candidats || [];
  openDlg(`${dhead(esc(EXT[e.type] || e.type) + ' · ' + esc(e.categorie || ''))}
    <div class="info"><div><span>Date</span><b>${fmtDate(e.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</b></div><div><span>Heure</span><b>${esc(e.heure || '—')}</b></div><div><span>Lieu</span><b>${esc(e.lieu || '—')}</b></div><div><span>Examinateur</span><b>${esc(e.examinateur || '—')}</b></div>${e.frais ? `<div><span>Frais par candidat</span><b>${money(e.frais)}</b></div>` : ''}</div>
    <div class="sect"><h3>Candidats et résultats (${cs.length})</h3><div class="list">${cs.map(c => { const a = appById(c.id); return `<div class="li"><div class="who">${avatar(a, true)}<div class="t"><b>${esc(nomC(a))}</b><small>${a ? esc(a.dossier || '') : ''}</small></div></div><select class="res-sel" id="res-${c.id}" data-act-change="res" data-ex="${e.id}" data-app="${c.id}" aria-label="Résultat de ${esc(nomC(a))}" ${S.ro ? 'disabled' : ''}>${Object.entries(RES).map(([k, v]) => `<option value="${k}" ${c.resultat === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>`; }).join('') || '<p class="empty">Aucun candidat. Modifiez l’examen pour en ajouter.</p>'}</div>
    <p class="note">« Admis » au code fait passer l’apprenant en formation conduite ; « Admis » à la conduite le marque comme ayant obtenu son permis. « Ajourné » ou « Absent » le remet en formation.</p></div>
    <footer class="df"><button class="btn ghost" data-act="print-ex" data-id="${e.id}">Imprimer la liste</button><button class="btn w" data-act="edit-ex" data-id="${e.id}">Modifier l’examen / les candidats</button></footer>`);
}

/* ---- Catégorie ---- */
function formCat(c) {
  const isNew = !c; c = c || { ordre: (S.categories.length + 1), heuresCode: 0, heuresConduite: 0, tarif: 0 };
  openDlg(`<form id="frm-cat" class="form" data-id="${c.id || ''}">${dhead(isNew ? 'Nouvelle catégorie' : 'Catégorie ' + esc(c.code))}
    <div class="grid2">${inp('Code (ex. B, C1)', 'code', c.code, 'required maxlength="6" pattern="[A-Za-z0-9+]+"' + (isNew ? '' : ' readonly'))}${inp('Libellé', 'libelle', c.libelle, 'required')}
    ${inp('Âge minimum', 'ageMin', c.ageMin, 'min="0"', 'number')}${inp('Tarif de la formation (' + esc(cfg().devise) + ')', 'tarif', c.tarif, 'min="0" step="any"', 'number')}
    ${inp('Heures de code prévues', 'heuresCode', c.heuresCode, 'min="0"', 'number')}${inp('Heures de conduite prévues', 'heuresConduite', c.heuresConduite, 'min="0"', 'number')}
    ${inp('Ordre d’affichage', 'ordre', c.ordre, 'min="0"', 'number')}</div>
    ${area('Véhicules concernés', 'description', c.description)}
    ${footer('del-cat', isNew ? '' : c.id)}</form>`);
  const f = $('#frm-cat');
  f.addEventListener('submit', async e => { e.preventDefault(); const d = fd(f); const code = d.code.trim().toUpperCase(); const id = f.dataset.id || code.replace(/[^A-Z0-9]/g, '_');
    if (!f.dataset.id && S.categories.some(x => x.code === code)) { toast('Cette catégorie existe déjà.'); return; }
    const row = { ...d, code, ageMin: Number(d.ageMin) || 0, tarif: Number(d.tarif) || 0, heuresCode: Number(d.heuresCode) || 0, heuresConduite: Number(d.heuresConduite) || 0, ordre: Number(d.ordre) || 0 };
    try { await put('categories', id, row); toast('Catégorie enregistrée'); closeDlg(); } catch (e) {} });
}

/* ---- Moniteur ---- */
function formMon(m) {
  const isNew = !m; m = m || { actif: true }; let photo = m.photo || '';
  openDlg(`<form id="frm-mon" class="form" data-id="${m.id || ''}">${dhead(isNew ? 'Nouveau moniteur' : 'Moniteur')}
    <div class="row">${avatar(m)}<button type="button" class="btn ghost sm" id="btn-mphoto">Photo</button></div>
    <div class="grid2">${inp('Nom', 'nom', m.nom, 'required')}${inp('Prénom(s)', 'prenom', m.prenom, 'required')}
    ${inp('Téléphone', 'telephone', m.telephone, '', 'tel')}${inp('E-mail', 'email', m.email, '', 'email')}
    ${inp('Catégories enseignées (ex. B, C)', 'categories', m.categories)}${inp('N° d’autorisation d’enseigner', 'autorisation', m.autorisation)}
    ${inp('Fin de validité de l’autorisation', 'autorisationExp', m.autorisationExp, '', 'date')}${inp('Date d’embauche', 'embauche', m.embauche, '', 'date')}
    ${sel('Situation', 'actif', m.actif === false ? 'non' : 'oui', [['oui', 'Actif'], ['non', 'Inactif']])}</div>
    ${area('Notes', 'notes', m.notes)}
    ${footer('del-mon', isNew ? '' : m.id)}</form>`);
  const f = $('#frm-mon');
  $('#btn-mphoto').onclick = async () => { const file = await pickFile('image/*'); if (!file) return; try { photo = await resizeImage(file, 200); f.querySelector('.avatar').innerHTML = `<img src="${photo}" alt="">`; } catch (e) {} };
  f.addEventListener('submit', async e => { e.preventDefault(); const d = fd(f); const id = f.dataset.id || uid(); const old = S.moniteurs.find(x => x.id === id) || {};
    const row = { ...old, ...d, nom: d.nom.trim().toUpperCase(), prenom: d.prenom.trim(), actif: d.actif !== 'non', photo }; if (!photo) delete row.photo;
    try { await put('moniteurs', id, row); toast('Moniteur enregistré'); closeDlg(); } catch (e) {} });
}

/* ---- Véhicule ---- */
function formVeh(v) {
  const isNew = !v; v = v || { statut: 'dispo', categorie: 'B' };
  openDlg(`<form id="frm-veh" class="form" data-id="${v.id || ''}">${dhead(isNew ? 'Nouveau véhicule' : esc(vehLabel(v)))}
    <div class="grid2">${inp('Marque et modèle', 'modele', v.modele, 'required')}${inp('Immatriculation', 'immat', v.immat, 'required')}
    ${sel('Catégorie', 'categorie', v.categorie, catsSorted().map(c => [c.code, c.code]))}${sel('État', 'statut', v.statut, [['dispo', 'Disponible'], ['garage', 'Au garage'], ['panne', 'En panne']])}
    ${inp('Kilométrage actuel', 'km', v.km, 'min="0"', 'number')}${inp('Prochaine vidange à (km)', 'vidangeKm', v.vidangeKm, 'min="0"', 'number')}
    ${inp('Assurance valable jusqu’au', 'assuranceExp', v.assuranceExp, '', 'date')}${inp('Visite technique valable jusqu’au', 'visiteExp', v.visiteExp, '', 'date')}
    ${inp('Date de mise en circulation', 'miseCirculation', v.miseCirculation, '', 'date')}${sel('Boîte de vitesses', 'boite', v.boite, [['', '—'], ['manuelle', 'Manuelle'], ['auto', 'Automatique']])}</div>
    ${area('Notes (entretien, sinistres…)', 'notes', v.notes)}
    ${footer('del-veh', isNew ? '' : v.id)}</form>`);
  const f = $('#frm-veh');
  f.addEventListener('submit', async e => { e.preventDefault(); const d = fd(f); const id = f.dataset.id || uid(); const old = S.vehicules.find(x => x.id === id) || {};
    const row = { ...old, ...d, immat: d.immat.trim().toUpperCase(), km: Number(d.km) || 0, vidangeKm: Number(d.vidangeKm) || 0 };
    try { await put('vehicules', id, row); toast('Véhicule enregistré'); closeDlg(); } catch (e) {} });
}

/* ---- Dépense ---- */
function formDep(d) {
  const isNew = !d; d = d || { date: todayISO(), categorie: 'Carburant', mode: 'Espèces' };
  openDlg(`<form id="frm-dep" class="form" data-id="${d.id || ''}">${dhead(isNew ? 'Nouvelle dépense' : 'Dépense')}
    <div class="grid2">${inp('Date', 'date', d.date, 'required', 'date')}${inp('Montant (' + esc(cfg().devise) + ')', 'montant', d.montant, 'required min="0" step="any"', 'number')}
    ${sel('Catégorie', 'categorie', d.categorie, DEP_CATS.map(x => [x, x]))}${sel('Mode de paiement', 'mode', d.mode, MODES_PAY.map(x => [x, x]))}
    ${inp('Libellé', 'libelle', d.libelle, 'placeholder="ex. Plein d’essence, salaire d’octobre…"')}${inp('Véhicule concerné', 'vehicule', d.vehicule, 'list="dl-veh2" autocomplete="off"')}
    ${inp('Fournisseur / bénéficiaire', 'fournisseur', d.fournisseur)}${inp('N° de pièce / facture', 'piece', d.piece)}</div>
    <datalist id="dl-veh2">${allVehicules().map(m => `<option value="${esc(m)}">`).join('')}</datalist>
    ${footer('del-dep', isNew ? '' : d.id)}</form>`);
  const f = $('#frm-dep');
  f.addEventListener('submit', async e => { e.preventDefault(); const x = fd(f); const id = f.dataset.id || uid(); const old = S.depenses.find(y => y.id === id) || {};
    try { await put('depenses', id, { ...old, ...x, montant: Number(x.montant) || 0 }); toast('Dépense enregistrée'); closeDlg(); } catch (e) {} });
}

/* ---- Exports ---- */
function exportCSV(kind) {
  const t = todayISO(); let csv = '';
  if (kind === 'apprenants') csv = toCSV(['Dossier', 'Nom', 'Prénom', 'Sexe', 'Naissance', 'Téléphone', 'E-mail', 'Adresse', 'Pièce', 'Catégorie', 'Statut', 'Inscription', 'Permis obtenu', 'Coût', 'Payé', 'Reste', 'Heures conduite', 'Livret %'],
    S.apprenants.slice().sort(by('nom')).map(a => [a.dossier, a.nom, a.prenom, a.sexe, a.dateNaissance, a.telephone, a.email, a.adresse, a.piece, a.categorie, STATUTS[a.statut], a.dateInscription, a.datePermis, a.montantTotal, paye(a), reste(a), (minutesConduite(a) / 60).toFixed(1).replace('.', ','), livretPct(a)]));
  else if (kind === 'paiements') csv = toCSV(['Date', 'N° reçu', 'Dossier', 'Apprenant', 'Mode', 'Motif', 'Montant'], allPayments().sort(by('date')).map(p => [p.date, p.no, p.a.dossier, nomC(p.a), p.mode, p.motif, p.montant]));
  else if (kind === 'depenses') csv = toCSV(['Date', 'Catégorie', 'Libellé', 'Véhicule', 'Fournisseur', 'Pièce', 'Mode', 'Montant'], S.depenses.slice().sort(by('date')).map(d => [d.date, d.categorie, d.libelle, d.vehicule, d.fournisseur, d.piece, d.mode, d.montant]));
  else if (kind === 'seances') csv = toCSV(['Date', 'Heure', 'Durée (min)', 'Type', 'Apprenant', 'Groupe', 'Moniteur', 'Véhicule', 'Statut', 'Observations'], S.seances.slice().sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure)).map(s => [s.date, s.heure, s.duree, s.type, s.apprenantId ? nomC(appById(s.apprenantId)) : '', s.groupe, s.moniteur, s.vehicule, SEANCE_ST[s.statut], s.notes]));
  else if (kind === 'examens') csv = toCSV(['Date', 'Heure', 'Épreuve', 'Catégorie', 'Lieu', 'Candidat', 'Dossier', 'Résultat'], S.examens.slice().sort(by('date')).flatMap(e => (e.candidats || []).map(c => { const a = appById(c.id); return [e.date, e.heure, EXT[e.type], e.categorie, e.lieu, nomC(a), a?.dossier, RES[c.resultat]]; })));
  saveFile(`${kind}_${t}.csv`, csv, 'text/csv;charset=utf-8');
}
async function backup() {
  const d = snapshotState(); d.exportedAt = new Date().toISOString(); d.app = 'Gestion Auto-École';
  await saveFile(`sauvegarde_autoecole_${todayISO()}.json`, JSON.stringify(d, null, 1), 'application/json');
  try { await putConfig({ ...S.config, lastBackup: todayISO() }); } catch (e) {}
}
async function restore() {
  const f = await pickFile('.json,application/json'); if (!f) return;
  let d; try { d = JSON.parse(await readAsText(f)); } catch (e) { toast('Ce fichier n’est pas une sauvegarde valide.'); return; }
  if (!d || !Array.isArray(d.apprenants)) { toast('Ce fichier n’est pas une sauvegarde de l’application.'); return; }
  const n = COLS.reduce((t, c) => t + (d[c] || []).length, 0);
  openDlg(`${dhead('Restaurer la sauvegarde')}<p>Le fichier contient <b>${n}</b> élément(s)${d.exportedAt ? ', exporté le ' + fmtLong(d.exportedAt.slice(0, 10)) : ''}.</p><p class="warn-t">Toutes les données actuelles seront remplacées par celles de la sauvegarde.</p><footer class="df"><button class="btn ghost" data-act="close">Annuler</button><button class="btn danger" id="btn-restore">Remplacer mes données</button></footer>`);
  $('#btn-restore').onclick = async () => {
    $('#btn-restore').disabled = true; $('#btn-restore').textContent = 'Restauration…';
    if (!DB) { applyState({ ...d, config: { ...d.config, pinHash: S.config.pinHash } }); saveLocal(); scheduleRender(); closeDlg(); toast('Sauvegarde restaurée'); return; }
    try {
      for (const c of COLS) { for (const x of S[c].slice()) if (!(d[c] || []).some(y => y.id === x.id)) await del(c, x.id); for (const x of d[c] || []) await put(c, x.id, x); }
      if (d.config) await putConfig(d.config); closeDlg(); toast('Sauvegarde restaurée');
    } catch (e) { toast('Restauration interrompue. Réessayez.'); }
  };
}

/* ============ Événements ============ */
function armed(btn, label) { if (btn.dataset.armed) return true; btn.dataset.armed = '1'; btn.dataset.orig = btn.textContent; btn.textContent = label || 'Confirmer la suppression'; btn.classList.add('danger'); btn.classList.remove('ghost'); setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = btn.dataset.orig; btn.classList.remove('danger'); btn.classList.add('ghost'); } }, 4000); return false; }
const removeAct = (col, msg) => async (el, id) => { if (!armed(el)) return; try { await del(col, id); closeDlg(); toast(msg); } catch (e) {} };
const ACTIONS = {
  close: () => closeDlg(),
  go: (el, id) => { closeDlg(); location.hash = id; },
  install: async () => { if (!deferredInstall) return; deferredInstall.prompt(); try { await deferredInstall.userChoice; } catch (e) {} deferredInstall = null; scheduleRender(); },
  'new-app': () => formApprenant(),
  'open-app': (el, id) => { S.appTab = 'resume'; openApp(id); },
  apptab: (el, id) => { S.appTab = el.dataset.v; openApp(id); },
  'edit-app': (el, id) => formApprenant(appById(id)),
  'del-app': removeAct('apprenants', 'Dossier supprimé'),
  'del-pay': async (el, id) => { if (!armed(el, 'Confirmer')) return; const a = appById(id); if (!a) return; const p = (a.paiements || []).slice(); p.splice(Number(el.dataset.i), 1); const row = { ...a, paiements: p }; try { await put('apprenants', id, row); openApp(id, row); } catch (e) {} },
  recu: (el, id) => { const a = appById(id); if (a) docRecu(a, Number(el.dataset.i)); },
  fiche: (el, id) => docFiche(appById(id)), contrat: (el, id) => docContrat(appById(id)), attestation: (el, id) => docAttestation(appById(id)), releve: (el, id) => docReleve(appById(id)),
  'new-seance': el => formSeance(null, { date: el.dataset.date, app: el.dataset.app }),
  'edit-seance': (el, id) => { if (!S.ro) formSeance(S.seances.find(s => s.id === id)); },
  'del-seance': removeAct('seances', 'Séance supprimée'),
  wk: el => { S.week = el.dataset.n === '0' ? monday(todayISO()) : addDays(S.week, Number(el.dataset.n)); render(); },
  'print-week': () => docSemaine(),
  'new-ex': () => formExamen(), 'open-ex': (el, id) => openEx(id), 'edit-ex': (el, id) => formExamen(S.examens.find(x => x.id === id)),
  'del-ex': removeAct('examens', 'Examen supprimé'),
  'print-ex': (el, id) => docExamen(S.examens.find(x => x.id === id)),
  extab: el => { S.exTab = el.dataset.v; render(); },
  'new-cat': () => formCat(), 'edit-cat': (el, id) => { if (!S.ro) formCat(S.categories.find(c => c.id === id)); }, 'del-cat': removeAct('categories', 'Catégorie supprimée'),
  'install-cats': async el => { el.disabled = true; try { for (const c of CATS_DEFAUT) await put('categories', c.code, c); toast('Catégories installées'); } catch (e) { el.disabled = false; } },
  'new-mon': () => formMon(), 'edit-mon': (el, id) => { if (!S.ro) formMon(S.moniteurs.find(m => m.id === id)); }, 'del-mon': removeAct('moniteurs', 'Moniteur supprimé'),
  'new-veh': () => formVeh(), 'edit-veh': (el, id) => { if (!S.ro) formVeh(S.vehicules.find(v => v.id === id)); }, 'del-veh': removeAct('vehicules', 'Véhicule supprimé'),
  'new-dep': () => formDep(), 'edit-dep': (el, id) => { if (!S.ro) formDep(S.depenses.find(d => d.id === id)); }, 'del-dep': removeAct('depenses', 'Dépense supprimée'),
  csv: (el, id) => exportCSV(id), backup: () => backup(), restore: () => restore(),
  fam: el => { S.fam = el.dataset.v; render(); },
  'qz-start': () => { const mode = $('#qz-mode').value; Q = { etat: 'question', mode, app: $('#qz-app').value, i: 0, rep: [], sel: null, items: buildQuiz(mode) }; stopTimer(); if (mode === 'examen') { Q.end = Date.now() + 25 * 60 * 1000; qTimer = setInterval(tickTimer, 1000); } render(); tickTimer(); window.scrollTo(0, 0); },
  'qz-ans': el => { const k = Number(el.dataset.k); if (Q.mode === 'examen') { Q.sel = k; render(); tickTimer(); return; } if (Q.rep[Q.i] != null) return; Q.rep[Q.i] = k; render(); },
  'qz-valid': () => { if (Q.sel == null) return; Q.rep[Q.i] = Q.sel; Q.sel = null; if (Q.i + 1 < Q.items.length) { Q.i++; render(); tickTimer(); } else finishQuiz(); },
  'qz-next': () => { if (Q.i + 1 < Q.items.length) { Q.i++; render(); } else finishQuiz(); },
  'qz-again': () => { stopTimer(); Q = { ...Q, etat: 'config', items: [], i: 0, rep: [], sel: null }; render(); },
  'qz-quit': () => { stopTimer(); Q = { ...Q, etat: 'config', items: [], i: 0, rep: [], sel: null }; render(); },
  'purge-ex': async el => { if (!armed(el, 'Confirmer : tout supprimer')) return; el.disabled = true; try { for (const col of COLS) for (const x of S[col].filter(r => r.exemple)) await del(col, x.id); toast('Données d’exemple supprimées'); } catch (e) {} },
  logo: async () => { const f = await pickFile('image/*'); if (!f) return; try { const logo = await resizeImage(f, 320, 'image/png'); await putConfig({ ...S.config, logo }); toast('Logo enregistré'); } catch (e) { toast('Image illisible.'); } },
  'logo-del': async () => { const c = { ...S.config }; delete c.logo; try { await putConfig(c); } catch (e) {} },
  theme: el => { try { localStorage.setItem('ae-theme', el.dataset.v); } catch (e) {} applyTheme(); render(); },
  'pin-off': async el => { if (!armed(el, 'Confirmer')) return; const c = { ...S.config }; delete c.pinHash; await putConfig(c); toast('Code d’accès désactivé'); },
  'lock-now': () => showLock()
};
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]'); if (!el || el.closest('#lock')) return;
  const fn = ACTIONS[el.dataset.act]; if (fn) fn(el, el.dataset.id);
});
document.addEventListener('input', ev => { if (ev.target.id === 'q-app') { S.f.q = ev.target.value; render(); } });
document.addEventListener('change', async ev => {
  const t = ev.target;
  if (t.id === 'f-statut') { S.f.statut = t.value; render(); }
  else if (t.id === 'f-cat') { S.f.cat = t.value; render(); }
  else if (t.id === 'f-mon') { S.moniteur = t.value; render(); }
  else if (t.id === 'fin-year') { S.finYear = Number(t.value); render(); }
  else if (t.id === 'fin-month') { S.finMonth = Number(t.value); render(); }
  else if (t.id === 'rep-year') { S.repYear = Number(t.value); render(); }
  else if (t.id === 'qz-mode') Q.mode = t.value;
  else if (t.id === 'qz-app') Q.app = t.value;
  else if (t.dataset.actChange === 'livret') {
    const a = appById(t.dataset.app); if (!a) return; t.className = 'lv' + t.value;
    try { await put('apprenants', a.id, { ...a, livret: { ...(a.livret || {}), [t.dataset.k]: Number(t.value) } }); } catch (e) {}
  } else if (t.dataset.actChange === 'doc') {
    const a = appById(t.dataset.app); if (!a) return;
    try { await put('apprenants', a.id, { ...a, docs: { ...(a.docs || {}), [t.dataset.i]: t.checked } }); } catch (e) {}
  } else if (t.dataset.actChange === 'res') {
    const ex = S.examens.find(x => x.id === t.dataset.ex); if (!ex) return;
    const r = t.value, aid = t.dataset.app;
    const row = { ...ex, candidats: (ex.candidats || []).map(c => c.id === aid ? { ...c, resultat: r } : c) };
    try {
      await put('examens', ex.id, row);
      const a = appById(aid); let ns = null;
      if (a && r === 'admis') { if (ex.type === 'code' && ['inscrit', 'code', 'examen'].includes(a.statut)) ns = 'conduite'; if (ex.type === 'conduite' && a.statut !== 'diplome') ns = 'diplome'; }
      if (a && (r === 'ajourne' || r === 'absent') && a.statut === 'examen') ns = ex.type === 'code' ? 'code' : 'conduite';
      if (ns) { await put('apprenants', a.id, { ...a, statut: ns, ...(ns === 'diplome' ? { datePermis: ex.date } : {}) }); toast(`${nomC(a)} : ${STATUTS[ns]}`); }
      else toast('Résultat enregistré');
    } catch (e) {}
  }
});
document.addEventListener('submit', async ev => {
  if (ev.target.id === 'frm-cfg') {
    ev.preventDefault(); const d = fd(ev.target); const keep = ['nom', 'agrement', 'adresse', 'ville', 'telephone', 'email', 'nif', 'devise', 'directeur'];
    const c = { ...S.config }; keep.forEach(k => c[k] = (d[k] || '').trim()); c.nom = c.nom || 'Mon auto-école'; c.seuilCode = Math.min(40, Math.max(1, Number(d.seuilCode) || 35));
    try { await putConfig(c); toast('Paramètres enregistrés'); } catch (e) {}
  } else if (ev.target.id === 'frm-pin') {
    ev.preventDefault(); const p = $('#pin-new').value.trim(); if (p.length < 4) { toast('Le code doit comporter au moins 4 caractères.'); return; }
    await putConfig({ ...S.config, pinHash: await hashPin(p) }); toast('Code d’accès enregistré');
  }
});
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && dlg.open) closeDlg(); });

init();
