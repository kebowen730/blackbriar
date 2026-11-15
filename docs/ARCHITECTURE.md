# BLACKBRIAR — architecture & module contracts

First-person night-forest survival horror. You are lost in Blackbriar Forest. Light the 5
**wardstones** to bring the dawn. Up to 12 cryptids hunt you, each with its own hunting
pattern. You cannot fight: run, crouch, hide, switch off your light, throw rocks / fire a
slingshot to make noise elsewhere. Shining the flashlight on a creature identifies it
(name + lore card) and adds it to the journal.

## Stack / hard rules

- Three.js `0.187` (`import * as THREE from 'three'`, addons from `three/addons/...`), Vite, **plain JS ES modules** (no TS, no frameworks, no extra npm deps).
- **No external assets.** All geometry, textures (canvas / DataTexture) and audio (WebAudio synthesis) are procedural.
- Must run light: target 60 fps on an integrated GPU. Budget: < 250 draw calls, < 600k triangles on screen. Use `InstancedMesh`, merged geometry, shared materials. Only ONE shadow-casting light exists (the flashlight spotlight, 1024 map). Never add other shadow casters lights. Keep point lights to a minimum (≤ 6 in the scene total, none casting shadows).
- Units are meters, Y is up. Ground height comes from `world.heightAt(x, z)`.
- Yaw convention: `yaw = Math.atan2(dx, dz)`; a model with `rotation.y = yaw` faces direction `(sin yaw, 0, cos yaw)`. **Creature models face +Z** with origin at the feet.
- The scene is very dark: near-black blue fog (`FogExp2`), faint moonlight. Things are mostly seen by flashlight. Emissive eyes read in the dark.
- Do NOT run `npm install`, `vite`, `vite build` or a dev server (other agents are writing sibling modules at the same time and the build will not resolve yet). Verify your files with `node --check <file>` only.
- Only create/edit the files assigned to you. Do not touch `src/main.js`, `index.html`, `package.json`, or other agents' folders.
- Every module must be defensive: optional-chain other subsystems (`ctx.audio?.play(...)`) so a missing sibling never throws.

## Layout

```
index.html                 <canvas id="game">, <div id="ui-root">           (lead)
src/main.js                bootstrap, loop, state machine, objectives       (lead)
src/core/bus.js            event emitter                                    (done)
src/core/rng.js            seeded rng + value noise / fbm                   (done)
src/data/creatures.js      lore + tuning data for the 12 creatures          (UI agent)
src/world/index.js         createWorld(ctx, opts)                           (world agent)
src/player/index.js        createPlayer(ctx)  (+ flashlight.js, items.js)   (player agent)
src/creatures/base.js      Creature base class                              (done, lead)
src/creatures/manager.js   createCreatureManager(ctx)                       (done, lead)
src/creatures/brains/<id>.js   one hunting pattern per creature             (brain agents)
src/creatures/models/<id>.js   one procedural model per creature            (model agents)
src/audio/index.js         createAudio(ctx)                                 (audio agent)
src/ui/index.js            createUI(ctx)  (+ style.css)                     (UI agent)
src/fx/index.js            createFX(ctx)  (+ particles)                     (FX agent)
```

Creature ids (exact strings, also the file names):
`wendigo, skinwalker, dogman, rake, mothman, jerseydevil, notdeer, leshy, nightcrawler, banshee, flatwoods, llorona`

## ctx (shared game context, created in main.js)

```js
ctx = {
  scene, camera, renderer,        // THREE objects. camera: PerspectiveCamera(72, aspect, 0.08, 260)
  bus,                            // src/core/bus.js
  rng,                            // seeded rng fn () => [0,1)
  world, player, items, creatures, audio, ui, fx,   // subsystems (may be undefined early)
  state: 'menu' | 'playing' | 'paused' | 'dying' | 'dead' | 'won',
  time: 0,                        // seconds of play this run
  aggression: 0,                  // 0..1, rises as wardstones are lit; brains scale speed by (1 + 0.3*aggression)
  settings: { quality: 'low'|'medium'|'high', sensitivity: 1, volume: 0.8 },
}
```

## Bus events

`ctx.bus.on(name, fn)`, `ctx.bus.off(name, fn)`, `ctx.bus.emit(name, payload)`.

