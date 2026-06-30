# PRD — Cable Rush : « Playable v1 »

> Document de référence pour une **ralph loop** autonome (run de nuit, sans supervision).
> L'agent lit ce PRD + `PROGRESS.md` à chaque itération, choisit la prochaine tâche,
> l'implémente, la **vérifie**, **commit**, coche la case, et recommence.
>
> **Lire en premier : [§ Protocole de la loop](#protocole-de-la-loop) et [§ Garde-fous](#garde-fous).**

---

## Problem statement

Cable Rush est un prototype jouable (physique de trick, combos, rendu procédural complet) mais **ce n'est pas encore un jeu** : pas de début, pas de fin, pas d'enjeu persistant. On démarre directement dans une session infinie sans score final, sans meilleur score, sans son. Le gameplay manque aussi de **variété d'obstacles** (un seul kicker, un seul rail) et de **profondeur de trick** (la rotation n'existe qu'en l'air ; impossible de tourner au sol).

Ce PRD transforme le proto en **boucle de jeu complète et riche** : `Menu → Run chronométré → Game Over → meilleur score`, avec ≥10 types d'obstacles (dont des composites), des rotations glissées au sol, du son et une difficulté croissante — le tout en gardant le build instantané et 100 % procédural.

## Goals

1. **Boucle fermée** : lancer un run, le terminer, voir score + meilleur score, relancer — sans recharger la page.
2. **Rejouabilité** : un meilleur score persiste entre sessions (`localStorage`) et est mis en avant.
3. **Variété d'obstacles** : ≥ **10 types** de modules, dont des **composites** (slide→kicker, kicker→slide), des gros slides, A-frames, etc., spawnés de façon variée.
4. **Rotations glissées** : on peut tourner (spins) **sur l'eau, sur les kickers et sur les slides sans tomber**. Seul un **atterrissage aérien en pleine rotation** (pas upright) fait wipeout.
5. **Feedback sensoriel** : chaque action clé (pop, atterrissage, wipeout, palier de combo) produit un son synthétisé.
6. **Profondeur de trick** : variété de grabs ≥ 5 (Indy/Method/Stalefish/Nose/Tail) + difficulté croissante avec la durée du run.
7. **Lisibilité** : un indicateur de rotation aide à juger l'atterrissage « upright ».
8. **Vérifiabilité** : la logique de jeu (physique, scoring, naming, catalogue de modules) est extraite dans des modules purs **couverts par des tests** — condition nécessaire pour qu'un agent autonome valide son travail sans playtest visuel.

## Non-goals

1. **Pas de vrai art / sprites** — 100 % procédural, aucun asset binaire (images). Les nouveaux modules sont dessinés par code dans `BootScene`.
2. **Pas de leaderboard en ligne** — backend/Postgres/Redis = phase ultérieure. On se limite au `localStorage`.
3. **Pas de refonte du moteur de rendu du rider** — le rig procédural existant est conservé.
4. **Pas de portage natif (Capacitor)** — phase ultérieure.
5. **Pas de virages / coins de lac** ni de mode multijoueur — hors périmètre.

---

## Garde-fous

Contraintes **non négociables** pour l'agent autonome (choix de l'auteur) :

- 🔴 **Le build ne doit JAMAIS casser.** Une tâche n'est « terminée » que si `npm run build` **et** `npm test` passent. Si l'agent ne parvient pas à faire passer le build après des tentatives raisonnables, il **annule** ses changements pour cette tâche (`git restore .`), la marque `BLOCKED` dans `PROGRESS.md` avec une note, et passe à la suivante. **Ne jamais committer un build cassé.**
- 🔊 **Son uniquement synthétisé** via la Web Audio API (oscillateurs / bruit). **Aucun fichier audio** (`.mp3`, `.wav`, `.ogg`).
- 🎨 **Pas d'asset binaire ajouté** au repo. Toute texture supplémentaire est générée par code dans `BootScene`.
- 📦 **Dépendances** : `vitest` (test runner) est **autorisé et attendu** (T1). Aucune autre dépendance runtime sans justification forte écrite dans le commit.
- 🧩 **Un commit atomique par tâche.** Jamais bundler plusieurs tâches.
- ✅ **Ne jamais affaiblir/supprimer un test existant** pour faire passer le build.
- 🎚️ **Rétro-compatibilité du feel** : ne pas modifier les constantes de `config.js` hors du périmètre d'une tâche.

