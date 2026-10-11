# -*- coding: utf-8 -*-
"""
Vérifie la cohérence interne du dossier Specs/.

Usage :  python Specs/_outils/verifier_specs.py
Code de sortie : 0 si tout est cohérent, 1 sinon.

Contrôles (règle QUA-025) :
  1. chaque identifiant de règle cité (CAT-020, CYC-105…) est défini une fois, et une seule ;
  2. chaque décision D-nnn et chaque question Q-nnn citée figure au registre ;
  3. chaque code de modèle d'e-mail cité figure au catalogue et possède un texte d'origine ;
  4. chaque code de règle d'automatisation (R_…) et chaque type de notification (NC_…, NS_…) cité est défini ;
     le déclencheur de chaque règle livrée est un événement du catalogue ;
  5. chaque écran cité (EP-, EC-, EA-, EM-) figure à l'inventaire ; chaque écran de l'inventaire a sa page Figma,
     et sa place dans l'ordre de maquettage quand il a une livraison ;
  6. chaque renvoi vers un fichier des specs aboutit ;
  7. chaque référence `Entité.champ` correspond à un champ du modèle de données ;
  8. chaque code à points cité (`dossier.read`, `features.cafe`, `lead.created`, `home.hero.line1`…) est défini dans
     son registre : permissions, paramètres, événements, champs de condition, tâches planifiées, champs dynamiques,
     actions du journal d'audit, flux temps réel, blocs de contenu, textes d'interface, jetons de design ;
  9. chaque valeur d'énumération citée (`LeadKind.CALLBACK_REQUEST`) existe ; chaque liste d'états de DSN-015 donne
     un ton à chacune de ses valeurs, sans oubli ni doublon ;
 10. chaque parcours de recette (P01…) et chaque indicateur (M01…) cité est défini ; chaque parcours est rattaché
     au plan de réalisation ;
 11. chaque code d'erreur cité avec son statut (`409 CONFLICT_STATE`) est celui de TRV-110 ;
 12. les chiffres annoncés par le README sont ceux du dossier.
"""
import collections
import glob
import io
import os
import re
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PREFIXES = ["ROL", "TRV", "MOD", "CYC", "CAL", "AUT", "NOT", "PAR", "NAV", "ACC", "CAT", "FIC", "DEM", "SIM", "CAF",
            "EDI", "ASS", "AUTH", "ECL", "INT", "DOS", "MSG", "SFA", "PRO", "BO", "TDB", "CRM", "CTL", "BNK", "PIP",
            "GED", "COM", "TAC", "EVT", "FBK", "CMS", "ADM", "PPR", "PBQ", "MOB", "IA", "ARC", "API", "SEC", "FIA",
            "MED", "QUA", "ENV", "DSN", "ACP"]
PFX = "|".join(sorted(PREFIXES, key=len, reverse=True))

files = sorted(f for f in glob.glob(os.path.join(ROOT, "**", "*.md"), recursive=True))
text = {f: open(f, encoding="utf-8").read() for f in files}


def rel(path):
    return os.path.relpath(path, ROOT).replace("\\", "/")


def spec(*parts):
    return text[os.path.join(ROOT, *parts)]


def section(content, start, end=None):
    """Le texte d'un fichier depuis un titre jusqu'au titre suivant (ou jusqu'à la fin)."""
    a = content.index(start)
    b = content.index(end, a + 1) if end else len(content)
    return content[a:b]


def first_column(content, pattern):
    """Les codes cités dans la première colonne des tableaux : c'est là qu'un registre définit."""
    found = set()
    for line in content.splitlines():
        if line.startswith("|"):
            cells = line.split("|")
            if len(cells) > 2:
                found.update(re.findall(pattern, cells[1]))
    return found


problems = []


def report(title, items):
    print(f"\n{title} : {len(items)}")
    for line in items:
        print("   ", line)
    problems.extend(items)