| event | payload | emitted by |
|---|---|---|
| `noise` | `{ pos: Vector3, radius: number, kind: 'rock'|'slingshot'|'scream'|'pickup'|'wardstone'|string }` | items, main, creatures. Creatures within `radius * hearing` investigate. (Player footsteps are NOT events; creatures poll `player.noiseRadius`.) |
| `creature:focus` | `{ id, def, creature, firstTime } \| null` | manager — creature currently lit by the flashlight (null when none) |
| `creature:identified` | `{ id, def }` | manager — first time a creature is lit long enough |
| `creature:alert` | `{ id, creature }` | manager — a creature just started chasing the player |
| `player:died` | `{ creature, id, def }` | player.kill |
| `wardstone:lit` | `{ index, lit, total }` | main |
| `pickup` | `{ type: 'rock'|'battery'|'slingshot', count }` | items |
| `ui:start` | `{ creatureIds: string[], difficulty: 'easy'|'normal'|'hard' }` | ui |
| `ui:resume`, `ui:restart`, `ui:menu` | — | ui |
| `ui:settings` | `{ quality?, sensitivity?, volume? }` | ui |

## World — `src/world/index.js`

`export function createWorld(ctx, { seed = 1 } = {})` builds everything into `ctx.scene` and returns:

```js
world = {
  half: 180,                         // playable square is [-half, half] on x and z
  heightAt(x, z) -> number,          // ground height (gentle hills, |h| < ~9)
  colliders: [{ x, z, r }],          // static circle colliders: tree trunks, boulders, structures (walls as circle chains)
  collidersNear(x, z, radius) -> [{x,z,r}],   // spatial-hash query, cheap, may over-return
  resolveCollision(pos /*Vector3, mutated x/z*/, radius) -> void,  // push out of colliders + clamp to bounds
  lineOfSight(a /*Vector3*/, b /*Vector3*/) -> boolean,  // false if a trunk/boulder/structure collider (treated as tall cylinder) or terrain ridge blocks the segment. Must be cheap (grid march), called ~50x/frame.
  canopyAt(x, z) -> number,          // 0..1 overhead tree cover (for flying hunters)
  isWater(x, z) -> boolean,          // the creek / pond
  trees: [{ x, z, height, radius, kind }],     // every tree (for the Leshy to hide among)
  hidingSpots: [{ id, type: 'bush'|'grass'|'log'|'cabin', pos: Vector3, r: number }],
  hidingSpotAt(pos) -> spot | null,
  wardstones: [{ id, pos: Vector3, lit: boolean, light(), reset() }],   // exactly 5, spread far apart, each ≥ 70 m from the others; light() ignites it (emissive runes + ONE small point light + maybe particles)
  pickupSpawns: { rocks: Vector3[], batteries: Vector3[], slingshot: Vector3 },  // ~40 rock piles, ~14 batteries (some near landmarks), slingshot near the player spawn (inside/next to the campsite)
  landmarks: [{ name, pos: Vector3 }],   // campsite (spawn), cabin, ranger tower, wrecked car, graveyard, old well, pond...
  playerSpawn: Vector3, playerSpawnYaw: number,
  randomPoint(rng, { minDistFrom /*Vector3*/, minDist = 0, avoidWater = true } = {}) -> Vector3,  // walkable point on the ground, not inside a collider
  update(dt, ctx),                    // wind sway uniforms, wardstone flicker, etc.
  reset(),                            // un-light wardstones
}
```

Visual goals: dense, oppressive pine/dead-tree forest with clearings and a few dirt trails
linking landmarks; undergrowth (ferns/bushes/tall grass as instanced cards with vertex-shader
wind), boulders, fallen logs, a creek + pond, low hills; night sky dome with stars + a moon;
faint cold moon directional light (no shadows) + very dim hemisphere light; `scene.fog =
new THREE.FogExp2(0x05070b, ~0.028)`; `scene.background` matching. Trees must be instanced
and split into grid chunks (so off-screen chunks frustum-cull). Trees/boulders
`castShadow = true` (flashlight shadows sweeping across trunks are the key horror visual);
ground `receiveShadow = true`. Honour `ctx.settings.quality` for instance counts.

## Player — `src/player/index.js`

`export function createPlayer(ctx)`; owns pointer lock + keyboard/mouse input and drives `ctx.camera`.