---

## Stratégie de vérification (IMPORTANT pour un agent sans yeux)

⚠️ Le preview en onglet caché **met `requestAnimationFrame` en pause** (cf. README) : un agent autonome **ne peut pas playtester le jeu visuellement** de façon fiable. La vérification repose donc sur :

1. **`npm run build`** — doit réussir (pas d'erreur de bundling / d'import).
2. **`npm test`** (vitest) — toute la logique extraite est testée. **C'est le filet de sécurité principal.**
3. **Auto-revue de code** — relire le diff contre les critères d'acceptation.
4. *(best-effort)* **smoke test headless** : importer les modules purs et simuler quelques frames pour vérifier qu'aucune exception n'est levée.

C'est la raison d'être de **T1** : sans modules purs testables, les tâches suivantes ne sont pas vérifiables. **T1 doit être faite en premier.**

---

## Protocole de la loop

À **chaque itération**, l'agent :

1. **Lit `PROGRESS.md`.** Choisit la **première tâche non cochée** dont **toutes les dépendances** sont cochées.
2. **Relit la spec de la tâche** dans ce PRD (« Work queue »).
3. **Implémente le minimum** pour satisfaire les critères d'acceptation. Pas de hors-périmètre.
4. **Vérifie** : `npm run build` puis `npm test`. Les deux doivent passer.
   - Échec → corrige. Toujours bloqué après ~3 tentatives → `git restore .`, marque `BLOCKED` + note, passe à la suivante.
5. **Commit atomique** (`feat(scope): …` / `test(scope): …` / `refactor(scope): …`).
6. **Met à jour `PROGRESS.md`** : coche la case + **hash court** + note d'une ligne.
7. **Recommence** jusqu'à toutes tâches cochées ou bloquées.

**Règles d'or** : une tâche = un commit = build vert. Ne pas démarrer une tâche dont une dépendance est `BLOCKED`. Préférer 5 tâches solides à 10 bancales.

---

## Work queue

Ordre conçu pour minimiser le risque sans vérification visuelle : fondation testable d'abord, puis ossature de la boucle + modèle de trick, puis le système de modules, puis les ajouts additifs. **Même un run partiel (T1→T5) doit laisser un jeu jouable et amélioré.**

### T1 — Harness de test + extraction de la physique pure  ⟵ **FAIRE EN PREMIER**
**Dépend de :** —

- Ajouter `vitest` en devDependency + script `"test": "vitest run"` dans `package.json`.
- Créer `src/physics.js` exportant des **fonctions pures** (zéro Phaser), extraites de `GameScene` **sans changer le comportement** :
  - `landingError(flipDeg, spinDeg)` → `{ flipErr, spinErr }`.
  - `isCleanLanding(flipErr, spinErr, flipTol, spinTol)` → `boolean`.
  - `countRotations(flipDeg, spinDeg)` → `{ flips, spins }`.
  - `scoreLanding({ flips, spins, pending, multiplier })` → points.
  - `buildTrickName({ flipDeg, spinDeg, extras })` → string|null.
- `GameScene` **importe** ces fonctions au lieu de dupliquer le calcul. Feel identique.
- `src/physics.test.js` : atterrissage clean dans la tolérance, wipeout hors tolérance, comptage flips/spins (incl. multiples), score avec multiplicateur, naming (rien / 1 flip / spin+flip / extras).

**Acceptation :**
- [ ] `npm run build` passe ; `npm test` passe avec ≥ 8 cas.
- [ ] `GameScene` n'embarque plus sa copie de ces calculs.
- [ ] Aucune constante de `config.js` modifiée.

---

### T2 — Boucle de scènes : Menu → Game → Game Over
**Dépend de :** —

