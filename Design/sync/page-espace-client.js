// Sommaire d'une page d'espace, tiré de l'inventaire (Design/inventaire-ecrans.json) et de l'état des étiquettes de chaque section d'écran.
// Les scripts prêts à coller sont générés dans Design/sync/ par Specs/_outils/inventaire_figma.py (page, lignes de la page).
const PAGE = "Espace client";
const INV = [["EC-01 · Connexion","Espace client","Compte","L2","P1","L2"],["EC-02 · Inscription","Espace client","Compte","L2","P1","L2"],["EC-03 · Vérification de l’adresse","Espace client","Compte","L2","P1","L2"],["EC-04 · Mot de passe oublié","Espace client","Compte","L2","P1","L2"],["EC-05 · Nouveau mot de passe","Espace client","Compte","L2","P1","L2"],["EC-06 · Activation","Espace client","Compte","L2","P1","L2"],["EC-07 · Connexion par lien","Espace client","Compte","L2","P1","L2"],["EC-08 · Code de double authentification","Espace client","Compte","L2","P1","L2"],["EC-09 · Nouvelles conditions","Espace client","Compte","L2","P1","L2"],["EC-10 · Tableau de bord","Espace client","Suivi et dossier","L2","P1","L2"],["EC-11 · Mon dossier : suivi, mon bien","Espace client","Suivi et dossier","L2 (Suivi) / L3 (Mon bien : bien retenu) / L4 (réservation, acompte, jalons)","P1","L2"],["EC-12 · Mes intérêts","Espace client","Biens et rendez-vous","L2 / L3 (« Je retiens ce bien »)","P1","L2"],["EC-13 · Biens proposés","Espace client","Biens et rendez-vous","L2 (vide) / L3","P1","L2"],["EC-14 · Rendez-vous","Espace client","Biens et rendez-vous","L3","P1","L3"],["EC-20 · Mes pièces","Espace client","Suivi et dossier","L2 (écran) / L4 (vrais dossiers, emprunteurs)","P1","L2"],["EC-21 · Déposer une pièce","Espace client","Suivi et dossier","L2 / L4","P1","L2"],["EC-22 · Financement","Espace client","Suivi et dossier","L4","P1","L4"],["EC-30 · Messages","Espace client","Messages","L5","P1","L5"],["EC-31 · Notifications","Espace client","Messages","L5","P1","L5"],["EC-40 · Mes simulations","Espace client","Outils et profil","L2","P1","L2"],["EC-41 · Favoris","Espace client","Outils et profil","L3","P1","L3"],["EC-42 · Alertes","Espace client","Outils et profil","L3","P1","L3"],["EC-43 · Mes Cafés","Espace client","Outils et profil","L5","P1","L5"],["EC-50 · Profil","Espace client","Outils et profil","L2","P1","L2"],["EC-51 · Sécurité","Espace client","Outils et profil","L2","P1","L2"],["EC-52 · Notifications","Espace client","Outils et profil","L5","P1","L5"],["EC-53 · Confidentialité","Espace client","Outils et profil","L2 (accords) / L5","P1","L2"],["EC-54 · Avis","Espace client","Outils et profil","L5","P1","L5"]]; // [section, page, famille, livraison, phase, première livraison, variantes]
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
