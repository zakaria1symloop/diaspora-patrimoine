# Pièges de l'outil Figma (`use_figma`) rencontrés sur ce projet

> Appris en construisant le système de design et les écrans de Diaspora Patrimoine avec le serveur MCP de Figma. Ce
> que la documentation officielle ne dit pas. Lire aussi `Design/figma-ledger.json` (identifiants de nœuds, clés de
> propriétés, bouts de code réutilisables) avant de toucher au fichier.

1. Les cadres créés par `figma.createAutoLayout()` ont un **fond blanc plein** par défaut : vider `fills = []` (ou lier
   un jeton) sur chaque cadre d'enveloppe, sinon des boîtes blanches recouvrent les sections colorées.
2. `setBoundVariableForPaint` : passer la **couleur résolue du jeton** comme couleur de repli, pas du noir (sinon les
   captures côté serveur montrent des boutons noirs).
3. Ne jamais modifier les enfants d'une instance imbriquée **masquée** : afficher → modifier → masquer.
4. Ordre qui marche pour un texte qui passe à la ligne : créer → `characters` → `appendChild` →
   `textAutoResize='HEIGHT'` → `layoutSizingHorizontal='FILL'`. Un `resize()` après `HEIGHT` le remet à `NONE`.
5. `instance.resetOverrides()` remet aussi le nom et les échanges d'instance : ne pas s'en servir pour les couleurs.
6. Noms de graisses : vérifier avec `listAvailableFontsAsync()` (« SemiBold » ou « Semi Bold » selon la police).
7. `findOne` par nom peut tomber sur un cadre homonyme d'un texte : filtrer par `type`. Un rappel qui lit
   `.characters` doit vérifier `n.type === 'TEXT'`, sinon tout le script s'arrête.
8. `component.clone()` ne garde pas `componentPropertyReferences` des enfants : recâbler après clonage.
9. Changer une variante et un texte dans le même `setProperties` remet le texte par défaut : deux appels.
10. L'opacité d'un remplissage ne se propage pas toujours aux instances : préférer une variable de couleur avec alpha.
11. `vectorPaths` n'accepte que des commandes absolues `M L C Q Z`.
12. Dessiner dans une rangée auto-layout avant que ses voisins existent donne de mauvaises largeurs : dessiner après.
13. `getRangeAllFontNames(0, 0)` échoue sur un texte vide.
14. Playfair Display dessine des chiffres elzéviriens et les fonctions OpenType sont en lecture seule.
15. La session OAuth du MCP Figma peut expirer : seuls `authenticate` / `complete_authentication` restent ; donner
    l'adresse à Zakaria et préparer le reste en attendant.
16. Une carte `FILL` en hauteur dont le panneau intérieur est aussi `FILL` s'écrase : passer en `HUG`, puis revenir à
    `FILL` pour égaliser les hauteurs.
17. `createNodeFromSvg` + `createComponentFromNode` construit bien un jeu d'icônes ; `instance.rescale(taille/24)`.
18. `saveVersionHistoryAsync` et `setFileThumbnailNodeAsync` ne sont pas pris en charge : exporter des PNG avant un
    travail destructif ; la vignette se règle à la main.
19. Un nœud cloné garde `layoutAlign` / `layoutGrow` de son ancien parent : remettre `INHERIT`, `0`, `FIXED`, puis
    `resize`.
20. `node.clone()` atterrit sur la page courante : `await page.loadAsync()` puis `page.appendChild(node)`.
21. Les surcharges de couleur d'icône ne survivent pas à un échange d'instance : couleur par **modes** de la collection
    « Icônes » posés sur le conteneur.
22. La valeur par défaut d'une propriété TEXT ou INSTANCE_SWAP s'applique à **toutes** les variantes qui la
    référencent : laisser non lié le calque d'une variante qui doit différer.