- `src/scenes/MenuScene.js` : titre « CABLE RUSH », prompt « TAP / SPACE pour rider », affiche le meilleur score (placeholder « -- » avant T3). Tap/Space → `Game`.
- `src/scenes/GameOverScene.js` : « RUN TERMINÉ », score final, meilleur score (placeholder avant T3), prompt « TAP pour rejouer » → run propre ; option « Menu ».
- **Fin de run** : timer time-attack. Ajouter `RUN_DURATION = 90` (s) dans `config.js`. `GameScene` décompte ; à 0 → `GameOver` avec le score (`scene.start("GameOver", { score })`).
- `main.js` : enregistrer les scènes ; démarrer sur `Menu` (plus d'auto-start direct de `Game`). `Hud` reste l'overlay du `Game`.
- `HudScene` : afficher le **temps restant**.
- Un wipeout **ne termine pas** le run (comportement actuel conservé).

**Acceptation :**
- [ ] `npm run build` + `npm test` passent.
- [ ] Démarrage sur Menu ; Tap lance le run ; timer décompte ; à 0 → Game Over (bon score) ; Tap → nouveau run à 0.

---

### T3 — Meilleur score persistant (localStorage)
**Dépend de :** T2

- `src/storage.js` : `loadBest()` / `saveBestIfHigher(score)` → `{ best, isNewBest }`, garde si `localStorage` indisponible. Clé `cable-rush:best`.
- `GameOverScene` : `saveBestIfHigher(score)` à l'entrée ; badge « NOUVEAU RECORD ! » si `isNewBest`. Afficher le meilleur.
- `MenuScene` : afficher le meilleur via `loadBest()`.
- `src/storage.test.js` : nouveau record, score inférieur, stockage absent (mock).

**Acceptation :**
- [ ] `npm run build` + `npm test` passent.
- [ ] Le meilleur persiste après reload ; nouveau record détecté ; pas de crash sans `localStorage`.

---

### T4 — Rotations glissées (surface spins à plat, sans wipeout)
**Dépend de :** T1

Cœur du gameplay : on peut tourner **à plat** au sol et sur les modules en sécurité ; seul l'atterrissage aérien non-upright fait tomber.

- **Spins à plat UNIQUEMENT au sol/sur module** : seuls les **spins** (yaw : 180, 360, 540…) sont possibles en `RIDE` et `GRIND`. **PAS de flips** (rolls verticaux) hors de l'air. Un flick **vertical** (geste de flip) est **ignoré** quand on n'est pas en `AIR`.
- Les surface spins fonctionnent sur **l'eau, les kickers (ride-up) ET les slides** — c.-à-d. dans `RIDE` (y compris `rampT > 0`) et `GRIND`. Les flips restent strictement réservés à `AIR`.
- En `RIDE`/`GRIND`, le spin **s'intègre et accumule des points/combo** (`PTS_PER_SPIN` via une logique « surface spin », par tranche de 180°) **sans jamais déclencher de wipeout**.
- Le wipeout reste **uniquement** déclenché dans `evaluateWaterLanding` (transition `AIR` → eau) : atterrir en pleine rotation ou en tenant un grab = chute. Au sol, jamais.
- Le `spinDeg` accumulé au sol **se reporte** dans l'air si on pop pendant une rotation (continuité).
- Ajouter des constantes dédiées dans `config.js` (p. ex. `PTS_SURFACE_SPIN_PER_180`, et un éventuel `SURFACE_SPIN_IMPULSE`).
- Nommage : un spin de surface complété apparaît dans le feed (« Surface 180/360 »), via `buildTrickName`/extras.
- Tests dans `physics.test.js` : un helper pur (p. ex. `surfaceSpinPoints(spinDelta)`) ; vérifier qu'aucun chemin de wipeout n'existe depuis une rotation au sol (test sur la règle, pas Phaser).

**Acceptation :**
- [ ] `npm run build` + `npm test` passent.
- [ ] Tourner sur l'eau / un kicker / un slide n'entraîne **jamais** de wipeout.
- [ ] Atterrir (depuis l'air) en pleine rotation entraîne toujours un wipeout.
- [ ] Le spin de surface marque des points et apparaît dans le nom du trick.

---

### T5 — Système de modules data-driven (refactor, sans régression)
**Dépend de :** T1

Préparer le terrain pour ≥10 types sans dupliquer du code dans `spawnFeature`.

- Créer `src/modules.js` : un **catalogue déclaratif** de modules. Chaque entrée décrit `type`, géométrie (largeur, hauteur de surface, lip…), texture(s) à utiliser, et **segments** (un module peut enchaîner des segments : `ride-up`, `grind`, `lip`, `flat`…). Au minimum, réexprimer les deux modules actuels (`kicker`, `rail`) dans ce format **sans changer le comportement**.
- `GameScene.spawnFeature` consomme le catalogue ; `BootScene` génère les textures décrites par le catalogue.
- Fonctions pures testables : `pickModule(rng, difficulty)`, `moduleFootprint(def)` (largeur totale).
- `src/modules.test.js` : le catalogue est valide (champs requis), `moduleFootprint` correct, `pickModule` respecte les poids.

**Acceptation :**
- [ ] `npm run build` + `npm test` passent.
- [ ] Comportement de spawn inchangé pour kicker + rail (mêmes dimensions/positions qu'avant).
- [ ] Le catalogue et les helpers sont testés.

---

### T6 — Catalogue d'obstacles : ≥ 10 types (dont composites)
**Dépend de :** T5, T4

Étendre le catalogue de T5 à **≥ 10 modules distincts**, dont des composites. Cible :

1. Kicker (small) — existant
2. Kicker (big) — lip plus haut
3. Slide / box standard — existant
4. **Gros slide** (long, plus haut)
5. **Slide → kicker** (on grinde puis on est lancé par un lip en fin de rail)
6. **Kicker → slide** (on pop puis on atterrit sur un rail pour grinder)
7. **A-frame** (kicker montant + face descendante)
8. **Double kicker** (deux kickers rapprochés avec un gap)
9. **Down-slide / rail incliné** (surface descendante)
10. **Kink / rainbow rail** (rail à cassure ou bombé)
11. *(bonus)* **Flat box large** (longue surface de surface-spin)

- Implémenter la **logique de ride/transition** pour les composites : enchaîner grind→lip→air, ou air→atterrissage sur rail→grind, via les `segments` du module (T5).
- Générer les **textures procédurales** correspondantes dans `BootScene` (dessins par code, aucun asset).
- Étendre `pickModule` pour mixer les types (poids par difficulté, cf. T7).
- Tests : chaque type présent dans le catalogue ; `moduleFootprint` correct pour les composites ; transitions de segments cohérentes (helper pur, p. ex. `nextSegment(def, t)`).

**Acceptation :**
- [ ] `npm run build` + `npm test` passent.
- [ ] ≥ 10 types distincts spawnables ; les composites slide→kicker et kicker→slide fonctionnent (grind puis pop ; pop puis grind).
- [ ] Aucun asset binaire ajouté ; textures générées par code.

---

### T7 — Courbe de difficulté progressive
**Dépend de :** T1, T5

- `src/difficulty.js` (pur) : `difficultyForElapsed(elapsedSec)` → `{ speedTarget, gapMin, gapMax, moduleWeights }`. La vitesse croît de `BASE_SPEED` vers ~`MAX_SPEED` ; les gaps se resserrent ; le mix de modules se durcit (plus de composites tard dans le run).
- `GameScene` utilise cette sortie (récupération après bail relative à la cible courante) ; `pickModule` reçoit les poids.
- `src/difficulty.test.js` : monotonie de la vitesse (bornée `MAX_SPEED`), gaps bornés (`SPAWN_GAP_MIN`), somme des poids valide.

**Acceptation :**
- [ ] `npm run build` + `npm test` passent.
- [ ] Vitesse croissante, jamais > `MAX_SPEED` ; gaps ≥ borne min ; mix de modules évolue avec le temps.

---

### T8 — Son synthétisé (Web Audio)
**Dépend de :** T2

- `src/audio.js` : synth (un `AudioContext`, oscillateurs + bruit filtré) exposant `play(name)` pour `pop`, `perfectPop`, `land`, `wipeout`, `comboUp`, `grind`, `surfaceSpin`, + un `cableHum` en boucle basse pendant le ride. **Aucun fichier audio.**
- `resume()` du contexte au premier geste utilisateur (contrainte navigateur).
- Toggle **mute** (touche `M`, persistant via `storage.js`), exposé au Menu.
- Branchement sur les événements existants (`pop` parfait, `land`, `wipeout`, `combo`, `grind`, surface spin).

**Acceptation :**
- [ ] `npm run build` passe ; aucun accès `AudioContext` avant geste utilisateur (revue de code).
- [ ] `npm test` passe (tester la logique mute/sélection si extractible en pur).
- [ ] Le toggle mute coupe tout et persiste.

---

### T9 — Grabs directionnels
**Dépend de :** T1

- La **direction maintenue** pendant l'air sélectionne le grab. Mapping pur `grabName(dirX, dirY)` → `"Indy" | "Method" | "Stalefish" | "Nose" | "Tail" | "Mute"` (défaut `Indy`).
- Le nom choisi remplace le « Indy Grab » en dur dans `trickParts`. Optionnel : `GRAB_MULT[name]` dans `config.js`.
- Règle « relâcher avant l'atterrissage sinon wipeout » inchangée.
- Tests `physics.test.js` : chaque direction → bon nom ; ambigu → `Indy`.

**Acceptation :**
- [ ] `npm run build` + `npm test` passent.
- [ ] Grab nommé selon la direction ; défaut `Indy` ; règle de relâche conservée.

---

### T10 — Indicateur de rotation (HUD)
**Dépend de :** T1, T2

- Dans `HudScene`, un petit cadran/arc visible **uniquement en l'air**, montrant l'écart de rotation au plus proche « upright ». **Vert** dans la tolérance, **rouge** sinon.
- `GameScene` émet `rotation` `{ flipErr, spinErr, ok }` calculé via `physics.js`.
- Masqué hors état `air`.

**Acceptation :**
- [ ] `npm run build` + `npm test` passent.
- [ ] L'indicateur apparaît en l'air, reflète l'écart, vire au vert dans la tolérance, disparaît à l'atterrissage.

---

## Success metrics (vérifiables par l'agent)

Leading :
- ✅ `npm run build` vert sur le commit final.
- ✅ `npm test` vert, **≥ 20 cas** au total à la fin du run.
- ✅ ≥ 6 des 10 tâches `DONE` (cible : 10/10) ; **T1, T2, T4, T5, T6 sont prioritaires** (boucle + variété + rotations glissées = le cœur de la demande).
- ✅ ≥ 10 types d'obstacles dans le catalogue ; aucun asset binaire ajouté.

Lagging (revue humaine au matin) :
- Boucle Menu → Run → Game Over sans recharger ; meilleur score persistant.
- Variété d'obstacles et rotations glissées rendent le jeu nettement plus riche.
- Son et indicateur de rotation améliorent lisibilité et satisfaction.

## Open questions (non bloquantes — défaut décidé pour ne pas bloquer la loop)

- **Durée de run** : **90 s** (confirmé).
- **Fin sur wipeouts** : v1 = le run ne finit pas sur wipeout (timer seul). Variante « 3 wipeouts = fin » → parking lot.
- **Flips au sol** : ✅ tranché — **uniquement des spins à plat** (180/360…) au sol et sur les modules ; **aucun flip** hors de l'air.
- **Score différentiel par grab/surface** : optionnel ; si flou, garder un score identique et varier seulement le nom.

## Parking lot (hors périmètre)

Leaderboard en ligne · virages/coins de lac · manuals avancés · vrai art & animations · screen shake / hit-stop · pré-charge de rotation · portage Capacitor · « 3 wipeouts = fin ».