```js
player = {
  pos: Vector3,            // feet
  eye: Vector3,            // camera world position
  forward: Vector3,        // normalized camera look direction
  yaw, pitch,
  velocity: Vector3, speed /* horizontal m/s */,
  isMoving, isSprinting, isCrouching,
  stamina: 0..1,
  noiseRadius: number,     // metres. still 0, crouch-walk ~3, walk ~10, sprint ~26 (smoothed)
  hidden: boolean,         // crouched inside a hiding spot with the flashlight OFF
  hidingSpot: spot | null,
  alive: boolean,
  enabled: boolean,        // main sets false in menus / death
  input: { interact: boolean /* E held */, },
  flashlight: {
    on: boolean, battery: 0..1,
    light: THREE.SpotLight,        // attached to camera, castShadow, 1024 map, procedural cookie texture in light.map
    range: ~32, angle: ~0.42 (half-angle rad),
    drainMultiplier: 1,            // creatures may raise this (Flatwoods)
    isIlluminating(point /*Vector3*/, radius = 0.6) -> boolean,  // on && within range && within cone && world.lineOfSight(eye, point)
    forceFlicker(seconds),         // light stutters
    toggle(),
  },
  inventory: { rocks: number, batteries: number, hasSlingshot: boolean },
  kill(creature),          // sets alive=false, enabled=false, emits 'player:died' { creature, id: creature.id, def: creature.def }
  reset(spawnPos, yaw),
  update(dt),
  lock(), unlock(),        // pointer lock helpers
}
```

Controls: WASD move, mouse look, Shift sprint (stamina), C or Ctrl crouch (hold or toggle C),
F flashlight, R load spare battery, LMB throw rock, RMB (hold to draw, release to fire)
slingshot — uses rocks as ammo, flies ~3x farther and faster, E interact (held), Tab journal
(handled by UI), Esc pause (pointer-lock loss → main pauses).

`src/player/items.js` — `export function createItems(ctx)` → `{ update(dt), reset() }`:
spawns pickup meshes at `world.pickupSpawns` (auto-collect on walking within 1.4 m; emit
`pickup`), simulates thrown projectiles (gravity, terrain + collider hit), and on impact emits
`noise` `{ pos, radius: 34 (rock) / 46 (slingshot), kind }` plus `ctx.audio?.play('rock_impact', { pos })`.
A first-person view-model (hand with flashlight; slingshot when drawing) parented to the camera is a nice-to-have.

## Creatures

Data: `src/data/creatures.js`

```js
export const CREATURES = [{
  id, name, epithet,            // 'wendigo', 'Wendigo', 'The Hunger That Walks'
  origin,                       // 'Algonquian folklore · Great Lakes'
  description,                  // 2–3 unsettling sentences of lore
  behavior,                     // how it hunts, 1–2 sentences
  survival,                     // one-line survival tip
  threat: 1..5, accent: '#hex',
}, ...12];
export const CREATURE_BY_ID = { ... };
```

Model: `src/creatures/models/<id>.js`

```js
export function build() -> {
  group: THREE.Group,        // origin at feet, facing +Z, real-world scale in metres
  height: number,            // total height
  eyeHeight: number,         // head centre height (for line-of-sight / flashlight tests / jumpscare camera)
  animate(anim, t, dt, speed) -> void,   // anim: 'idle'|'walk'|'run'|'crawl'|'fly'|'attack'|'special'|'frozen'. t = seconds, speed = current m/s. Procedural (sine-driven limbs, breathing, twitching). 'frozen' = hold pose completely still.
}
```

Brain: `src/creatures/brains/<id>.js` — `export default class extends Creature { think(dt) {...} }`.
See `src/creatures/base.js` for the full helper API (senses, steering, states, kill). Brains
set `this.anim` and move with the helpers; they never touch the model directly.

Hunting patterns (each must feel different):

