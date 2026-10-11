// Sommaire d'une page d'espace, tiré de l'inventaire (Design/inventaire-ecrans.json) et de l'état des étiquettes de chaque section d'écran.
// Les scripts prêts à coller sont générés dans Design/sync/ par Specs/_outils/inventaire_figma.py (page, lignes de la page).
const PAGE = "Back-office";
const INV = [["EA-00 · Connexion","Back-office","Socle et pilotage","L1","P1","L1"],["EA-01 · Tableau de bord","Back-office","Socle et pilotage","L5","P1","L5"],["EA-02 · Rapport « Activité commerciale »","Back-office","Socle et pilotage","L5","P1","L5"],["EA-03 à EA-05 · Rapports « Demandes et origines », « Dossiers », « Financement »","Back-office","Socle et pilotage","L5","P1","L5"],["EA-06, EA-07 · Rapports « Catalogue », « Satisfaction »","Back-office","Socle et pilotage","L5","P1","L5"],["EA-08 · Rapport « Cafés »","Back-office","Socle et pilotage","L5","P1","L5"],["EA-09 · Rapport « Équipe »","Back-office","Socle et pilotage","L5","P1","L5"],["EA-10 · Demandes","Back-office","Demandes et clients","L2 (lecture) / L3","P1","L2"],["EA-11 · Une demande","Back-office","Demandes et clients","L2 (lecture) / L3","P1","L2"],["EA-12 · Clients","Back-office","Demandes et clients","L3","P1","L3"],["EA-13 · Fiche d’un client","Back-office","Demandes et clients","L3","P1","L3"],["EA-20 · Pipeline","Back-office","Dossiers","L4","P1","L4"],["EA-21 · Tous les dossiers","Back-office","Dossiers","L3","P1","L3"],["EA-22 · Un dossier","Back-office","Dossiers","L3 (Aperçu, Biens, Échanges : chronologie et ajout rapide, Tâches, Historique, pause et clôture) / L4 (Pièces, Financement, Réservation, Emprunteurs) / L5 (Échanges : fil de messagerie)","P1","L3"],["EA-30 · Tâches","Back-office","Communication et organisation","L3","P1","L3"],["EA-31 · Agenda","Back-office","Communication et organisation","L3","P1","L3"],["EA-40, EA-41 · Programmes, un programme","Back-office","Catalogue et partenaires","L3 / L4 (Financement)","P1","L3"],["EA-42, EA-43 · Biens, un bien","Back-office","Catalogue et partenaires","L3 / L4 (Financement)","P1","L3"],["EA-44 · Médias","Back-office","Catalogue et partenaires","L3","P1","L3"],["EA-45 · Import de lots","Back-office","Catalogue et partenaires","L3","P1","L3"],["EA-46 · Mise en avant sur l’accueil","Back-office","Catalogue et partenaires","L3","P1","L3"],["EA-47 · Autres partenaires","Back-office","Catalogue et partenaires","L3","P1","L3"],["EA-50, EA-51 · Promoteurs, un promoteur","Back-office","Catalogue et partenaires","L3","P1","L3"],["EA-52, EA-53 · Banques, une banque","Back-office","Catalogue et partenaires","L4","P1","L4"],["EA-54 · Un produit bancaire","Back-office","Catalogue et partenaires","L4","P1","L4"],["EA-55, EA-56 · Soumissions, une soumission","Back-office","Financement et pièces","L4","P1","L4"],["EA-57 · Taux de change","Back-office","Financement et pièces","L4","P1","L4"],["EA-58 · Financement de référence","Back-office","Financement et pièces","L2","P1","L2"],["EA-59 · Projection","Back-office","Financement et pièces","L4","P1","L4"],["EA-60 · Pièces à vérifier","Back-office","Financement et pièces","L4","P1","L4"],["EA-61, EA-62 · Modèles de listes, un modèle","Back-office","Financement et pièces","L4","P1","L4"],["EA-63 · Visionneuse","Back-office","Financement et pièces","L4","P1","L4"],["EA-64 · Recherche de pièces","Back-office","Financement et pièces","L4","P1","L4"],["EA-70 · Messagerie","Back-office","Communication et organisation","L5","P1","L5"],["EA-71 · Journal des envois","Back-office","Communication et organisation","L5","P1","L5"],["EA-72, EA-73 · Modèles d’e-mail, éditeur","Back-office","Communication et organisation","L5","P1","L5"],["EA-74, EA-75 · Automatisations, une règle","Back-office","Communication et organisation","L5","P1","L5"],["EA-76 · Envoi groupé","Back-office","Communication et organisation","L5","P1","L5"],["EA-80, EA-81 · Cafés, un Café","Back-office","Café, satisfaction, contenus","L5","P1","L5"],["EA-82 · Pointage","Back-office","Café, satisfaction, contenus","L5","P1","L5"],["EA-85 · Retours","Back-office","Café, satisfaction, contenus","L5","P1","L5"],["EA-86 · Enquêtes","Back-office","Café, satisfaction, contenus","L5","P1","L5"],["EA-90 · Textes du site","Back-office","Café, satisfaction, contenus","L5","P1","L5"],["EA-91 à EA-95 · Pages, questions fréquentes, témoignages, textes légaux, redirections","Back-office","Café, satisfaction, contenus","L5","P1","L5"],["EA-96 · Équipe","Back-office","Administration","L1 (liste, invitation, rôle, fonction, suspension, double authentification) / L3 (« Reçoit des demandes », absence) / L5 (suppression, réaffectation, changement d’adresse)","P1","L1"],["EA-97 · Paramètres","Back-office","Administration","L5","P1","L5"],["EA-98 · Référentiels","Back-office","Administration","L5","P1","L5"],["EA-99 · Journal d’audit","Back-office","Administration","L5","P1","L5"],["EA-100 · Données personnelles","Back-office","Administration","L5","P1","L5"],["EA-101 · Corbeille","Back-office","Administration","L5","P1","L5"],["EA-102 · Diagnostic","Back-office","Administration","L1 (minimal) / L5","P1","L1"],["EA-103 · Imports et exports","Back-office","Administration","L5","P1","L5"],["EA-104 · Mes préférences","Back-office","Socle et pilotage","L1 (Profil, Sécurité) / L3 (Signature, Absence) / L5 (Notifications)","P1","L1"],["EA-105 · Notifications","Back-office","Socle et pilotage","L3 (dont « une opération, une notification », NOT-035) / L5 (regroupement par compteur NOT-016, préférences)","P1","L3"],["EA-106 · Recherche globale","Back-office","Socle et pilotage","L3","P1","L3"]]; // [section, page, famille, livraison, phase, première livraison, variantes]
const page = figma.root.children.find(p => p.name === PAGE);
await figma.setCurrentPageAsync(page);
for (const st of ['Regular', 'Medium', 'SemiBold', 'Bold']) await figma.loadFontAsync({ family: 'Red Hat Display', style: st });
await figma.loadFontAsync({ family: 'Playfair Display', style: 'Bold Italic' });
const TS = {}; for (const s of await figma.getLocalTextStylesAsync()) TS[s.name] = s;
const col = await figma.variables.getVariableCollectionByIdAsync('VariableCollectionId:288:2');
const VV = {}; for (const id of col.variableIds) { const v = await figma.variables.getVariableByIdAsync(id); VV[v.name] = v; }
const P = nm => { const v = VV['bo/' + nm]; const c = v.valuesByMode[col.modes[0].modeId]; return figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: c.r, g: c.g, b: c.b } }, 'color', v); };
const tag = await figma.getNodeByIdAsync('381:389');
const TONE = { 'À maquetter': 'Neutral', 'En cours': 'Info', 'À valider': 'Pending', 'Validé': 'Success' };
// sections d'écran présentes
const secs = {};
for (const fam of page.children.filter(n => n.type === 'SECTION')) for (const s of fam.children.filter(n => n.type === 'SECTION')) secs[s.name] = s;
const stateOf = (s) => {
  if (!s) return 'À maquetter';
  const labs = s.findAll(n => n.type === 'INSTANCE' && n.name.startsWith('Étiquette') && !!n.componentProperties.Status);
  const st = labs.map(l => { try { return l.componentProperties.Status.value; } catch (e) { return 'À maquetter'; } });
  if (!st.length || st.every(x => x === 'À maquetter')) return 'À maquetter';
  if (st.every(x => x === 'Validé')) return 'Validé';
  if (st.some(x => x === 'À valider')) return 'À valider';
  return 'En cours';
};
const famOrder = page.children.filter(n => n.type === 'SECTION').sort((a, b) => a.y - b.y).map(n => n.name);
const rows = INV.filter(r => r[1] === PAGE).map((r, i) => [r, i]).sort((a, b) => (famOrder.indexOf(a[0][2]) - famOrder.indexOf(b[0][2])) || (a[1] - b[1])).map(x => x[0]);
const old = page.children.find(n => n.type === 'FRAME' && n.name.startsWith('Sommaire'));
if (old) old.remove();
const T = async (parent, chars, style, color, w) => { const t = figma.createText(); await t.setTextStyleIdAsync(TS[style].id); t.characters = chars; t.fills = [P(color)]; parent.appendChild(t); if (w) { t.textAutoResize = 'HEIGHT'; t.resize(w, t.height); } return t; };
const AL = (dir, name, gap, pad) => { const f = figma.createAutoLayout(dir, { name }); f.fills = []; f.itemSpacing = gap || 0; if (pad !== undefined) { const p = Array.isArray(pad) ? pad : [pad, pad, pad, pad]; f.paddingTop = p[0]; f.paddingRight = p[1]; f.paddingBottom = p[2]; f.paddingLeft = p[3]; } return f; };
const board = AL('VERTICAL', 'Sommaire · ' + PAGE, 24, 56); page.appendChild(board); board.fills = [P('fond/blanc')]; board.cornerRadius = 30; board.strokes = [P('ligne/bleue')]; board.strokeWeight = 1;
const counts = {}; const states = rows.map(r => stateOf(secs[r[0]])); states.forEach(s => counts[s] = (counts[s] || 0) + 1);
await T(board, PAGE, 'Vitrine/title.section', 'texte/roi');
await T(board, rows.length + ' écrans · ' + ['Validé', 'À valider', 'En cours', 'À maquetter'].filter(k => counts[k]).map(k => counts[k] + ' ' + k.toLowerCase()).join(' · ') + '. Source : Specs/07-design/02-inventaire-des-ecrans.md — une ligne = une section, rangée dans la section de sa famille. Cliquez un identifiant pour aller à l’écran.', 'Outil/admin.body', 'texte/doux', 1480);
const table = AL('VERTICAL', 'Tableau', 0); board.appendChild(table); table.layoutSizingHorizontal = 'HUG';
const W = [150, 520, 420, 120, 160];
const row = async (cells, head, secNode, state) => {
  const r = AL('HORIZONTAL', head ? 'En-tête' : 'Ligne · ' + cells[0], 16, [12, 16, 12, 16]); table.appendChild(r); r.counterAxisAlignItems = 'CENTER';
  r.strokes = [P('ligne/douce')]; r.strokeWeight = 1; r.strokeTopWeight = 0; r.strokeLeftWeight = 0; r.strokeRightWeight = 0; r.strokeBottomWeight = 1;
  if (head) r.fills = [P('fond/gris')];
  for (let i = 0; i < 4; i++) { const t = await T(r, cells[i], head ? 'Outil/admin.caption' : (i === 0 ? 'Outil/admin.strong' : 'Outil/admin.body'), head ? 'texte/doux' : (i === 0 ? 'texte/roi' : 'texte/encre'), W[i]); if (i === 0 && secNode) { t.setRangeHyperlink(0, t.characters.length, { type: 'NODE', value: secNode.id }); t.textDecoration = 'UNDERLINE'; } }
  if (head) await T(r, 'État', 'Outil/admin.caption', 'texte/doux', W[4]);
  else { const it = tag.children.find(v => v.name === 'Tone=' + TONE[state]).createInstance(); r.appendChild(it); it.setProperties({ 'Label#381:214': state }); }
};
await row(['Écran', 'Nom', 'Livraison', 'Phase'], true);
let lastArea = null;
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  if (r[2] !== lastArea) { lastArea = r[2]; const g = AL('HORIZONTAL', 'Famille · ' + r[2], 0, [20, 16, 8, 16]); table.appendChild(g); await T(g, r[2].toUpperCase(), 'Vitrine/overline.s', 'texte/or'); }
  const id = r[0].split(' · ')[0], nm = r[0].split(' · ').slice(1).join(' · ');
  await row([id, nm, r[3], r[4]], false, secs[r[0]], states[i]);
}
board.x = -(board.width + 400); board.y = 0;
return { page: PAGE, rows: rows.length, counts, missing: rows.filter(r => !secs[r[0]]).map(r => r[0]) };
