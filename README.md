# 🌊 Cable Rush

A 2.5D wakeboard **cable-park** trick game — _Tony Hawk's Pro Skater_ meets _OlliOlli_, on water.
You're towed around a lake by an overhead cable, hitting kickers and sliders, stringing
together flips, spins, grabs and grinds into the biggest combo you can land.

Built with **Phaser 3 + Vite**. Every graphic is generated procedurally (no asset files yet),
so it runs instantly — drop in real art later.

## Run it

```bash
npm install
npm run dev
```

Then open the printed **Local** URL in a browser. To play on your phone, open the **Network**
URL (e.g. `http://192.168.x.x:5173`) on a device on the same Wi‑Fi.

> ⚠️ The in-editor preview panel can't display the game (it renders the tab hidden, so the
> browser pauses the animation loop). Open it in a **real, visible browser tab** and it runs.

```bash
npm run build      # production build into dist/
npm run preview    # serve the build
```

## Controls

| Action | Touch | Keyboard |
| --- | --- | --- |
| Pop / ollie (on water or rail) | **tap** | `Space` |
| Flip — backroll / frontroll | **swipe ↑ / ↓** | `↑` / `↓` |
| Spin — backside / frontside | **swipe ← / →** | `←` / `→` |
| Grab (hold, release before landing!) | **hold** | `Shift` |

**The golden rule:** land _upright_. Your rotation has to come back near a clean angle when
you touch the water, or you wipe out and lose your combo. Time a tap right at a kicker's lip
for a **Perfect Pop** and bigger air. Land on a slider to **grind** for free points.

## How it works

| File | Role |
| --- | --- |
| `src/config.js` | All gameplay tuning — speeds, gravity, pop power, scoring, tolerances. Start here to tweak the feel. |
| `src/main.js` | Phaser bootstrap, scale handling. |
| `src/scenes/BootScene.js` | Generates every texture procedurally (rider, kicker, rail, water, hills…). |
| `src/scenes/GameScene.js` | Core loop: world scroll, feature spawning, trick physics, combo & scoring. |
| `src/scenes/HudScene.js` | Score, combo multiplier, trick popups, speed bar, messages. |

The rider stays at a fixed screen X; the world scrolls past. Features (kickers, sliders) live
in world space and are recycled as they leave the screen. Tricks accumulate rotation and grab
time mid-air; a clean landing banks the points × a combo multiplier that grows each trick and
decays when you ride flat.

## Roadmap ideas

- Real art & animation (swap the procedural textures for sprites / spritesheets)
- More modules: A-frames, kink rails, double-ups, the rounding-the-lake corners
- Trick variety: tantrums, whirlybirds, board grabs by direction, manuals/surface tricks
- Sound: cable hum, water spray, trick whooshes, music
- Progression: missions ("land a Backroll over the kicker"), unlockable parks & boards
- Online leaderboards (a Vercel function + a managed Postgres/Redis would slot in cleanly)
- Package as a native app with **Capacitor** for the App Store / Play Store
# wake