# 1. Règles ------------------------------------------------------------------------------------
defs = collections.defaultdict(list)
for f, t in text.items():
    for m in re.finditer(r"\*\*(" + PFX + r")-(\d{3})\*\*", t):
        defs[f"{m.group(1)}-{m.group(2)}"].append(rel(f))
refs = collections.defaultdict(set)
for f, t in text.items():
    for m in re.finditer(r"(?<![A-Za-z0-9_\-])(" + PFX + r")-(\d{3})(?![0-9])", t):
        refs[f"{m.group(1)}-{m.group(2)}"].add(rel(f))
print(f"Fichiers : {len(files)} · règles définies : {len(defs)} · mots : {sum(len(t.split()) for t in text.values())}")
report("Règles définies plusieurs fois", [f"{k} : {v}" for k, v in sorted(defs.items()) if len(v) > 1])
report("Règles citées mais non définies",
       [f"{k} ← {', '.join(sorted(v))}" for k, v in sorted(refs.items()) if k not in defs])

# 2. Décisions et questions ------------------------------------------------------------------------
register = spec("00-cadre", "05-decisions-et-questions.md")
known_d = set(re.findall(r"^\| (D-\d{3}) \|", register, re.M))
known_q = set(re.findall(r"^\| (Q-\d{3}) \|", register, re.M))
missing = []
for f, t in text.items():
    for m in re.finditer(r"(?<![A-Za-z0-9\-])([DQ]-\d{3})(?!\d)", t):
        if m.group(1) not in known_d and m.group(1) not in known_q:
            missing.append(f"{m.group(1)} ← {rel(f)}")
report("Décisions ou questions citées mais absentes du registre", sorted(set(missing)))

# 3. Modèles d'e-mail ---------------------------------------------------------------------------
notif = spec("01-domaine", "09-notifications-et-emails.md")
catalogue_part, texts_part = notif.split("## 6. Textes d'origine des modèles", 1)
code_re = re.compile(r"`((?:C|S|P)_[A-Z0-9_]+)`")
in_catalogue = set()
for line in catalogue_part.split("## 4. E-mails : catalogue", 1)[1].splitlines():
    if line.startswith("| `"):
        in_catalogue.update(code_re.findall(line.split("|")[1]))
with_text = set(re.findall(r"\*\*`((?:C|S|P)_[A-Z0-9_]+)`\*\*", texts_part))
for m in re.finditer(r"^((?:`S_[A-Z_]+`,? ?)+) :", texts_part, re.M):
    with_text.update(re.findall(r"`(S_[A-Z_]+)`", m.group(1)))
cited = collections.defaultdict(set)
for f, t in text.items():
    for c in code_re.findall(t):
        cited[c].add(rel(f))
report("Modèles d'e-mail cités mais absents du catalogue",
       [f"{c} ← {', '.join(sorted(v))}" for c, v in sorted(cited.items()) if c not in in_catalogue])
report("Modèles d'e-mail au catalogue sans texte d'origine", sorted(in_catalogue - with_text))

# 4. Règles d'automatisation et notifications ----------------------------------------------------------
DOTTED = r"`([a-z][A-Za-z0-9_]*(?:\.[a-zA-Z0-9_{}*]+)+)`"
automation = spec("01-domaine", "08-automatisations.md")
rules = set(re.findall(r"^\| `(R_[A-Z0-9_]+)` \|", automation, re.M))
missing = []
for f, t in text.items():
    for c in re.findall(r"`(R_[A-Z0-9_]+)`", t):
        if c not in rules:
            missing.append(f"{c} ← {rel(f)}")
report("Règles d'automatisation citées mais non définies", sorted(set(missing)))

events = first_column(section(automation, "## 2. Déclencheurs", "## 3. Conditions"), DOTTED)
missing = []
for line in automation.splitlines():
    m = re.match(r"^\| `(R_[A-Z0-9_]+)` \|([^|]*)\|", line)
    if m:
        triggers = re.findall(DOTTED, m.group(2))
        if not triggers:
            missing.append(f"{m.group(1)} : aucun déclencheur")
        missing.extend(f"{m.group(1)} : `{t}` n'est pas un événement du catalogue (AUT-010)"
                       for t in triggers if t not in events)
