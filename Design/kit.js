// ===== KIT Diaspora Patrimoine — coller en tête de chaque appel use_figma, après avoir défini PAGE_NAME =====
const page = figma.root.children.find(p => p.name === PAGE_NAME);
await figma.setCurrentPageAsync(page);
const col = await figma.variables.getVariableCollectionByIdAsync('VariableCollectionId:288:2');
const mcol = await figma.variables.getVariableCollectionByIdAsync('VariableCollectionId:372:265');
const icol = await figma.variables.getVariableCollectionByIdAsync('VariableCollectionId:388:2');
const V = {};
for (const c of [col, mcol]) for (const id of c.variableIds) { const v = await figma.variables.getVariableByIdAsync(id); V[v.name] = v; }
const M0 = col.modes[0].modeId;
const P = name => { const v = V['bo/' + name]; if (!v) throw new Error('couleur inconnue ' + name); const c = v.valuesByMode[M0]; return figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: c.r, g: c.g, b: c.b } }, 'color', v); };
const setP = (n, prop, c) => { const a = Array.isArray(c) ? c : [c]; n[prop] = [P(a[0])]; if (a[1] !== undefined) n[prop] = n[prop].map(f => ({ ...f, opacity: a[1] })); };
const TS = {}; for (const s of await figma.getLocalTextStylesAsync()) TS[s.name] = s;
const ES = {}; for (const s of await figma.getLocalEffectStylesAsync()) ES[s.name] = s;
const PS = {}; for (const s of await figma.getLocalPaintStylesAsync()) PS[s.name] = s;
await Promise.all([['Playfair Display','Bold Italic'],['Playfair Display','Regular'],['Red Hat Display','Regular'],['Red Hat Display','Medium'],['Red Hat Display','SemiBold'],['Red Hat Display','Bold'],['Cinzel','Bold']].map(([family, style]) => figma.loadFontAsync({ family, style })));
const RAD = { 4: 'rayon/s', 8: 'rayon/outil', 12: 'rayon/m', 22: 'rayon/l', 30: 'rayon/xl', 999: 'rayon/pilule' };
const SW = { 1: 'trait/fin', 1.5: 'trait/moyen', 3: 'trait/cerne' };
const IM = { Clair: '388:0', Sombre: '388:1', Champagne: '388:2', OrFonce: '388:3', Encre: '388:4' };
const IC = { Building:'289:109', Coins:'289:117', Coffee:'289:123', Bulb:'289:129', Partners:'289:137', Diamond:'289:142', Bank:'289:147', Crescent:'289:151', ChevronRight:'289:154', ArrowRight:'289:157', Key:'289:162', Medal:'289:167', Sparkles:'289:171', Sofa:'289:177', Scale:'289:181', Tree:'289:186', Search:'289:191', Sliders:'289:196', Chat:'289:200', Badge:'289:204', Folder:'289:210', Calculator:'289:215', Calendar:'289:220', Check:'289:223', Home:'289:228', Phone:'289:231', Clock:'289:235', Globe:'289:239', Pin:'289:243', Mail:'289:247', Heart:'289:250', Close:'377:4', ChevronDown:'377:7', ChevronUp:'377:10', ChevronLeft:'377:13', ArrowLeft:'377:16', Plus:'377:19', Minus:'377:22', Menu:'377:26', More:'377:29', Eye:'377:33', EyeOff:'377:37', Info:'377:42', Warning:'377:47', Error:'377:52', Success:'377:56', Upload:'377:60', Download:'377:64', Trash:'377:68', Edit:'377:72', Bell:'377:76', User:'377:80', Lock:'377:84', ExternalLink:'377:88', Paperclip:'377:91', Send:'377:95', Star:'377:98', Spinner:'377:102', Copy:'377:106', Logout:'377:110', Camera:'377:114', File:'377:118', Shield:'377:122', Bed:'377:126', Surface:'377:130', StatusInfo:'391:468', StatusSuccess:'391:474', StatusWarning:'391:479', StatusError:'391:485', France:'289:251', Algeria:'289:255', Speaker:'531:30260', Mic:'531:30268', Pause:'531:30275', Play:'531:30281' };
const sp = (n, f, v) => { const va = V['espace/' + v]; if (va) n.setBoundVariable(f, va); else n[f] = v; };
const rad = (n, r) => { if (RAD[r]) for (const k of ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius']) n.setBoundVariable(k, V[RAD[r]]); else n.cornerRadius = r; };
const cache = {}; const getC = async id => cache[id] || (cache[id] = await figma.getNodeByIdAsync(id));
const IDS = {};
const IMG = { facade: '2c751e296adc079c02f7e585a79f5eb32ef76407', sejour: '4f05f728f37cb8173b9f1b4c99f317310c1e0d29', terrasse: 'ca97f783bcf039298d4bd04dfcafbcc7fcf54d97', quartier: '5e09e81af5eedd40ab34c204a7d470cb334ab437', tasse: 'fa1b9ef0202404f94164eaf06e767336b5d0710e', cafe: 'b58fc8b8f118bb65f23fad21b341b1bb147febe3' }; // empreintes d'images (figma-ledger.json)
// B(parent, spec) — cadre {f, d:'H'|'V', gap, pad, fill, r, stroke, sw, sides:'TBLR', dash, shadow:'s'|'m'|'l'|'xl', style (dégradé), w, h, fillW, fillH, main, cross, wrap, rowGap, clip, img, mode, abs, x, y, op, id, c:[…]}
//   texte {t, s:'Outil/admin.body', col:'texte/encre', fillW, w, align, lines, deco} · icône {ic:'Home', size, mode} · instance {i:'id', p:{…}, name, w, h, fillW, fillH, mode, ov: async n => …} · ellipse {e:'nom', w, h, fill}
const B = async (parent, s) => {
  let n; const inAL = parent.layoutMode && parent.layoutMode !== 'NONE' && !s.abs;
  if (s.t !== undefined) {
    n = figma.createText(); await n.setTextStyleIdAsync(TS[s.s].id); n.characters = s.t; setP(n, 'fills', s.col || 'texte/encre');
    if (s.name) n.name = s.name; if (s.align) n.textAlignHorizontal = s.align; if (s.deco) n.textDecoration = s.deco;
    parent.appendChild(n); if (s.abs && parent.layoutMode && parent.layoutMode !== 'NONE') n.layoutPositioning = 'ABSOLUTE';
    if (s.fillW && inAL) { n.textAutoResize = 'HEIGHT'; n.layoutSizingHorizontal = 'FILL'; } else if (s.w) { n.textAutoResize = 'HEIGHT'; n.resize(s.w, n.height); }
    if (s.lines) { n.textTruncation = 'ENDING'; n.maxLines = s.lines; }
    if (s.hl) { n.setRangeFills(s.hl[0], s.hl[1], [P(s.hl[2] || 'texte/roi')]); }
  } else if (s.ic !== undefined) {
    n = (await getC(IC[s.ic])).createInstance(); n.name = s.name || ('Icône · ' + s.ic); parent.appendChild(n); if (s.abs && parent.layoutMode && parent.layoutMode !== 'NONE') n.layoutPositioning = 'ABSOLUTE';
    n.rescale((s.size || 20) / n.width); if (s.mode) n.setExplicitVariableModeForCollection(icol, IM[s.mode]);
  } else if (s.i !== undefined) {
    const c = await getC(s.i); n = (c.type === 'COMPONENT_SET' ? c.defaultVariant : c).createInstance();
    if (s.p) { const v = {}, o = {}; for (const k in s.p) (k.includes('#') ? o : v)[k] = s.p[k]; if (Object.keys(v).length) n.setProperties(v); if (Object.keys(o).length) n.setProperties(o); }
    if (s.name) n.name = s.name; parent.appendChild(n); if (s.abs && parent.layoutMode && parent.layoutMode !== 'NONE') n.layoutPositioning = 'ABSOLUTE';
    if (s.mode) n.setExplicitVariableModeForCollection(icol, IM[s.mode]);
    if (s.w !== undefined || s.h !== undefined) n.resize(s.w ?? n.width, s.h ?? n.height);
    if (s.fillW && inAL) n.layoutSizingHorizontal = 'FILL'; if (s.fillH && inAL) n.layoutSizingVertical = 'FILL';
    if (s.scale) n.rescale(s.scale);
    if (s.err) { const k = Object.keys(n.componentProperties).find(x => x.startsWith('Error message')); if (k) n.setProperties({ [k]: s.err }); }
    if (s.ov) await s.ov(n);
  } else {
    n = s.e !== undefined ? figma.createEllipse() : figma.createFrame(); n.name = s.e !== undefined ? s.e : (s.f || 'Bloc'); n.fills = [];
    if (s.img) n.fills = [typeof s.img === 'string' ? { type: 'IMAGE', imageHash: s.img, scaleMode: 'FILL' } : s.img]; else if (s.grad) n.fills = s.grad; else if (s.fill) setP(n, 'fills', s.fill);
    if (s.e === undefined) n.clipsContent = !!s.clip;
    if (s.d) { n.layoutMode = s.d === 'H' ? 'HORIZONTAL' : 'VERTICAL'; sp(n, 'itemSpacing', s.gap || 0);
      const p = s.pad === undefined ? [0,0,0,0] : typeof s.pad === 'number' ? [s.pad,s.pad,s.pad,s.pad] : s.pad.length === 2 ? [s.pad[0],s.pad[1],s.pad[0],s.pad[1]] : s.pad;
      sp(n,'paddingTop',p[0]); sp(n,'paddingRight',p[1]); sp(n,'paddingBottom',p[2]); sp(n,'paddingLeft',p[3]);
      if (s.main) n.primaryAxisAlignItems = s.main; if (s.cross) n.counterAxisAlignItems = s.cross;
      if (s.wrap) { n.layoutWrap = 'WRAP'; sp(n, 'counterAxisSpacing', s.rowGap ?? s.gap ?? 0); } }
    if (s.r !== undefined) rad(n, s.r);
    if (s.stroke) { setP(n, 'strokes', s.stroke); n.strokeAlign = 'INSIDE'; const w = s.sw ?? 1;
      if (s.sides) { n.strokeWeight = w; n.strokeTopWeight = s.sides.includes('T') ? w : 0; n.strokeBottomWeight = s.sides.includes('B') ? w : 0; n.strokeLeftWeight = s.sides.includes('L') ? w : 0; n.strokeRightWeight = s.sides.includes('R') ? w : 0; }
      else if (SW[w]) n.setBoundVariable('strokeWeight', V[SW[w]]); else n.strokeWeight = w; if (s.dash) n.dashPattern = s.dash; }
    if (s.style) await n.setFillStyleIdAsync(PS[s.style].id);
    if (s.shadow) await n.setEffectStyleIdAsync(ES['Ombre/' + s.shadow].id);
    if (s.mode) n.setExplicitVariableModeForCollection(icol, IM[s.mode]);
    parent.appendChild(n); if (s.abs && parent.layoutMode && parent.layoutMode !== 'NONE') n.layoutPositioning = 'ABSOLUTE';
    if (s.w !== undefined || s.h !== undefined) n.resize(s.w ?? n.width, s.h ?? n.height);
    if (s.d) { n.layoutSizingHorizontal = (s.fillW && inAL) ? 'FILL' : (s.w !== undefined ? 'FIXED' : 'HUG'); n.layoutSizingVertical = (s.fillH && inAL) ? 'FILL' : (s.h !== undefined ? 'FIXED' : 'HUG'); }
    else { if (s.fillW && inAL) n.layoutSizingHorizontal = 'FILL'; if (s.fillH && inAL) n.layoutSizingVertical = 'FILL'; }
    if (s.c) for (const ch of s.c) if (ch) await B(n, ch);
  }
  if (s.abs) { n.x = s.abs.x; n.y = s.abs.y; }
  if (s.x !== undefined) n.x = s.x; if (s.y !== undefined) n.y = s.y; if (s.op !== undefined) n.opacity = s.op;
  if (s.id) IDS[s.id] = n.id;
  return n;
};
// ---------- sections, étiquettes, rangement
const som = page.children.find(n => n.name.startsWith('Sommaire'));
const secFor_ancien = (name) => { let s = page.children.find(n => n.type === 'SECTION' && n.name === name); if (s) return s; const ys = page.children.filter(n => n.type === 'SECTION').map(n => n.y + n.height); const y = Math.max(som ? som.y + som.height + 40 : 0, ...ys) + 200; s = figma.createSection(); s.name = name; page.appendChild(s); s.x = 0; s.y = y; s.resizeWithoutConstraints(400, 400); return s; };
const label = async (sec, frame, id, name, fmt, status) => { const lab = await getC('404:260'); const inst = lab.defaultVariant.createInstance(); sec.appendChild(inst); inst.setProperties({ Status: status || 'À valider' }); inst.setProperties({ 'ID#404:0': id, 'Name#404:5': name, 'Format#404:10': fmt || '1 440' }); inst.name = 'Étiquette · ' + id + ' · ' + name; inst.x = frame.x; inst.y = frame.y - 66; return inst; };
const cleanWhite = (root) => { for (const n of root.findAll(n => n.type === 'FRAME' && n.fills.length === 1 && n.fills[0].type === 'SOLID' && !(n.fills[0].boundVariables && n.fills[0].boundVariables.color) && n.fills[0].color.r === 1 && n.fills[0].color.g === 1 && n.fills[0].color.b === 1)) n.fills = []; };
// Rangement (07-design/02, § 1) : une page = des rangées de familles ; dans une famille, les écrans de gauche à droite ;
// dans un écran, les variantes l'une sous l'autre. screenSec('EC-10 · Tableau de bord') trouve la section d'écran (dans sa famille).
const isLabel = n => n.type === 'INSTANCE' && n.name.startsWith('Étiquette') && n.componentProperties && !!n.componentProperties.Status;
const screenSec = (name) => { for (const f of page.children.filter(n => n.type === 'SECTION')) { const s = f.children.find(n => n.type === 'SECTION' && n.name === name); if (s) return s; } throw new Error('Section introuvable : ' + name); };
const reflowFamily = (fam) => { const screens = fam.children.filter(n => n.type === 'SECTION').sort((a, b) => a.x - b.x); let x = 120, h = 0; for (const s of screens) { s.x = x; s.y = 140; x += s.width + 160; h = Math.max(h, s.height); } fam.resizeWithoutConstraints(Math.max(x - 40, 1200), h + 260); const fams = page.children.filter(n => n.type === 'SECTION').sort((a, b) => a.y - b.y); let fy = 0; for (const f of fams) { f.x = 0; f.y = fy; fy += f.height + 300; } };
// place(section d'écran ou nom, cadre, 'EA-96', 'Équipe · liste', '1 440' | '390') : sous le dernier cadre de la section ; retire le texte « À maquetter » à la première variante.
const place = async (secOrName, frame, id, name, fmt) => {
  const sec = typeof secOrName === 'string' ? screenSec(secOrName) : secOrName;
  cleanWhite(frame);
  const ph = sec.children.find(n => n.type === 'TEXT' && n.name === 'Variantes à maquetter'); if (ph) { ph.remove(); for (const l of sec.children.filter(isLabel)) if (l.componentProperties.Status.value === 'À maquetter') l.remove(); }
  const frames = sec.children.filter(n => n.type === 'FRAME' && n.width >= 400);
  const y = frames.length ? Math.max(...frames.map(n => n.y + n.height)) + 200 + 66 : 186;
  sec.appendChild(frame); frame.x = 120; frame.y = y; await label(sec, frame, id, name, fmt);
  const kids = sec.children; sec.resizeWithoutConstraints(Math.max(...kids.map(n => n.x + n.width)) + 120, Math.max(...kids.map(n => n.y + n.height)) + 120);
  reflowFamily(sec.parent); return frame; };
// ---------- éléments communs
const btn = (t, type, size, extra) => ({ i: '381:315', p: Object.assign({ Type: type || 'Primary', Size: size || 'M', 'Label#381:0': t }, (type === 'Tool' || type === 'Tertiary' || type === 'Danger') ? { 'Chevron#381:93': false } : {}, extra || {}), name: 'Bouton · ' + t });
const btnIc = (t, type, size, ic) => btn(t, type, size, { 'Icon left#381:31': true, 'Icon#381:62': IC[ic], 'Chevron#381:93': false });
const field = (lab, val, st, extra) => ({ i: '390:611', p: Object.assign({ State: st || (val ? 'Filled' : 'Default'), Shape: 'Field', 'Label#390:0': lab, 'Value#390:11': val || '' }, extra || {}), name: 'Champ · ' + lab, fillW: true });
const select = (lab, val, st) => ({ i: '390:685', p: { State: st || 'Filled', 'Label#390:121': lab, 'Value#390:127': val }, name: 'Liste · ' + lab, fillW: true });
const textarea = (lab, val, st) => ({ i: '390:798', p: { State: st || (val ? 'Filled' : 'Default'), 'Label#390:175': lab, 'Value#390:181': val || '' }, name: 'Zone de texte · ' + lab, fillW: true });
const check = (t, on, st) => ({ i: '390:850', p: { Checked: on ? 'True' : 'False', State: st || 'Default', 'Label#390:205': t }, name: 'Case · ' + t });
const radio = (t, on) => ({ i: '390:881', p: { Selected: on ? 'True' : 'False', State: 'Default', 'Label#390:214': t }, name: 'Bouton radio · ' + t });
const toggle = (on, t) => ({ i: '390:898', p: Object.assign({ On: on ? 'True' : 'False', State: 'Default' }, t ? { 'Label#390:221': t } : { 'Show label#390:226': false }), name: 'Bascule' + (t ? ' · ' + t : '') });
const status = (t, tone) => ({ i: '381:389', p: { Tone: tone, 'Label#381:214': t }, name: 'État · ' + t }); // Tone: Info|Pending|Success|Warning|Error|Neutral|Inactive
const chip = (t, sel) => ({ i: '381:351', p: { Size: 'M', State: sel ? 'Selected' : 'Default', 'Label#381:186': t, 'Icon left#381:191': false }, name: 'Pastille · ' + t });
const banner = (tone, msg, title, action) => ({ i: '391:543', p: Object.assign({ Tone: tone, 'Message#391:23': msg, 'Dismissible#391:48': false }, title ? { 'Title#391:28': true, 'Title text#391:33': title } : { 'Title#391:28': false }, action ? { 'Action#391:38': true, 'Action text#391:43': action } : { 'Action#391:38': false }), name: 'Bandeau · ' + tone, fillW: true }); // Tone: Info|Success|Warning|Error
const toast = (tone, msg, undo) => ({ i: '391:567', p: { Tone: tone, 'Message#391:53': msg, 'Undo#391:57': !!undo }, name: 'Message bref · ' + msg });
const linkT = (t, tone) => ({ i: '391:589', p: { Type: 'Standalone', Tone: tone || 'Blue', 'Label#391:61': t }, name: 'Lien · ' + t });
const tab = (t, active) => ({ i: '391:612', p: { State: active ? 'Active' : 'Default', 'Label#391:71': t }, name: 'Onglet · ' + t });
const avatar = (ini, size) => ({ i: '391:685', p: { Type: 'Initials', Size: size || 'S', 'Initials#391:84': ini }, name: 'Avatar · ' + ini });
const iconBtn = (ic, type, size) => ({ i: '391:602', p: { Type: type || 'Ghost', Size: size || 'M', 'Icon#391:66': IC[ic] }, name: 'Bouton · ' + ic });
const progress = (val, tone) => ({ i: '381:437', p: { Tone: tone || 'Blue', Value: String(Math.round(val / 10) * 10) }, name: 'Progression · ' + val });
const sep = () => ({ f: 'Séparateur', h: 1, fillW: true, fill: 'ligne/douce' });
// « ? » d'aide (TRV-126, DSN-055)
const help = () => ({ f: 'Aide · ?', d: 'H', w: 20, h: 20, r: 999, main: 'CENTER', cross: 'CENTER', fill: 'fond/ciel-pale', c: [ { t: '?', s: 'Outil/admin.caption', col: 'texte/roi' } ] });
// ---------- back-office (registre Outil)
// boScreen('EA-10 · Demandes, liste', 'Demandes', 'Relation client', [contenu…], hauteur) — entrée active + groupe ouvert du menu (AdminSidebar 488:586, AdminTopBar 488:1098)
const boScreen = async (name, entry, group, content, h, topProps) => {
  const scr = await B(page, { f: name + ' — 1440', d: 'H', w: 1440, h: h || 900, fill: 'fond/gris', clip: true, x: 0, y: 0 });
  const side = (await getC('488:586')).createInstance(); scr.appendChild(side); side.layoutSizingVertical = 'FILL'; side.name = 'Menu latéral';
  const props = {}; for (const k of Object.keys(side.componentProperties)) if (k.startsWith('Open ')) props[k] = !!group && k.startsWith('Open ' + group + '#'); side.setProperties(props);
  if (entry) { const e = side.findOne(n => n.type === 'INSTANCE' && n.name === 'Entrée · ' + entry); if (e) e.setProperties({ State: 'Active' }); }
  const main = await B(scr, { f: 'Zone principale', d: 'V', fillW: true, fillH: true });
  const top = (await getC('488:1098')).createInstance(); main.appendChild(top); top.layoutSizingHorizontal = 'FILL'; top.name = 'Barre du haut';
  if (topProps) { const tp = {}; for (const k of Object.keys(top.componentProperties)) for (const want in topProps) if (k.startsWith(want + '#')) tp[k] = topProps[want]; top.setProperties(tp); }
  const work = await B(main, { f: 'Zone de travail', d: 'V', fillW: true, fillH: true, pad: [22,24,40,24], gap: 16 });
  for (const c of content) if (c) await B(work, c);
  return scr;
};
const crumb = (t) => ({ t, s: 'Outil/admin.small', col: 'texte/doux', name: 'Fil d’Ariane' });
const pageHeader = (title, sub, actions, extra) => ({ f: 'En-tête de page', d: 'H', fillW: true, main: 'SPACE_BETWEEN', cross: 'CENTER', c: [ { f: 'Titre', d: 'V', gap: 4, c: [ { f: 'Ligne', d: 'H', gap: 10, cross: 'CENTER', c: [ { t: title, s: 'Outil/admin.title', col: 'texte/encre' }, ...(extra || []) ] }, sub ? { t: sub, s: 'Outil/admin.body', col: 'texte/doux' } : null ] }, { f: 'Actions', d: 'H', gap: 10, cross: 'CENTER', c: actions || [] } ] });
const bBtn = (t, type, ic) => ({ i: '381:315', p: Object.assign({ Type: type || 'Tool', Size: 'S', 'Label#381:0': t, 'Chevron#381:93': false }, ic ? { 'Icon left#381:31': true, 'Icon#381:62': IC[ic] } : {}), name: 'Bouton · ' + t });
const card = (title, kids, opts) => ({ f: 'Carte · ' + title, d: 'V', fillW: true, pad: 20, gap: 14, r: 12, fill: 'fond/blanc', stroke: 'ligne/bleue', ...(opts || {}), c: [ title ? { f: 'En-tête', d: 'H', fillW: true, main: 'SPACE_BETWEEN', cross: 'CENTER', c: [ { t: title, s: 'Outil/admin.h3', col: 'texte/encre' }, ...((opts && opts.right) || []) ] } : null, ...kids ] });
const kv = (k, v, vcol) => ({ f: 'Donnée · ' + k, d: 'H', fillW: true, gap: 12, c: [ { t: k, s: 'Outil/admin.small', col: 'texte/doux', w: 170 }, { t: v, s: 'Outil/admin.body', col: vcol || 'texte/encre', fillW: true } ] });
// filtres sans bouton (DSN-054)
const fchip = (t, active) => ({ f: 'Filtre · ' + t, d: 'H', h: 36, pad: [0, active ? 10 : 12, 0, 12], gap: 6, r: 999, cross: 'CENTER', fill: active ? 'fond/ciel-pale' : 'fond/blanc', stroke: active ? 'accent/bleu' : 'ligne/bleue', c: [ { t, s: active ? 'Outil/admin.strong' : 'Outil/admin.body', col: active ? 'texte/roi' : 'texte/encre' }, { ic: active ? 'Close' : 'ChevronDown', size: 14 } ] });
const filterBar = (ph, chips, clear, value) => ({ f: 'Barre de filtres', d: 'H', fillW: true, gap: 10, cross: 'CENTER', wrap: true, rowGap: 10, c: [
  { f: 'Recherche de la liste', d: 'H', w: 300, h: 36, pad: [0,12,0,12], gap: 8, r: 8, cross: 'CENTER', fill: 'fond/blanc', stroke: value ? 'accent/bleu' : 'ligne/bleue', c: [ { ic: 'Search', size: 16 }, { t: value || ph, s: 'Outil/admin.body', col: value ? 'texte/encre' : 'texte/discret' } ] },
  ...chips, clear ? { t: 'Tout effacer', s: 'Outil/admin.strong', col: 'texte/roi', name: 'Lien · Tout effacer' } : null ] });
const viewTabs = (tabs, active) => ({ f: 'Vues', d: 'H', fillW: true, gap: 4, stroke: 'ligne/bleue', sides: 'B', c: tabs.map(([t, n]) => ({ f: 'Vue · ' + t, d: 'H', pad: [10,14,10,14], gap: 8, cross: 'CENTER', stroke: t === active ? 'accent/bleu' : undefined, sw: 2, sides: t === active ? 'B' : undefined, c: [ { t, s: t === active ? 'Outil/admin.strong' : 'Outil/admin.body', col: t === active ? 'texte/roi' : 'texte/doux' }, n !== undefined ? { f: 'Compteur', d: 'H', pad: [1,7,1,7], r: 999, fill: t === active ? 'fond/bleu-roi' : 'fond/gris', c: [ { t: String(n), s: 'Outil/admin.caption', col: t === active ? 'texte/blanc' : 'texte/doux' } ] } : null ] })) });
// tableau vivant (DSN-053) : cols [{t, w, sort:'up'|'down', right}], rows [{name, hover, sel, h, cells:[texte | spec | [specs]]}]
const cellT = (t, st, colr) => ({ t, s: st || 'Outil/admin.body', col: colr || 'texte/encre', fillW: true, lines: 1 });
const table = (cols, rows, foot, opts) => ({ f: 'Tableau', d: 'V', fillW: true, r: 12, fill: 'fond/blanc', stroke: 'ligne/bleue', clip: true, c: [
  { f: 'En-tête collant', d: 'H', fillW: true, h: 44, pad: [0,16,0,16], cross: 'CENTER', fill: 'fond/gris', stroke: 'ligne/bleue', sides: 'B', c: cols.map(c => ({ f: 'Colonne · ' + (c.t || 'actions'), d: 'H', w: c.w, gap: 4, cross: 'CENTER', main: c.right ? 'MAX' : 'MIN', c: [ c.check ? { f: 'Case', w: 16, h: 16, r: 4, stroke: 'ligne/bleue', sw: 1.5, fill: 'fond/blanc' } : { t: c.t, s: 'Outil/admin.caption', col: c.sort ? 'texte/roi' : 'texte/doux', lines: 2 }, c.sort ? { ic: c.sort === 'down' ? 'ChevronDown' : 'ChevronUp', size: 12 } : null ] })) },
  ...rows.map((r, i) => ({ f: 'Ligne · ' + (r.name || i + 1), d: 'H', fillW: true, h: r.h || 52, pad: [0,16,0,16], cross: 'CENTER', fill: r.sel ? 'fond/ciel-pale' : r.hover ? 'fond/ciel-pale' : 'fond/blanc', stroke: 'ligne/douce', sides: 'B', op: r.op, c: r.cells.map((cell, j) => ({ f: 'Cellule', d: 'H', w: cols[j].w, gap: 8, cross: 'CENTER', main: cols[j].right ? 'MAX' : 'MIN', c: cols[j].check ? [ { f: 'Case', w: 16, h: 16, r: 4, stroke: r.sel ? 'fond/bleu-roi' : 'ligne/bleue', sw: 1.5, fill: r.sel ? 'fond/bleu-roi' : 'fond/blanc' } ] : Array.isArray(cell) ? cell : [ typeof cell === 'string' ? cellT(cell, null, null) : cell ] })) })),
  foot ] });
const who = (ini, nm, sub) => [ avatar(ini), { f: 'Nom', d: 'V', fillW: true, c: [ cellT(nm, 'Outil/admin.strong'), sub ? cellT(sub, 'Outil/admin.small', 'texte/doux') : null ] } ];
const pager = (range, pages, cur) => ({ f: 'Pied du tableau', d: 'H', fillW: true, h: 52, pad: [0,16,0,16], main: 'SPACE_BETWEEN', cross: 'CENTER', c: [
  { t: range, s: 'Outil/admin.body', col: 'texte/doux' },
  { f: 'Pagination', d: 'H', gap: 16, cross: 'CENTER', c: [
    { f: 'Lignes par page', d: 'H', gap: 8, cross: 'CENTER', c: [ { t: 'Lignes par page', s: 'Outil/admin.small', col: 'texte/doux' }, { f: 'Choix', d: 'H', h: 32, pad: [0,10,0,10], gap: 6, r: 8, cross: 'CENTER', stroke: 'ligne/bleue', c: [ { t: '25', s: 'Outil/admin.strong', col: 'texte/encre' }, { ic: 'ChevronDown', size: 14 } ] } ] },
    { f: 'Pages', d: 'H', gap: 4, cross: 'CENTER', c: [ { ic: 'ChevronLeft', size: 16 }, ...pages.map(p => ({ f: 'Page ' + p, d: 'H', w: 32, h: 32, r: 8, main: 'CENTER', cross: 'CENTER', fill: p === (cur || 1) ? 'fond/bleu-roi' : undefined, c: [ { t: String(p), s: 'Outil/admin.strong', col: p === (cur || 1) ? 'texte/blanc' : 'texte/encre' } ] })), { ic: 'ChevronRight', size: 16 } ] } ] } ] });
const bulkBar = (n, actions) => ({ f: 'Barre d’actions groupées', d: 'H', fillW: true, h: 56, pad: [0,20,0,20], gap: 16, r: 12, cross: 'CENTER', fill: 'fond/bleu-nuit', mode: 'Sombre', shadow: 'xl', c: [ { t: n + ' sélectionnés', s: 'Outil/admin.strong', col: 'texte/blanc' }, { t: 'Tout désélectionner', s: 'Outil/admin.body', col: 'texte/ciel' }, { f: 'Espace', d: 'H', fillW: true }, ...actions ] });
// fenêtre par-dessus un écran : overlayModal(screenNode, {w, title, sub, body:[…], foot:[…]}) — clone l'écran, voile 55 %, fenêtre centrée
const modalCard = (o) => ({ f: 'Fenêtre · ' + o.title, d: 'V', w: o.w || 560, r: o.client ? 30 : 12, fill: 'fond/blanc', shadow: 'xl', clip: true, c: [
  { f: 'En-tête', d: 'H', fillW: true, pad: o.client ? [28,28,16,36] : [20,20,12,24], gap: 12, cross: 'MIN', c: [ { f: 'Titre', d: 'V', fillW: true, gap: 4, c: [ { t: o.title, s: o.client ? 'Vitrine/title.block' : 'Outil/admin.h2', col: o.client ? 'texte/roi' : 'texte/encre', fillW: true }, o.sub ? { t: o.sub, s: o.client ? 'Vitrine/body.xl' : 'Outil/admin.body', col: 'texte/doux', fillW: true } : null ] }, iconBtn('Close', 'Ghost', 'S') ] },
  { f: 'Contenu', d: 'V', fillW: true, pad: o.client ? [8,36,24,36] : [8,24,20,24], gap: o.client ? 20 : 16, c: o.body },
  o.foot ? { f: 'Pied', d: 'H', fillW: true, pad: o.client ? [16,36,28,36] : [14,24,20,24], gap: 10, main: 'MAX', cross: 'CENTER', stroke: 'ligne/douce', sides: 'T', c: o.foot } : null ] });
const overlayModal = async (base, name, o) => {
  const scr = base.clone(); scr.name = name; page.appendChild(scr);
  const veil = await B(scr, { f: 'Voile', w: scr.width, h: scr.height, fill: ['fond/bleu-profond', 0.55], abs: { x: 0, y: 0 } });
  const m = await B(scr, Object.assign(modalCard(o), { abs: { x: 0, y: 0 } }));
  m.x = Math.round((scr.width - m.width) / 2); m.y = o.top !== undefined ? o.top : Math.max(40, Math.round((Math.min(scr.height, 900) - m.height) / 2));
  return scr;
};
// ---------- espace client (registre Accompagnement) : SpaceTopBar 488:1254, SpaceSidebar 488:1166 — textes courants en Vitrine/body.xl (TRV-124)
// Depuis le 11/10/2026 (ECL-001, D-097) : le menu latéral occupe toute la hauteur (marque en tête, « Mes pièces » sous « Mon dossier », Favoris, Alertes, carte « Une question ? ») ;
// la barre du haut (1176 px, sans la marque) est à sa droite. Téléphone : SpaceTopBarMobile 662:1061 + SpaceTabBar 662:1272 (Active=Accueil|Dossier|Biens|Messages|Plus), voir le cadre 664:1001.
const spaceScreen = async (name, entry, content, h, sideProps) => {
  const scr = await B(page, { f: name + ' — 1440', d: 'H', w: 1440, h: h || 1000, fill: 'fond/ivoire', clip: true, x: 0, y: 0 });
  const side = (await getC('488:1166')).createInstance(); scr.appendChild(side); side.layoutSizingVertical = 'FILL'; side.name = 'Menu latéral';
  if (sideProps) { const sp2 = {}; for (const k of Object.keys(side.componentProperties)) for (const want in sideProps) if (k.startsWith(want + '#')) sp2[k] = sideProps[want]; side.setProperties(sp2); }
  if (entry) { const e = side.findOne(n => n.type === 'INSTANCE' && n.name === 'Entrée · ' + entry); if (e) e.setProperties({ State: 'Active' }); }
  const zone = await B(scr, { f: 'Zone principale', d: 'V', fillW: true, fillH: true });
  const top = (await getC('488:1254')).createInstance(); zone.appendChild(top); top.layoutSizingHorizontal = 'FILL'; top.name = 'Barre du haut';
  const content2 = await B(zone, { f: 'Contenu', d: 'V', fillW: true, fillH: true, pad: [40,48,64,48], gap: 28 });
  for (const c of content) if (c) await B(content2, c);
  return scr;
};
// ---------- site public (depuis le 08/10/2026) : Header = jeu 533:975 (Version Default|Compact · Account Guest|Connected · Show café), Footer 385:530 (Show café · Show phone · Show socials),
// HeaderMobile 533:7108 (Account), FooterMobile 533:7109, Illustration 561:1088 (Scène = Projection|Partenaire|Rappel|Alerte|Avis|Attente|Perdu), ErrorSummary 545:968.
// Le Café est ACTIF dans les maquettes : « LE CAFÉ » reste dans l'en-tête et le pied, sauf sur un écran explicitement « sans Le Café ». Chiffres et noms : Design/donnees-de-reference.md.
const GRAD = (await getC('393:391')).fills; // dégradé doux des pages intérieures (fond des sections de contenu)
const GRAD_WARM = (await getC('393:583')).fills;
const hdrI = (p) => ({ i: '533:975', p: Object.assign({ Account: 'Guest', Width: '1280 et plus' }, p || {}), name: 'En-tête', fillW: true }); // depuis le 11/10/2026 : Account Guest|Connected × Width « 1280 et plus »|« 1024 à 1279 » (une seule hauteur, 80 px ; plus de Version)
const ftrI = (p) => ({ i: '385:530', p: Object.assign({ 'Show café#385:19': true, 'Show phone#385:20': true, 'Show socials#385:21': true }, p || {}), name: 'Pied de page', fillW: true });
const hdrM = (acc) => ({ i: '533:7108', p: { Account: acc || 'Guest' }, name: 'En-tête téléphone', fillW: true });
const ftrM = () => ({ i: '533:7109', name: 'Pied de page téléphone', fillW: true });
const scene = (nm, scale) => ({ i: '561:1088', p: { 'Scène': nm }, name: 'Scène · ' + nm, scale: scale || 0.95 });
// « Écouter cette page » (TRV-127) : en tête du contenu de chaque page du site ; phone = version 390
const listen = (phone) => ({ f: 'Barre · Écouter', d: 'H', fillW: true, pad: phone ? [12, 20, 0, 20] : [20, 48, 0, 48], c: [ { f: 'Écouter · repos', d: 'H', gap: 8, pad: phone ? [8, 16, 8, 12] : [10, 16, 10, 12], r: 999, fill: 'fond/blanc', stroke: 'ligne/bleue', cross: 'CENTER', c: [ { ic: 'Speaker', size: 20 }, { t: 'Écouter cette page', s: phone ? 'Vitrine/body.s.strong' : 'Vitrine/body.m.strong', col: 'texte/roi' } ] } ] });
// siteScreen('EP-xx · Nom, état', [sections…], { hdr: {Version, Account, 'Show café#533:0'}, ftr: {…}, noFooter, noListen, fill })
const siteScreen = async (name, content, opts) => { opts = opts || {};
  const scr = await B(page, { f: name + ' — 1440', d: 'V', w: 1440, fill: opts.fill || 'fond/blanc', clip: true, x: 0, y: 0 });
  await B(scr, hdrI(opts.hdr));
  const main = await B(scr, { f: 'Contenu', d: 'V', fillW: true, gap: 0 });
  if (!opts.noListen) await B(main, listen(false));
  for (const c of content) if (c) await B(main, c);
  if (!opts.noFooter) await B(scr, ftrI(opts.ftr));
  if (opts.h) { scr.layoutSizingVertical = 'FIXED'; scr.resize(1440, opts.h); }
  return scr;
};
// phoneScreen('EP-xx · Nom', [sections…], { acc, h (hauteur fixe 844 pour une barre collante), noFooter, noListen, fill })
const phoneScreen = async (name, content, opts) => { opts = opts || {};
  const scr = await B(page, { f: name + ' — 390', d: 'V', w: 390, fill: opts.fill || 'fond/blanc', clip: true, x: 0, y: 0 });
  if (!opts.noHeader) await B(scr, hdrM(opts.acc));
  const main = await B(scr, { f: 'Contenu', d: 'V', fillW: true });
  if (!opts.noListen) await B(main, listen(true));
  for (const c of content) if (c) await B(main, c);
  if (!opts.noFooter) await B(scr, ftrM());
  if (opts.h) { scr.layoutSizingVertical = 'FIXED'; scr.resize(390, opts.h); }
  return scr;
};
// barre collante en bas d'un écran 390 à hauteur fixe
const stickyBar = async (scr, kids) => { const bar = await B(scr, { f: 'Barre collante', d: 'H', w: 390, gap: 10, pad: [12, 20, 20, 20], fill: 'fond/blanc', stroke: 'ligne/douce', sides: 'T', shadow: 'm', cross: 'CENTER', abs: { x: 0, y: 0 }, c: kids }); bar.y = scr.height - bar.height; return bar; };
// placeGrid(section, cadre, 'EP-xx', 'nom de l’état', '1 440'|'390'|'720') : grille de 3 cadres par rangée dans la section d'écran, SANS déplacer les autres sections (le rangement de la page se fait à la fin, une fois : reflowFamily)
const placeGrid = async (secOrName, frame, id, name, fmt) => {
  const sec = typeof secOrName === 'string' ? screenSec(secOrName) : secOrName; cleanWhite(frame);
  const frames = sec.children.filter(n => n.type === 'FRAME' && n.width >= 300); const i = frames.length; let y = 186;
  if (i > 0) { if (i % 3 === 0) y = Math.max(...frames.map(f => f.y + f.height)) + 266; else y = frames.slice(i - (i % 3)).reduce((m, f) => Math.min(m, f.y), 1e9); }
  sec.appendChild(frame); frame.x = 120 + (i % 3) * 1600; frame.y = y; await label(sec, frame, id, name, fmt || (/— 390$/.test(frame.name) ? '390' : '1 440'));
  const kids = sec.children; sec.resizeWithoutConstraints(Math.max(...kids.map(n => n.x + n.width)) + 120, Math.max(...kids.map(n => n.y + n.height)) + 120); return frame; };
// replaceFrame(ancienCadre, nouveauCadre) : met le nouveau à la place de l'ancien (même position, même étiquette), supprime l'ancien
const replaceFrame = (oldF, newF) => { const sec = oldF.parent; sec.appendChild(newF); newF.x = oldF.x; newF.y = oldF.y; oldF.remove(); const kids = sec.children; sec.resizeWithoutConstraints(Math.max(...kids.map(n => n.x + n.width)) + 120, Math.max(...kids.map(n => n.y + n.height)) + 120); return newF; };
// loadT(texte) avant toute modification de characters d'un texte existant
const loadT = async t => { for (const s of t.getStyledTextSegments(['fontName'])) await figma.loadFontAsync(s.fontName); };
// ---------- ajouts du 11/10/2026 (report du site construit, D-098 — détail : figma-ledger.json, session20261011)
// PropertyCard 383:222 : Show compare#653:0 (vrai), Compared#653:4, Show illustration#653:8 (vrai), Show details#653:12 (faux), Details#653:16 (« surface · livraison » des cartes du catalogue).
// Illustration 561:1088 : scènes Questions 658:66270, Accès 667:1117, Courrier 667:1128 (créées depuis le SVG du code : figma.createNodeFromSvg, puis couleurs liées aux variables).
// Back-office : AdminTopBar 488:1098 (recherche « / », aide « ? », cloche, compte ; Show create faux par défaut) ; entrée active avec filet accent/bleu.
// Gabarits dessinés à reprendre par clonage : liste 668:3010 (EA-10), fiche 670:3831 (EA-11), porte 675:7074 (EA-00), fenêtre sur liste 673:6607 (EA-96).
// PIÈGE : un paint lié avec opacité — P(nom) puis n.fills = n.fills.map(f => ({ ...f, opacity })) APRÈS l'affectation (setP le fait) ; { ...P(nom), opacity } avant l'affectation perd l'opacité.
// PIÈGE : dans un dégradé, ne pas lier les arrêts à une variable quand ils portent une transparence (la liaison remet l'alpha à 1).
// ===== fin du KIT =====
