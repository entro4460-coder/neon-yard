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

WASD move; mouse look; left click fire; right click ADS; R reload; 1/2/3 switch; Shift sprint; Ctrl crouch; Space jump; E blast door; hold Tab scoreboard.

## Architecture

- `server/index.js`: 60 Hz server simulation, 20 Hz snapshots, balanced teams, hitscan with cover occlusion, ammo/reload/cadence validation, respawn, 5 minute/40 kill TDM, round reset.
- `shared/game.js`: collision volumes, movement, ray intersection, weapon definitions.
- `public/`: Three.js scene, procedural pixel-painted materials, three weapon assemblies, HUD, synthesized firing audio, remote interpolation.
- `tests/`: movement/cover tests and two Socket.IO client integration check including disconnect/reconnect.

All visual geometry, texture generation, interface and synthesized audio in this project are original procedural assets. Dependencies retain their respective licenses.

## Verified

`npm test`: collision, normalized movement, ray/cover intersection, two simultaneous connections, team allocation, server movement, remote interaction rejection, invalid weapon rejection, disconnect/reconnect. JavaScript syntax checks pass.

## Remaining before release

Browser visual and input QA; real two-browser damage/reload/death/round-end checks; deployed Render verification; 60 FPS measurement; refined artist-created environment and weapon assets; further interior and elevated-route art polish; step and edge handling refinements; full weapon animation and sound design; settings/loadout/profile; client movement prediction and reconciliation; lag compensation; input/event rate limiting; ammunition economy; stronger abuse protection and soak/load tests. Position is currently snapshot-smoothed rather than predicted. Server-authoritative vertical recoil now accumulates with firing, decays over time, and is reduced while aiming. Cosmetic model kick is separate. Reload uses a normalized magazine-out/in sequence; ADS centers the open optic. Visual browser QA is still pending. Graphics are an initial procedural production pass, not final art.

## Weapon handling update

Replace `public/game.js`, `shared/game.js`, and `server/index.js` together. No Render command changes are needed. Tests add recoil/reload checks. Four tests pass. GitHub integration could read the repository but branch creation returned HTTP 403, so this update has not been pushed or deployed.

## v0.3 — interiors and movement

Normal movement remains 5.5 world units/second; Shift sprints at 8. Crouch remains 2; ADS prevents the sprint boost. No change to firing cadence or reload duration. Reload adds eased magazine withdrawal/insertion, support hand travel, seating impulse and bolt pull/return.

BLACK MARKET and IRONWORKS now have actual entrance gaps and interiors. IRONWORKS has a ramp up to a gallery; both directions pass simulation tests. E within four units of the factory console toggles its rotor and lamp for every client. Procedural shelves, panels, strip lights and warning markings are added.

Seven automated tests pass, including baseline/sprint/crouch/ADS speeds, ramp ascent/descent, recoil/reload stages, wall collision and two-client reconnect. Browser visual QA remains unverified because the available test browser disables WebGL. This is a development update, not final environment art. The v0.3 archive had visual-only rails and no ramp shot occlusion; both are superseded by the v0.4 implementation below.

Upload this archive's contents to the repository root, replacing existing paths. At minimum replace `public/index.html`, `public/game.js`, `shared/game.js`, `server/index.js` together; tests and README are also updated. Keep existing Render build/start settings. Prior v0.2 and v0.1 archives remain separate rollback checkpoints. This update has not been pushed to GitHub or deployed.

## v0.4 — rail collision, ramp cover and detail pass

Rail bars/posts now share exact geometry between rendering, character collision and server shot occlusion. The gallery entrance remains open at the ramp. Players can fire through gaps between bars; jumping over the rail remains possible. Inclined ramps use oriented-box ray intersection rather than a large axis-aligned blocker, so open space above them stays shootable. The visible ramp slope is corrected to match the actual ascent direction. Nine tests pass, including rail blocking, ramp entrance traversal, inclined surface hits and misses, and the previous network and handling checks. Network tests now wait for matching player-count snapshots to avoid accepting queued pre-join snapshots.

Weapon models add cylindrical barrel sleeves, layered side armor, bolt pins, VANTA handguard, compact KRAIT muzzle/stock and folded ORACLE support legs. Environment additions include recessed vent modules, cover trim and original hazard stripe textures. These are procedural detail passes, not final artist-produced assets. No measured FPS claim is made, and WebGL visual inspection remains pending. No speed, damage, magazine size or reload duration changes in this update.

Replace `public/game.js`, `shared/game.js`, and `server/index.js` together, or upload all archive contents to the repository root. Render commands remain unchanged. This build has not been uploaded to GitHub or deployed; repository writing previously returned HTTP 403. Keep v0.3 as the rollback archive.

## v0.5 — smooth industrial art and original weapon audio

The current art direction supersedes Pixel-Painted 3D: smooth industrial cyberpunk. Removed the nearest-neighbor pixel texture generator. New 512px procedurally brushed metal and fine-grain concrete maps use linear/mipmap filtering and anisotropy, with separate roughness maps. Color maps use sRGB. ACES tone mapping and a generated PMREM environment give metals soft environment highlights. Interior lamps distinguish warm BLACK MARKET from cooler IRONWORKS. Drain grates are instanced; puddles use reflective PBR material (environment highlights, not real-time scene mirrors).

All three view models are rebuilt in `public/art.js` with bevelled extruded receiver profiles, rounded armor and open-bore cylindrical barrels/optics. KRAIT is compact with a wire stock; VANTA has a ventilated handguard; ORACLE has a long barrel, optical tube and folded supports. Small character armor meshes also get softened corners. These are original procedural assets, not scanned or externally modelled production assets.

`public/audio.js` synthesizes distinct noise transients, low-frequency bodies and decay envelopes for all three guns, with distance attenuation and stereo pan for remote fire. Reload stages have mechanical clicks. Audio unlocks from the Deploy click. A compressor controls mix peaks. Sound/visual taste and playback still require human validation; no sound recordings are bundled.

Ten tests pass, including weapon geometry bounds/finite vertices and differentiated lengths, HTTP routes for the new art/audio modules and Three addon, plus prior movement/rail/ramp/handling/two-client reconnection checks. Syntax checks pass. No browser GPU rendering, listening test or FPS measurement has been completed here: the available browser has WebGL disabled.

Upload ALL files in this archive to the repository root (retain existing node_modules exclusions). Important changed/new files: `public/game.js`, `public/art.js` (NEW), `public/audio.js` (NEW), `public/index.html`, `server/index.js`, and tests. The server must be updated: it now serves Three's addon directory, and index.html adds the addon import-map prefix. No package, movement, damage, rate-of-fire, reload duration, map collision or Render start/build changes. After deployment use Ctrl+F5 to refresh cached modules. This archive has not been pushed or deployed. Keep v0.4 for rollback.