report("Règles d'automatisation dont le déclencheur n'existe pas", sorted(set(missing)))

notif_types = set()
for line in notif.splitlines():
    if line.startswith("| `N"):
        notif_types.update(re.findall(r"`(N[CS]_[A-Z0-9_]+)`", line.split("|")[1]))
missing = []
for f, t in text.items():
    for c in re.findall(r"`(N[CS]_[A-Z0-9_]+)`", t):
        if c not in notif_types:
            missing.append(f"{c} ← {rel(f)}")
report("Types de notification cités mais non définis", sorted(set(missing)))

# 5. Écrans ------------------------------------------------------------------------------------
inventory = spec("07-design", "02-inventaire-des-ecrans.md")
SCREEN = r"\b(E[PCAM])-(\d{2,3})(?: à (E[PCAM])-(\d{2,3}))?"


def expand(cell):
    """« EA-40 à EA-43, EA-50 » → EA-40, EA-41, EA-42, EA-43, EA-50."""
    out = []
    for m in re.finditer(SCREEN, cell):
        if m.group(3):
            out.extend(f"{m.group(1)}-{n:02d}" for n in range(int(m.group(2)), int(m.group(4)) + 1))
        else:
            out.append(f"{m.group(1)}-{m.group(2)}")
    return out


# Un écran est défini par la première colonne d'une ligne des tableaux d'écrans — et par rien d'autre :
# une plage citée ailleurs (« EA-40 à EA-54 ») ne crée pas les écrans qu'elle enjambe.
screen_rows = collections.defaultdict(list)
for line in inventory.splitlines():
    if re.match(r"^\| E[PCAM]-\d", line):
        cells = [c.strip() for c in line.split("|")]
        for s in expand(cells[1]):
            screen_rows[s].append(cells[-2])
screens = set(screen_rows)
report("Écrans définis plusieurs fois à l'inventaire", sorted(s for s, v in screen_rows.items() if len(v) > 1))
missing = []
for f, t in text.items():
    for m in re.finditer(SCREEN, t):
        for s in expand(m.group(0)):
            if s not in screens:
                missing.append(f"{s} (dans « {m.group(0)} ») ← {rel(f)}")
report("Écrans cités mais absents de l'inventaire", sorted(set(missing)))

pages = []
for line in section(inventory, "## 1. Organisation du fichier Figma", "## 2. Site public").splitlines():
    if line.startswith("| `"):
        pages.extend(expand(line.split("|")[2]))
count = collections.Counter(pages)
report("Écrans sans page Figma, ou rangés sur deux pages",
       sorted([f"{s} : aucune page" for s in screens - set(pages)] + [f"{s} : {n} pages" for s, n in count.items() if n > 1]))

order = collections.defaultdict(set)
for line in section(inventory, "## 5. Ordre de maquettage").splitlines():
    m = re.match(r"^\| (L[1-5]) \|([^|]*)\|", line)
    if m:
        order[m.group(1)].update(expand(m.group(2)))
missing = []
for s, cells in sorted(screen_rows.items()):
    deliveries = set(re.findall(r"L[1-5]", cells[0]))
    for d in sorted(deliveries):
        if s not in order[d]:
            missing.append(f"{s} : livré en {d}, absent de la ligne {d} de l'ordre de maquettage")
    for d, listed in sorted(order.items()):
        if s in listed and d not in deliveries:
            missing.append(f"{s} : dans la ligne {d} de l'ordre de maquettage, mais sa livraison est « {cells[0]} »")
report("Écrans dont la livraison et l'ordre de maquettage ne concordent pas", missing)

# 6. Renvois vers des fichiers ---------------------------------------------------------------------
names = collections.defaultdict(dict)
for f in files:
    folder, base = os.path.basename(os.path.dirname(f)), os.path.basename(f)
    names[folder][base[:2]] = base
