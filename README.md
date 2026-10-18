# VANDAL — PON STUDIOS

New standalone codebase. NEON YARD is the first map. Development checkpoint, not a release build.

## Run

Requires Node.js 22 or later.

```sh
npm ci
npm start
```

Open http://localhost:3000 in two browser windows or from two PCs using the server address. Deploy enters pointer lock. Escape returns to the menu. There are no bots: another connected player is required for combat.

## GitHub → Render

Upload this directory's contents to a GitHub repository. In Render create a Node Web Service connected to that repository (not a Static Site). Build: `npm ci`; start: `npm start`; health check: `/health`. The provided `render.yaml` contains equivalent settings. The server reads Render's PORT and binds 0.0.0.0. Client and Socket.IO share one origin. Run exactly one instance: match state is in process memory, with no cross-instance room adapter. Restart clears scores and sessions.

## Controls

WASD move; mouse look; left click fire; right click ADS; R reload; 1/2/3 switch; Shift walk; Ctrl crouch; Space jump; E blast door; hold Tab scoreboard.

## Architecture

- `server/index.js`: 60 Hz server simulation, 20 Hz snapshots, balanced teams, hitscan with cover occlusion, ammo/reload/cadence validation, respawn, 5 minute/40 kill TDM, round reset.
- `shared/game.js`: collision volumes, movement, ray intersection, weapon definitions.
- `public/`: Three.js scene, procedural pixel-painted materials, three weapon assemblies, HUD, synthesized firing audio, remote interpolation.
- `tests/`: movement/cover tests and two Socket.IO client integration check including disconnect/reconnect.

All visual geometry, texture generation, interface and synthesized audio in this project are original procedural assets. Dependencies retain their respective licenses.

## Verified

`npm test`: collision, normalized movement, ray/cover intersection, two simultaneous connections, team allocation, server movement, remote interaction rejection, invalid weapon rejection, disconnect/reconnect. JavaScript syntax checks pass.

## Remaining before release

Browser visual and input QA; real two-browser damage/reload/death/round-end checks; deployed Render verification; 60 FPS measurement; refined artist-created environment and weapon assets; complete enterable interiors and elevated paths; ramps/steps/crouch head clearance; full weapon animation and sound design; settings/loadout/profile; client movement prediction and reconciliation; lag compensation; input/event rate limiting; ammunition economy; stronger abuse protection and soak/load tests. Position is currently snapshot-smoothed rather than predicted. Server-authoritative vertical recoil now accumulates with firing, decays over time, and is reduced while aiming. Cosmetic model kick is separate. Reload uses a normalized magazine-out/in sequence; ADS centers the open optic. Visual browser QA is still pending. Graphics are an initial procedural production pass, not final art.

## Weapon handling update

Replace `public/game.js`, `shared/game.js`, and `server/index.js` together. No Render command changes are needed. Tests add recoil/reload checks. Four tests pass. GitHub integration could read the repository but branch creation returned HTTP 403, so this update has not been pushed or deployed.
