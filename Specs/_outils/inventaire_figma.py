# -*- coding: utf-8 -*-
"""
Extrait l'inventaire des écrans (07-design/02, § 2 à 4) vers Design/inventaire-ecrans.json.

Usage :  python Specs/_outils/inventaire_figma.py

Ce fichier est la source de la synchronisation du fichier Figma (07-design/02, § 1) :
une ligne de l'inventaire = une section Figma, rangée sur la page de son espace (Site public, Espace client,
Back-office, Espace promoteur, Espace banque), dans la section de sa famille ; l'index de la page Couverture et le
sommaire de chaque page en sont tirés (Design/sync/, scripts à coller dans use_figma).
"""
import io
import json
import os
import re
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "07-design", "02-inventaire-des-ecrans.md")
OUT = os.path.join(os.path.dirname(ROOT), "Design", "inventaire-ecrans.json")

# Une page par espace ; dans chaque page, une section par famille, puis une section par ligne d'inventaire.
PAGES = ["Site public", "Espace client", "Back-office", "Espace promoteur", "Espace banque"]
FAMILIES = [  # (préfixe, premier numéro, dernier numéro, page, famille)
    ("EP", 1, 1, "Site public", "Accueil"), ("EP", 2, 3, "Site public", "Recherche"), ("EP", 31, 31, "Site public", "Recherche"), ("EP", 4, 7, "Site public", "Programmes et biens"),
    ("EP", 10, 12, "Site public", "Financement"), ("EP", 20, 21, "Site public", "Financement"),
    ("EP", 8, 9, "Site public", "Promoteurs et partenaires"), ("EP", 17, 17, "Site public", "Promoteurs et partenaires"), ("EP", 23, 23, "Site public", "Promoteurs et partenaires"), ("EP", 32, 33, "Site public", "Promoteurs et partenaires"),
    ("EP", 13, 15, "Site public", "Le Café"),
    ("EP", 16, 16, "Site public", "Découvrir et contact"), ("EP", 18, 19, "Site public", "Découvrir et contact"), ("EP", 22, 22, "Site public", "Découvrir et contact"), ("EP", 24, 24, "Site public", "Découvrir et contact"),
    ("EP", 25, 27, "Site public", "Liens reçus par e-mail"),
    ("EP", 28, 28, "Espace banque", "Téléchargement du dossier"),
    ("EP", 29, 30, "Site public", "Système"),
    ("EM", 1, 1, "Site public", "E-mails"),
    ("EC", 1, 9, "Espace client", "Compte"), ("EC", 10, 11, "Espace client", "Suivi et dossier"), ("EC", 20, 22, "Espace client", "Suivi et dossier"),
    ("EC", 12, 14, "Espace client", "Biens et rendez-vous"), ("EC", 30, 31, "Espace client", "Messages"), ("EC", 40, 54, "Espace client", "Outils et profil"),
    ("EA", 0, 9, "Back-office", "Socle et pilotage"), ("EA", 104, 106, "Back-office", "Socle et pilotage"), ("EA", 10, 13, "Back-office", "Demandes et clients"),
    ("EA", 20, 22, "Back-office", "Dossiers"), ("EA", 40, 54, "Back-office", "Catalogue et partenaires"), ("EA", 55, 64, "Back-office", "Financement et pièces"),
    ("EA", 30, 31, "Back-office", "Communication et organisation"), ("EA", 70, 76, "Back-office", "Communication et organisation"),
    ("EA", 80, 95, "Back-office", "Café, satisfaction, contenus"), ("EA", 96, 103, "Back-office", "Administration"),
]


def family(ident):
    pfx, num = ident[:2], int(re.match(r"E[PCAM]-(\d+)", ident).group(1))
    for p, a, b, page, fam in FAMILIES:
        if p == pfx and a <= num <= b:
            return page, fam
    raise SystemExit("Famille introuvable pour " + ident)


def clean(s):
    s = re.sub(r"\*\*|`", "", s).strip()
    return s.replace("'", "’")


def main():
    text = io.open(SRC, encoding="utf-8").read()
    rows = []
    for section, start, end in [("Site public", "## 2. Site public", "## 3."), ("Espace client", "## 3. Espace client", "## 4."), ("Back-office", "## 4. Back-office", "## 5.")]:
        block = text[text.index(start):text.index(end)]
        for line in block.splitlines():
            if not re.match(r"^\| E[PCAM]-\d", line):
                continue
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if section == "Back-office":
                ident, name, variants, specs, phase, livr = cells[:6]
                address = ""
            else:
                ident, name, address, variants, specs, phase, livr = cells[:7]
            ident, livr = clean(ident), clean(livr)
            first = re.match(r"(L[1-5]|Arb\.|V2)", livr)
            first = first.group(1) if first else "V2"
            rows.append({
                "id": ident,
                "name": clean(name),
                "section": ident + " · " + clean(name),
                "page": family(ident)[0],
                "family": family(ident)[1],
                "address": clean(address),
                "variants": clean(variants),
                "specs": clean(specs),
                "phase": clean(phase),
                "delivery": livr,
                "first": first,
            })
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    io.open(OUT, "w", encoding="utf-8").write(json.dumps({"pages": PAGES, "screens": rows}, ensure_ascii=False, indent=1))
    # scripts de synchronisation prêts à coller dans use_figma : un par page de livraison, et l'index de la couverture
    design = os.path.dirname(OUT)
    inv = json.dumps([[r["section"], r["page"], r["family"], r["delivery"], r["phase"], r["first"]] for r in rows], ensure_ascii=False, separators=(",", ":"))
    pages = json.dumps(PAGES, ensure_ascii=False)
    os.makedirs(os.path.join(design, "sync"), exist_ok=True)
    for f in os.listdir(os.path.join(design, "sync")):
        os.remove(os.path.join(design, "sync", f))
    tpl = io.open(os.path.join(design, "figma-sync-page.js"), encoding="utf-8").read()
    for name in PAGES:
        sub = json.dumps([[r["section"], r["page"], r["family"], r["delivery"], r["phase"], r["first"]] for r in rows if r["page"] == name], ensure_ascii=False, separators=(",", ":"))
        code = tpl.replace("__PAGES__", pages).replace("__PAGE__", json.dumps(name, ensure_ascii=False)).replace("__INV__", sub)
        io.open(os.path.join(design, "sync", "page-" + re.sub(r"[^a-z]", "-", name.lower()) + ".js"), "w", encoding="utf-8").write(code)
    idx = os.path.join(design, "figma-sync-index.js")
    if os.path.exists(idx):
        code = io.open(idx, encoding="utf-8").read().replace("__PAGES__", pages).replace("__INV__", inv)
        io.open(os.path.join(design, "sync", "index.js"), "w", encoding="utf-8").write(code)
    by = {}
    for r in rows:
        by[r["page"]] = by.get(r["page"], 0) + 1
    print(f"{len(rows)} lignes d'inventaire → {os.path.relpath(OUT, os.path.dirname(ROOT))}")
    print(" · ".join(f"{k} : {v}" for k, v in by.items()))


if __name__ == "__main__":
    main()