- **wendigo** — relentless tracker. Follows the player's scent trail (`ctx.creatures.trail`, breadcrumbs) at walking pace forever; sprints (faster than the player) on sight; mimics a human voice (`voice('special')`) when far. Hiding works only if it never saw you hide.
- **skinwalker** — stalker. Keeps 18–30 m away at the edge of the light, circling. Advances only while unobserved; retreats when lit. Charges once within ~9 m or when you turn your back for long.
- **dogman** — pursuit predator. Patrols widely, hears sprinting from very far, runs faster than you. Loses you easily if line of sight breaks or you hide; highly distractible by rocks.
- **rake** — ambusher. Crawls low, approaches from behind; attacks when the flashlight is off or facing away. Being lit makes it flee screeching, then return from another angle.
- **mothman** — aerial. Circles high overhead, drawn to the flashlight. If the light stays on in the open it dives. Tree canopy (`world.canopyAt`) and darkness shake it.
- **jerseydevil** — charger. Telegraphs with a screech, then charges in a straight line at high speed without turning; trees stop it (stun). Sidestep, keep trunks between you.
- **notdeer** — only moves when unobserved (`isObserved()` false). Frozen & wrong-looking when watched. Very fast when not.
- **leshy** — disguised as a tree (stands 'frozen' among `world.trees`). Relocates closer when unobserved; grabs anyone within ~3 m. Flashlight within ~14 m reveals its eyes and makes it shift away.
- **nightcrawler** — blind. Wanders in pairs-like gait, hunts purely by sound with huge hearing; crouch-walking past it is safe; rocks distract it completely.
- **banshee** — alarm. Drifts; on seeing you winds up 2 s then screams: emits `noise` radius 150 kind 'scream' at the player's position and calls `ctx.creatures.alertAll(pos)`. Kills only if you stay inside her wail (< 6 m) for 3 s. Break line of sight to silence her.
- **flatwoods** — drainer. Slow hovering advance straight at you, ignores rocks. Within 22 m it sets `flashlight.drainMultiplier` high and forces flicker; lingering in its gas (< 4 m, 2.5 s) kills.
- **llorona** — the weeping woman, haunts water. Her weeping is LOUD when she is far and quiet when near. Wanders near `world.isWater`; shining the light on her for > 1 s makes her rush you at terrifying speed. Don't look.

## Audio — `src/audio/index.js`

`export function createAudio(ctx)` — all WebAudio synthesis, no files.

```js
audio = {
  resume(),                         // call on first user gesture
  update(dt),                       // reads ctx.camera for listener position/orientation
  setMaster(v), setTension(v /*0..1: heartbeat rate + dissonant drone*/),
  setAmbience(on),                  // wind, creaking trees, crickets, distant owls, occasional far-off twig snaps
  play(name, { pos, volume = 1, pitch = 1 } = {}),   // one-shots; positional if pos given. names: 'footstep','footstep_crouch','rock_throw','rock_impact','slingshot','pickup','flashlight_click','battery','stinger','identify','death','wardstone','wardstone_all','ui_click','breath','twig'
  creatureVoice(id, kind /*'idle'|'alert'|'chase'|'attack'|'special'*/, pos, { volume } = {}),   // distinct synthesized voice per creature id
  loop(name, { pos, volume } = {}) -> { setPos(v3), setVolume(v), stop() },   // names: 'weeping','hum','wings','siren_whisper','growl','static'
  stopAll(),
}
```

## UI — `src/ui/index.js` (+ `style.css`, imported from the JS)

`export function createUI(ctx)` builds all DOM inside `#ui-root` (absolutely positioned over the canvas, `pointer-events` only where needed).

```js
ui = {
  showMenu(),           // title screen → creature selection (toggle any of the 12, "Random 4", "All"), difficulty, quality, Start. Emits 'ui:start'.
  showHUD(), hideHUD(),
  showPause(), hidePause(),
  showDeath(def, stats), showWin(stats),         // stats: { time, wardstones, identified }
  showCreatureCard(def, { firstTime }), hideCreatureCard(),   // the flashlight identification card: name, epithet, origin, description, behaviour, survival tip
  setObjective(text), setPrompt(text | null), setProgress(0..1 | null),   // prompt = "Hold E — light the wardstone", progress = hold-to-interact ring
  toast(text, seconds = 3),
  markIdentified(id),   // journal (Tab) lists identified creatures, unknown ones show as "???"
  update(dt),           // each frame: reads ctx.player (battery, stamina, rocks, batteries, hidden, crouch), draws a compass strip with wardstone bearings (unlit only)
}
```

Look: restrained, diegetic, filmic. Serif display type for names, small-caps mono for stats, lots of black, one accent colour per creature. No cartoon UI.

## FX — `src/fx/index.js`

`export function createFX(ctx)` — EffectComposer with ONE cheap combined final ShaderPass (film grain, vignette, slight chromatic aberration, desaturation, fear distortion). Bloom only at 'high' quality (half res).

```js
fx = {
  render(dt),                 // replaces renderer.render(scene, camera)
  resize(w, h), setQuality(q),
  setFear(v /*0..1*/),        // more grain/vignette/aberration, subtle FOV breathing
  pulse(strength = 1),        // brief static/flash burst
  fade(toAlpha /*0..1 black*/, seconds),
  jumpscare(creature, onDone),// ~1.6 s: snap camera to look at creature head (creature.headPos()), pull creature in front of the camera, shake, heavy static + red flash, then fade to black → onDone()
  update(dt),                 // ambient particles that follow the player: dust motes visible in the beam, drifting ground-fog sprites, a few fireflies
}
```