missing = []
for f, t in text.items():
    for m in re.finditer(r"`((?:0[0-8])-[a-z\-]+)/(\d{2})(?:-([a-z0-9\-]+)\.md)?`", t):
        folder, number, slug = m.groups()
        if folder not in names or number not in names[folder]:
            missing.append(f"{m.group(0)} ← {rel(f)}")
        elif slug and names[folder][number] != f"{number}-{slug}.md":
            missing.append(f"{m.group(0)} (nom réel : {names[folder][number]}) ← {rel(f)}")
report("Renvois vers un fichier qui n'existe pas", sorted(set(missing)))

# 7. Champs du modèle -----------------------------------------------------------------------------
domain = os.path.join(ROOT, "01-domaine")
model_files = [os.path.join(domain, n) for n in os.listdir(domain) if n[:2] in ("02", "03", "04", "05")]
overview = spec("01-domaine", "01-modele-conventions-et-vue-d-ensemble.md")
enums = {}
for line in section(overview, "## 3. Énumérations").splitlines():
    m = re.match(r"^\| `([A-Za-z]+)` \| (.*) \|$", line)
    if m:
        enums[m.group(1)] = re.findall(r"`([A-Za-z0-9_]+)`", m.group(2))
enum_names = set(re.findall(r"^\| `([A-Za-z]+)` \|", overview, re.M))
fields = collections.defaultdict(set)
for f in model_files:
    current = None
    for line in text[f].splitlines():
        if re.match(r"^#{2,4} .*?`[A-Z][A-Za-z]+`", line):
            current = re.findall(r"`([A-Z][A-Za-z]+)`", line)
            continue
        inline = re.match(r"^`([A-Z][A-Za-z]+)`.*?:\s(.*)$", line)
        if inline and not line.startswith("|"):
            current = [inline.group(1)]
            fields[inline.group(1)].update(re.findall(r"`([a-z][A-Za-z0-9]+)`", inline.group(2)))
        if current and line.startswith("|"):
            for name in re.findall(r"`([a-z][A-Za-z0-9]+)`", line.split("|")[1]):
                for entity in current:
                    fields[entity].add(name)
common = {"id", "createdAt", "updatedAt", "createdById", "updatedById", "deletedAt", "version"}
missing = []
for f, t in text.items():
    for entity, name in re.findall(r"`([A-Z][A-Za-z]+)\.([a-z][A-Za-z0-9]+)`", t):
        if entity in enum_names or entity in ("Intl", "CLAUDE"):
            continue
        if entity not in fields:
            missing.append(f"{entity}.{name} (entité inconnue) ← {rel(f)}")
        elif name not in fields[entity] and name not in common:
            missing.append(f"{entity}.{name} ← {rel(f)}")
report("Champs cités mais absents du modèle", sorted(set(missing)))

# 8. Codes à points -----------------------------------------------------------------------------
# Un code cité n'importe où doit être défini dans la section qui fait registre pour sa famille.
roles = spec("00-cadre", "02-acteurs-roles-permissions.md")
params = spec("01-domaine", "10-parametres-et-donnees-de-reference.md")
security = spec("06-technique", "03-securite-et-conformite.md")
api = spec("06-technique", "02-api.md")
contents = spec("04-back-office", "12-contenus-et-seo.md")
permissions = first_column(roles, DOTTED)
settings = first_column(params, DOTTED)

conditions = set()  # AUT-020 : « objet » × « champs »
for line in section(automation, "## 3. Conditions", "## 4. Actions").splitlines():
    cells = line.split("|")
    if line.startswith("| `") and len(cells) > 3:
        obj = re.findall(r"`([a-z][A-Za-z]*)`", cells[1])
        for name in re.findall(r"`([a-zA-Z][A-Za-z0-9.*]*)`", cells[2]):
            conditions.add(name if "." in name else f"{obj[0]}.{name}")
conditions.update(re.findall(DOTTED, section(automation, "## 3. Conditions", "## 4. Actions")))

