# RALPH — Lot « Réalisme » (DA, modules, ponton, 2.5D)

> Fichier auto-suffisant de la ralph loop : **spec + protocole + tracker**.
> Couvre 4 cartes du kanban Notion (page « Gestion de projet ») :
> 1. **Refonte direction artistique — eau, lumière, palette** (next) → tâches R1–R3
> 2. **Redesign des modules (kickers, rails, funbox)** (next) → tâches R4–R5
> 3. **Départ du ponton — timing du start** (later) → tâches R6–R7
> 4. **Vue 2.5D — se diriger et choisir ses modules** (later) → tâches R8–R10
>
> Lancement :
> ```
> /ralph-loop:ralph-loop "Lis RALPH_REALISME.md à la racine du repo et exécute UNE SEULE tâche selon son protocole, puis stoppe. Quand TOUTES les tâches sont [x] ou ⛔ BLOCKED, réponds exactement : REALISME RALPH DONE" --max-iterations 25 --completion-promise "REALISME RALPH DONE"
> ```

## Protocole (une tâche par itération)

1. Lis ce fichier en entier. Choisis la **première** tâche `[ ]` dont toutes les dépendances sont `[x]`. Si toutes sont `[x]` ou `⛔ BLOCKED`, réponds exactement `REALISME RALPH DONE` et stoppe.
2. Lis les critères d'acceptation de la tâche ET les fichiers source concernés avant d'éditer.
3. Implémente le **MINIMUM** qui satisfait les critères. Ne touche pas aux autres tâches. Pas de gold-plating.
4. Vérifie : `npm run build` **ET** `npm test` doivent passer. En cas d'échec, corrige ; après ~3 tentatives sérieuses, `git restore .`, marque la tâche `⛔ BLOCKED <raison en une ligne>` ici, commite uniquement cette note, et stoppe.
5. Succès : UN commit atomique (`feat(scope): …` / `refactor(scope): …`), puis coche la tâche ici (`[x]` + hash court + note d'une ligne), ajoute une ligne au Journal, commite la mise à jour de ce fichier (ou amend).
6. Quand la **dernière tâche d'un LOT** passe `[x]`, ajoute au Journal : `LOT <X> livré → passer la carte Notion « <nom> » en Q&A`. Si les outils Notion MCP sont disponibles dans la session, fais-le ; sinon la note suffit.
7. Stoppe. Exactement une tâche par itération.

## Garde-fous

- **Aucun asset binaire** : toutes les textures restent générées en code (`BootScene.js`). Son uniquement via Web Audio (`audio.js`).
- **Ne jamais affaiblir ni supprimer un test existant.** Ne pas modifier les constantes de `config.js` hors du scope de la tâche en cours.
- **Préserver les mécaniques tricks existantes** : rotations 180 réalistes (frames de yaw, handle pass directionnel), Raley avec fenêtre de récupération, nose/tail press sur rails, grabs, surface spins. Toute régression visuelle ou physique sur ces mécaniques = échec de la tâche.
- La logique nouvelle doit être **pure et testée unitairement** quand c'est possible (style `physics.js` / `modules.js` / `difficulty.js`).
- 60 fps : pas d'allocation par frame évitable, réutiliser tileSprite/Graphics existants.
- Jamais committer un build cassé. Une tâche = une unité logique = build vert.

---

## LOT A — Refonte direction artistique (carte Notion « Refonte direction artistique — eau, lumière, palette »)

- [ ] **R1 — Eau vivante** — _dép : —_
  L'eau n'est plus une bande plate : dégradé de profondeur, ≥ 2 couches de reflets/scintillements animés (bandes claires qui défilent à vitesses différentes), vaguelettes de la ligne d'eau plus organiques, écume du rider plus dense à haute vitesse. Fichiers : `BootScene.js` (textures eau), `GameScene.js` (couches + animation). Critères : rendu visiblement plus riche qu'avant (comparaison via `npm run dev`), 60 fps, build+tests verts.

- [ ] **R2 — Ciel, lumière & palette** — _dép : —_
  Palette revue et centralisée (`config.js` COLORS) : ciel en dégradé multi-stops avec soleil + halo doux, nuages moins géométriques (formes composées, opacités), montagnes/collines aux teintes harmonisées. Les MOODS de `cosmetics.js` restent fonctionnels (les 3 spots donnent 3 ambiances distinctes). Critères : cohérence des teintes entre ciel/eau/décor, MOODS OK, build+tests verts.

- [ ] **R3 — Parallax enrichi (berges & végétation)** — _dép : R2_
  ≥ 1 nouvelle couche de parallax entre les collines et l'eau : berge avec végétation (arbres/roseaux procéduraux) et/ou pontons au loin, vitesse de défilement intermédiaire. Critères : profondeur perceptible, palette cohérente avec R2, aucune gêne de lisibilité du gameplay, 60 fps, build+tests verts.

## LOT B — Redesign des modules (carte Notion « Redesign des modules (kickers, rails, funbox) »)

- [ ] **R4 — Kickers crédibles** — _dép : R2_
  Refonte des textures kicker dans `BootScene.makeModuleTextures` (toutes les variantes du catalogue : simple, gros, A-frame, double…) : panneaux composites visibles, structure porteuse, flotteurs à la ligne d'eau, ombre portée sur l'eau, lip contrasté. `modules.js` (géométrie, hitbox, offsets) **inchangé**. Critères : silhouette triangle immédiatement lisible, cohérent DA, build+tests verts.

- [ ] **R5 — Rails & funbox crédibles** — _dép : R4_
  Même traitement pour rails/box/kink/down-slide : tube ou arête métallique brillante, structure + flotteurs, panneaux latéraux colorés pour les box. Critères : à pleine vitesse on distingue kicker (triangle) / rail (ligne) / box (bloc) ~2 s avant de les atteindre ; `modules.js` inchangé ; build+tests verts.

## LOT C — Départ du ponton (carte Notion « Départ du ponton — timing du start »)

- [ ] **R6 — État DOCK & séquence de départ (visuel)** — _dép : R3_
  Nouvel état `DOCK` avant `RIDE` au lancement d'un run : ponton visible à gauche, rider posé dessus, le trolley arrive depuis la gauche et la corde se tend progressivement (le mou se résorbe visuellement). SPACE/tap déclenche le saut → transition vers `RIDE` (pas encore d'échec : fenêtre en R7). Le timer de run (90 s) ne démarre qu'au saut. Critères : machine d'états propre (constante `DOCK` comme RIDE/AIR/GRIND/WIPEOUT), HUD inchangé pendant le dock, build+tests verts.

