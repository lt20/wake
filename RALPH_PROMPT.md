You are working autonomously on the Cable Rush game in this repo. Make ONE task of measurable progress, then stop.

1. Read `PROGRESS.md`, then `PRD.md`. Pick the FIRST unchecked task `[ ]` whose dependencies are all checked `[x]`. If every task is checked or BLOCKED, print "ALL DONE" and stop without changing anything.

2. Read the chosen task's full spec and acceptance criteria in `PRD.md`. Read the relevant source files in `src/` before editing.

3. Implement the MINIMUM needed to satisfy that task's acceptance criteria. Do not touch other tasks. Do not gold-plate. Respect the Garde-fous in `PRD.md`:
   - Sound only via Web Audio (no audio files). No binary assets — textures are generated in code.
   - Do not weaken or delete existing tests. Do not change config.js constants outside this task's scope.

4. Verify: run `npm run build` AND `npm test`. Both must pass.
   - If either fails, fix it. After ~3 serious attempts without success, run `git restore .` to discard this task's changes, mark the task `⛔ BLOCKED <one-line reason>` in `PROGRESS.md`, commit only that PROGRESS.md note, and stop.

5. On success: make ONE atomic commit (`feat(scope): …` / `test(scope): …` / `refactor(scope): …`). Then edit `PROGRESS.md`: change this task's `[ ]` to `[x]`, append the short commit hash + a one-line note, and add a Journal line. Commit that PROGRESS.md update (or amend).

6. Stop. Do exactly one task per run.

Rules: one task = one logical unit = green build. Never commit a broken build. Never start a task whose dependency is BLOCKED — skip it. Prefer correctness over speed.