registers = {
    "permissions": permissions,
    "paramètres": settings,
    "événements": events,
    "champs de condition": conditions,
    "tâches planifiées": set(re.findall(DOTTED, section(automation, "## 8. Tâches planifiées"))),
    # les champs propres à un modèle (« action.* ») sont définis par son texte d'origine, au § 6 (NOT-050)
    "champs dynamiques": set(re.findall(DOTTED, section(notif, "## 5. Champs dynamiques")))
                         | set(re.findall(r"\{\{(?:#if |#each |/if|/each)?\s*([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+)\s*\}\}", notif)),
    "journal d'audit": set(re.findall(DOTTED, section(security, "## 9. Journal d'audit", "## 10. Protection"))),
    "API": set(re.findall(DOTTED, section(api, "## 2. Listes", "## 3. Erreurs")))
           | set(re.findall(DOTTED, section(api, "## 6. Temps réel", "## 7. Fichiers"))),
    "blocs de contenu": set(re.findall(DOTTED, section(contents, "## 1. Textes du site", "## 2. Pages libres"))),
    "textes d'interface": set(re.findall(DOTTED, spec("07-design", "03-microcopie.md"))),
    "jetons de design": set(re.findall(DOTTED, spec("07-design", "01-systeme-de-design.md"))),
}
known = set().union(*registers.values())
families = {c.split(".")[0] for c in known}
# Ce qui ressemble à un code sans en être un : noms de fichiers, de domaines, champ d'un résultat de calcul.
NOT_A_CODE = re.compile(r"\.(txt|com|fr|xml|json|md)$|\{domaine\}|^target\.case$")


def is_defined(code):
    if code in known or NOT_A_CODE.search(code):
        return True
    if code.endswith(".*"):  # « lead.* » : toute la famille
        return code.split(".")[0] in families
    if code.startswith("event.data."):  # données de l'événement déclencheur (AUT-020)
        return True
    for s in settings:  # « finance.reference.{pays} » couvre « finance.reference.DZ » et « finance.reference »
        if "{" in s:
            pattern = "^" + re.sub(r"\\\{[^}]*\\\}", "[A-Za-z0-9_{}]+", re.escape(s)) + "$"
            if re.match(pattern, code) or s.split(".{")[0] == code:
                return True
    return False


missing = collections.defaultdict(set)
for f, t in text.items():
    for code in re.findall(DOTTED, t):
        if not is_defined(code):
            missing[code].add(rel(f))
report("Codes cités mais définis dans aucun registre (permission, paramètre, événement, bloc de contenu…)",
       [f"{c} ← {', '.join(sorted(v))}" for c, v in sorted(missing.items())])

# Une permission se reconnaît à son verbe : citée quelque part, elle doit figurer à la matrice des rôles.
verbs = {p.split(".")[-1] for p in permissions}
perm_families = {p.split(".")[0] for p in permissions}
missing = collections.defaultdict(set)
for f, t in text.items():
    for code in re.findall(DOTTED, t):
        parts = code.split(".")
        if parts[0] in perm_families and parts[-1] in verbs and code not in permissions:
            missing[code].add(rel(f))
report("Permissions citées mais absentes de la matrice des rôles",
       [f"{c} ← {', '.join(sorted(v))}" for c, v in sorted(missing.items())])

# 9. Énumérations -------------------------------------------------------------------------------
missing = []
for f, t in text.items():
    for enum, value in re.findall(r"`([A-Z][A-Za-z]+)\.([A-Z][A-Z0-9_]+)`", t):
        if enum in enums and value not in enums[enum]:
            missing.append(f"{enum}.{value} ← {rel(f)}")
report("Valeurs d'énumération citées mais inexistantes", sorted(set(missing)))

