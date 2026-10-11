// Index de tous les écrans, sur la page Couverture : une ligne par ligne de l'inventaire, avec sa page, son état et un lien vers sa section.
// Généré par Specs/_outils/inventaire_figma.py (__INV__ et __PAGES__ remplacés). À relancer après chaque séance de maquettes.
const INV = __INV__;
const PAGES = __PAGES__; // [section, page, famille, livraison, phase, première livraison, variantes] dans INV
const cover = figma.root.children.find(p => p.name === 'Couverture');
await figma.setCurrentPageAsync(cover);
for (const st of ['Regular', 'Medium', 'SemiBold', 'Bold']) await figma.loadFontAsync({ family: 'Red Hat Display', style: st });
await figma.loadFontAsync({ family: 'Playfair Display', style: 'Bold Italic' });
const TS = {}; for (const s of await figma.getLocalTextStylesAsync()) TS[s.name] = s;
const col = await figma.variables.getVariableCollectionByIdAsync('VariableCollectionId:288:2');
const VV = {}; for (const id of col.variableIds) { const v = await figma.variables.getVariableByIdAsync(id); VV[v.name] = v; }
const P = nm => { const v = VV['bo/' + nm]; const c = v.valuesByMode[col.modes[0].modeId]; return figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: c.r, g: c.g, b: c.b } }, 'color', v); };
const tag = await figma.getNodeByIdAsync('381:389');
const TONE = { 'À maquetter': 'Neutral', 'En cours': 'Info', 'À valider': 'Pending', 'Validé': 'Success', 'Hors Phase 1': 'Inactive' };
const secs = {};
for (const name of PAGES) { const pg = figma.root.children.find(p => p.name === name); if (!pg) continue; await pg.loadAsync(); for (const a of pg.children.filter(n => n.type === 'SECTION')) for (const s of a.children.filter(n => n.type === 'SECTION')) secs[s.name] = s; }
const stateOf = (r) => {
  if (r[5] === 'V2') return 'Hors Phase 1';
  const s = secs[r[0]]; if (!s) return 'À maquetter';
  const st = s.findAll(n => n.type === 'INSTANCE' && n.name.startsWith('Étiquette') && !!n.componentProperties.Status).map(l => { try { return l.componentProperties.Status.value; } catch (e) { return 'À maquetter'; } });
  if (!st.length || st.every(x => x === 'À maquetter')) return 'À maquetter';
  if (st.every(x => x === 'Validé')) return 'Validé';
  if (st.some(x => x === 'À valider')) return 'À valider';
  return 'En cours';
};
const T = async (parent, chars, style, color, w) => { const t = figma.createText(); await t.setTextStyleIdAsync(TS[style].id); t.characters = chars; t.fills = [P(color)]; parent.appendChild(t); if (w) { t.textAutoResize = 'HEIGHT'; t.resize(w, t.height); } return t; };
const AL = (dir, name, gap, pad) => { const f = figma.createAutoLayout(dir, { name }); f.fills = []; f.itemSpacing = gap || 0; if (pad !== undefined) { const p = Array.isArray(pad) ? pad : [pad, pad, pad, pad]; f.paddingTop = p[0]; f.paddingRight = p[1]; f.paddingBottom = p[2]; f.paddingLeft = p[3]; } return f; };
const old = cover.children.find(n => n.type === 'FRAME' && n.name === 'Index des écrans'); const keepY = old ? old.y : null; if (old) old.remove();
const board = AL('VERTICAL', 'Index des écrans', 24, 56); cover.appendChild(board); board.fills = [P('fond/blanc')]; board.cornerRadius = 30; board.strokes = [P('ligne/bleue')]; board.strokeWeight = 1;
const states = INV.map(stateOf); const counts = {}; states.forEach(s => counts[s] = (counts[s] || 0) + 1);
await T(board, 'Index des écrans', 'Vitrine/title.section', 'texte/roi');
await T(board, INV.length + ' lignes d’inventaire · ' + ['Validé', 'À valider', 'En cours', 'À maquetter', 'Hors Phase 1'].filter(k => counts[k]).map(k => counts[k] + ' ' + k.toLowerCase()).join(' · ') + '. Une ligne de Specs/07-design/02 = une section Figma, sur la page de son espace, dans la section de sa famille. Cliquez un identifiant pour aller à l’écran. Tenu à jour par Specs/_outils/inventaire_figma.py et Design/sync/.', 'Outil/admin.body', 'texte/doux', 1480);
const table = AL('VERTICAL', 'Tableau', 0); board.appendChild(table);
const W = [150, 480, 300, 360, 160];
const line = async (cells, head, sec, state) => {
  const r = AL('HORIZONTAL', head ? 'En-tête' : 'Ligne · ' + cells[0], 16, [10, 16, 10, 16]); table.appendChild(r); r.counterAxisAlignItems = 'CENTER';
  r.strokes = [P('ligne/douce')]; r.strokeWeight = 1; r.strokeTopWeight = 0; r.strokeLeftWeight = 0; r.strokeRightWeight = 0; r.strokeBottomWeight = 1; if (head) r.fills = [P('fond/gris')];
  for (let i = 0; i < 4; i++) { const t = await T(r, cells[i], head ? 'Outil/admin.caption' : (i === 0 ? 'Outil/admin.strong' : 'Outil/admin.body'), head ? 'texte/doux' : (i === 0 ? 'texte/roi' : 'texte/encre'), W[i]); if (i === 0 && sec) { t.setRangeHyperlink(0, t.characters.length, { type: 'NODE', value: sec.id }); t.textDecoration = 'UNDERLINE'; } }
  if (head) await T(r, 'État', 'Outil/admin.caption', 'texte/doux', W[4]);
  else { const it = tag.children.find(v => v.name === 'Tone=' + TONE[state]).createInstance(); r.appendChild(it); it.setProperties({ 'Label#381:214': state }); }
};
await line(['Écran', 'Nom', 'Famille', 'Livraison'], true);
for (const g of PAGES) {
  const rs = INV.map((r, i) => [r, states[i]]).filter(([r]) => r[1] === g);
  const h = AL('HORIZONTAL', 'Groupe · ' + g, 0, [22, 16, 8, 16]); table.appendChild(h); await T(h, g.toUpperCase() + (rs.length ? '' : ' — à maquetter avec sa phase (accès des partenaires, 00-cadre/06)'), 'Vitrine/overline.s', 'texte/or');
  for (const [r, st] of rs) await line([r[0].split(' · ')[0], r[0].split(' · ').slice(1).join(' · '), r[2], r[3]], false, secs[r[0]], st);
}
const others = cover.children.filter(n => n !== board);
board.x = 0; board.y = keepY !== null ? keepY : Math.max(...others.map(n => n.y + n.height)) + 160;
return { rows: INV.length, counts };