- [ ] **R7 — Fenêtre de timing du start** — _dép : R6_
  Fonction pure dans `physics.js` : `dockStartOutcome(tJump, tTaut, windows) → 'early' | 'perfect' | 'ok' | 'late'`, testée unitairement. Branchement : trop tôt = plouf comique (splash, le rider recommence sur le ponton en ~1 s, pas de wipeout compté), parfait = boost de vitesse + « Perfect Start ! » + points (`PTS_PERFECT_START` dans config), ok = départ normal, trop tard = arraché vers l'avant → wipeout. Jauge HUD de tension de corde pendant le dock. Critères : 4 issues jouables et lisibles, tests unitaires de la fenêtre, build+tests verts.

## LOT D — Vue 2.5D (carte Notion « Vue 2.5D — se diriger et choisir ses modules »)

- [ ] **R8 — Prototype lanes (rendu + steering)** — _dép : R4, R5_
  3 lanes (proche/milieu/loin) : nouveau module pur `src/lanes.js` (offsets Y, échelles, interpolation de transition) testé unitairement. Steering : flèches ↑/↓ **au sol sur l'eau uniquement** (en l'air elles restent aux rotations ; sur un rail les presses gardent la priorité — on ne change pas de lane en grind). Le rider glisse d'une lane à l'autre avec interpolation fluide (échelle + Y), spray/ombre suivent. AUCUN module concerné à ce stade. Critères : changement de lane fluide, tricks non affectés, tests lanes verts, build+tests verts.

- [ ] **R9 — Modules par lane (viser / éviter)** — _dép : R8_
  Chaque module spawne sur une lane (pondération dans `modules.js` ou au spawn), rendu à l'échelle de sa lane, interaction (kicker/rail) seulement si le rider est sur la même lane au moment du contact. Critères : on peut viser un module en changeant de lane et en éviter un autre ; logique lane-collision pure et testée ; pas de régression sur les composites ; build+tests verts.

- [ ] **R10 — Équilibrage & lisibilité 2.5D** — _dép : R9_
  Densité de spawn ajustée via `difficulty.js` pour ne jamais bloquer les 3 lanes simultanément (propriété testée unitairement) ; indication visuelle de la lane du prochain module (contraste/marqueur) ; vérification manuelle rapide du feel (`npm run dev`). Critères : test « jamais 3 lanes bloquées », lisibilité OK, suite complète verte.

---

## Journal
<!-- Une ligne par tâche terminée :
- R1 ✅ <hash> — note d'une ligne.
- R4 ⛔ BLOCKED <raison>.
- LOT A livré → passer la carte Notion « Refonte direction artistique — eau, lumière, palette » en Q&A.
-->
