# PROGRESS — Cable Rush « Playable v1 »

> Tracker de la **ralph loop**. Source de vérité de l'avancement.
> À chaque itération : choisir la 1ʳᵉ tâche `[ ]` dont les **dépendances** sont `[x]`,
> l'implémenter, vérifier (`npm run build` + `npm test`), committer, puis **cocher ici**
> avec le hash de commit court + une note d'une ligne.
> Spec complète et critères d'acceptation : voir **[PRD.md](PRD.md)**.

## Règles rapides
- Build vert **obligatoire** avant chaque commit. Jamais committer un build cassé.
- Un commit atomique par tâche.
- Si bloqué après ~3 tentatives → `git restore .`, marquer `BLOCKED` + note, passer à la suite.
- Ne pas démarrer une tâche dont une dépendance est `BLOCKED`.
- Priorité cœur de la demande : **T1, T2, T4, T5, T6**.

## Tâches

- [x] **T1** — vitest + extraction physique pure (`src/physics.js` + tests) — _dép : —_ — `e5c4391` physics.js pur extrait de GameScene, 15 tests verts, build OK.
- [x] **T2** — Boucle Menu → Game → Game Over + run chronométré (90 s) — _dép : —_ — `3f05d59` MenuScene + GameOverScene, timer 90 s, HUD temps, Boot→Menu.
- [x] **T3** — Meilleur score persistant (`localStorage`, `src/storage.js`) — _dép : T2_ — `959b91a` storage.js + badge record, 8 tests.
- [x] **T4** — Rotations glissées au sol (eau/kicker/slide) sans wipeout — _dép : T1_ — `a757ba1` surface spins RIDE/GRIND, wipeout AIR→eau seul, +6 tests.
- [x] **T5** — Système de modules data-driven (`src/modules.js`, refactor sans régression) — _dép : T1_ — `3e8c8c5` catalogue + pickModule/footprint, kicker/rail inchangés, 6 tests.
- [x] **T6** — Catalogue ≥ 10 obstacles dont composites (slide→kicker, kicker→slide…) — _dép : T5, T4_ — `a1e2871` 11 types, composites segmentés, textures procédurales, nextSegment, 12 tests modules.
- [x] **T7** — Courbe de difficulté progressive (`src/difficulty.js`) — _dép : T1, T5_ — `af34ed0` difficultyForElapsed (vitesse/gaps/mix), 7 tests.
- [ ] **T8** — Son synthétisé Web Audio (`src/audio.js`) + mute — _dép : T2_
- [ ] **T9** — Grabs directionnels (Indy/Method/Stalefish/Nose/Tail) — _dép : T1_
- [ ] **T10** — Indicateur de rotation HUD — _dép : T1, T2_

## Journal
<!-- L'agent ajoute une ligne par tâche terminée :
- T1 ✅ <hash> — vitest ajouté, physics.js extrait, 9 tests verts.
- T6 ⛔ BLOCKED <raison>.
-->
- T1 ✅ e5c4391 — vitest ajouté, physics.js (5 fns pures) extrait de GameScene, 15 tests verts, build OK.
- T2 ✅ 3f05d59 — boucle Menu→Game→GameOver, run chronométré 90 s, HUD affiche le temps, Boot démarre sur Menu.
- T3 ✅ 959b91a — storage.js (localStorage, fallback gracieux), badge « NOUVEAU RECORD ! », meilleur affiché Menu+GameOver, 8 tests.
- T4 ✅ a757ba1 — surface spins (eau/kicker/slide) en RIDE/GRIND, flips ignorés hors air, points/feed « Surface N », continuité au pop, wipeout AIR→eau uniquement. 29 tests au total.
- T5 ✅ 3e8c8c5 — modules.js data-driven (segments ride-up/grind), pickModule/moduleFootprint, spawnFeature + BootScene consomment le catalogue, kicker/rail sans régression. 35 tests au total.
- T6 ✅ a1e2871 — 11 types d'obstacles (dont slide→kicker, kicker→slide, A-frame, double kicker, down-slide, kink, gros slide, flat box), spawn par segment réutilisant la physique kicker/rail, textures procédurales depuis le catalogue, nextSegment. 41 tests au total.
- T7 ✅ af34ed0 — difficulty.js : vitesse croissante (≤ MAX_SPEED), gaps qui se resserrent (≥ floor), mix de modules qui se durcit (composites tardifs), branché sur GameScene + pickModule. 48 tests au total.
