# Blackbriar

**Play it: [blackbriar.fly.dev](https://blackbriar.fly.dev/)**

A first-person survival horror game for the browser. You are alone in Blackbriar Forest at
night with a flashlight. Wake the five wardstones to bring the dawn. Up to twelve cryptids
and folklore creatures are hunting you, and you cannot fight any of them.

Best with headphones, on a desktop browser with a mouse and keyboard.

## How to play

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` | Move |
| Mouse | Look |
| `Shift` | Sprint (drains stamina, and is loud) |
| `C` | Crouch |
| `F` | Flashlight on / off |
| `R` | Load a spare battery |
| Left mouse | Throw a rock |
| Right mouse (hold, release) | Draw and fire the slingshot, once you find it |
| `E` (hold) | Wake a wardstone |
| `Tab` | Journal |
| `Esc` | Pause |

- **Find the wardstones.** The compass at the top of the screen marks the ones you have
  not woken yet. Stand next to one and hold `E`. Each one you wake makes the forest angrier.
- **Shine your light to learn what hunts you.** Holding the beam on a creature identifies
  it: its name, its folklore, how it hunts and how to survive it. The journal keeps every
  entry. The light also shows you to them.
- **Run, hide, distract.** Crouch inside a bush, tall grass, a hollow log or the cabin with
  your light off and you are hidden, unless something watched you go in. Rocks make noise
  where they land, and most things will go and look.
- Batteries and rock piles are scattered through the woods. The slingshot is at the campsite.

Before each run you choose which creatures are in the forest, the difficulty and the
graphics quality.

## The creatures

Each one hunts differently, and each has a counter.

| Creature | How it hunts |
| --- | --- |
| Wendigo | Follows your scent trail at a walk and never stops. Sprints on sight. |
| Skinwalker | Circles at the edge of your light and closes in while you are not looking. |
| Dogman | Hears running from far away and outruns you, but is easily baited by noise. |
| The Rake | Crawls up from behind. Light drives it off, for a while. |
| Mothman | Circles overhead, drawn to your flashlight, and dives if you stay lit in the open. |
| Jersey Devil | Screams, then charges in a straight line. Keep a tree between you. |
| Not-Deer | Only moves when you are not watching it. |
| Leshy | Stands among the pines as one of them and takes whoever walks past. |
| Fresno Nightcrawler | Blind. Hunts by sound alone. |
| Banshee | Slow, but her scream tells everything else where you are. |
| Flatwoods Monster | Drifts toward you without hurry and drains your battery as it nears. |
| La Llorona | Weeps by the water, loudest when she is far away. Do not shine your light on her. |

## How it is built

- [Three.js](https://threejs.org/) and [Vite](https://vite.dev/), plain JavaScript modules.
- Everything is procedural. There are no model, texture or audio files: geometry is built in
  code, textures are drawn to canvases, and all sound is synthesized with the Web Audio API.
- The forest is instanced and chunked, and the flashlight is the only shadow-casting light,
  so it runs on integrated graphics.
- `docs/ARCHITECTURE.md` describes the modules and the contracts between them. Each creature
  is a model in `src/creatures/models/` and a brain in `src/creatures/brains/`.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:5183. `viewer.html` on the same server is a small tool for
looking at one creature model at a time, for example
`/viewer.html?id=wendigo&anim=walk`.

## Deploy

The production build is a static bundle served by nginx (see `Dockerfile` and `fly.toml`).

```bash
fly deploy --ha=false
```