design = spec("07-design", "01-systeme-de-design.md")
TONES = {"Information", "Attente", "Succès", "Alerte", "Erreur", "Neutre", "Inactif"}
missing = []
for line in section(design, "**DSN-015**", "## 3. Typographie").splitlines():
    m = re.match(r"^\| `([A-Za-z]+)` \| (.*) \|$", line)
    if not m:
        continue
    enum, toned = m.group(1), re.findall(r"`([A-Z0-9_]+)` : ([A-Za-zéè]+)", m.group(2))
    if enum not in enums:
        missing.append(f"{enum} : énumération inconnue")
        continue
    listed = [v for v, _ in toned]
    missing.extend(f"{enum}.{v} : sans ton" for v in enums[enum] if v not in listed)
    missing.extend(f"{enum}.{v} : n'est pas une valeur de l'énumération" for v in listed if v not in enums[enum])
    missing.extend(f"{enum}.{v} : cité {n} fois" for v, n in collections.Counter(listed).items() if n > 1)
    missing.extend(f"{enum}.{v} : ton « {tone} » inconnu" for v, tone in toned if tone not in TONES)
report("Tons des pastilles d'état (DSN-015) incomplets ou faux", missing)

# 10. Parcours de recette et indicateurs ------------------------------------------------------------
quality = spec("06-technique", "06-qualite-tests-recette.md")
journeys = set(re.findall(r"^\| (P\d{2})\b", quality, re.M))
optional = set(re.findall(r"^\| (P\d{2}) `\[", quality, re.M))  # parcours d'un élément hors Phase 1 : [P1+], [P2], [P3]
metrics = set(re.findall(r"^\| (M\d{2})\b", spec("04-back-office", "02-tableau-de-bord-et-rapports.md"), re.M))
plan = spec("08-tracabilite", "02-plan-de-realisation.md")
missing = []
for f, t in text.items():
    missing.extend(f"{c} ← {rel(f)}" for c in re.findall(r"\bP\d{2}\b", t) if c not in journeys)
    missing.extend(f"{c} ← {rel(f)}" for c in re.findall(r"\bM\d{2}\b", t) if c not in metrics)
report("Parcours de recette ou indicateurs cités mais non définis", sorted(set(missing)))
report("Parcours de recette rattachés à aucun paquet du plan de réalisation",
       sorted(j for j in journeys - optional if not re.search(r"\b" + j + r"\b", plan)))

# 11. Codes d'erreur ------------------------------------------------------------------------------
transverse = spec("00-cadre", "04-regles-transverses.md")
errors = set(re.findall(r"^\| `(\d{3})` \| `([A-Z_]+)` \|", section(transverse, "**TRV-110**", "**TRV-111**"), re.M))
missing = []
for f, t in text.items():
    for status, code in re.findall(r"`(\d{3}) ([A-Z_]+)`", t):
        if (status, code) not in errors:
            missing.append(f"{status} {code} ← {rel(f)}")
report("Codes d'erreur cités avec un statut qui n'est pas celui de TRV-110", sorted(set(missing)))

# 12. Chiffres du README ---------------------------------------------------------------------------
readme = spec("README.md")
facts = {
    "fichiers": len(files),
    "règles identifiées": len(defs),
    "décisions": len(known_d),
    "questions ouvertes": len(known_q),
    "modèles d'e-mail": len(in_catalogue),
    "écrans": len(screens),
    "parcours de recette": len(journeys),
}
print("\nEn chiffres : " + ", ".join(f"{n} {label}" for label, n in facts.items())
      + f" · {len(rules)} règles d'automatisation, {len(notif_types)} types de notification, "
        f"{len(permissions)} permissions, {len(settings)} paramètres, {len(enums)} énumérations, {len(metrics)} indicateurs.")
line = next((x for x in readme.splitlines() if x.startswith("En chiffres")), "")
missing = []
for label, n in facts.items():
    m = re.search(r"(\d[\d\s  ]*) " + re.escape(label), line)
    if not m:
        missing.append(f"« {label} » : absent de la ligne « En chiffres » du README")
    elif int(re.sub(r"\D", "", m.group(1))) != n:
        missing.append(f"« {label} » : le README annonce {m.group(1).strip()}, le dossier en compte {n}")
report("Chiffres du README qui ne sont plus ceux du dossier", missing)

print("\n" + ("Tout est cohérent." if not problems else f"{len(problems)} point(s) à corriger."))
sys.exit(1 if problems else 0)
