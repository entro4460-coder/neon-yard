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

## v0.6 — city block composition and weapon profile rebuild

NEON YARD now adds a defined urban block composition rather than random skyline boxes: AFTERHOURS repair storefront, KAIRO systems service frontage, eight multistory building volumes, four-sided window grids, facade bands, rooftop equipment, urban billboards, street crossing/road paint, overhead utility gantries and hanging cables. Repeated facade parts/windows are instanced by material. The previous random skyline and rows of industrial perimeter neon/pipes are removed. Shop openings and existing walkable interiors/gallery remain. Upper-story building volumes are shared with the server for shot occlusion. Cosmetic thin facade trim and elevated cable/gantry detail are not gameplay cover; no new external stairs or traversable upper floors are claimed.

Weapons are rebuilt in `public/weapons.js`, re-exported from art.js. VANTA has a sculpted curved magazine and angular buttstock, KRAIT a compact shroud and skeletal shoulder frame, ORACLE a long barrel, short box magazine, optical tube and folded supports. Separate contoured side armor, lower receiver, grip profile, open trigger guard, rail, optic and muzzle assembly form the silhouette. Gloved hands/fingers and connected sleeves replace disconnected placeholder hand blocks. Original designs, no imported competitor models. Base weapon/movement/combat stats remain unchanged.

12 tests pass: model geometry, lengths, module HTTP paths, shared upper-volume occlusion, real store entrance traversal, and previous physics/combat-support/network checks. A separate CPU geometry render was used for weapon shape inspection; it does not validate browser lighting, materials or the final first-person image. Browser WebGL QA and FPS measurement are still pending. This remains procedural production work and must not be described as matching the finished quality of Valorant or an AAA cyberpunk city.

Upload the entire archive to the GitHub repository root and redeploy. New files `public/city.js`, `public/weapons.js`, and `shared/city.js` are required. Replace `public/art.js`, `public/game.js`, and `shared/game.js` together, plus retain the included server and index files. Render commands do not change. Ctrl+F5 after deployment. This archive has not been uploaded or deployed by the assistant. v0.5 remains the rollback checkpoint.

## v0.7 — reference-led neon street and VANTA focus pass

Reference images were inspected directly: a dense cyan/magenta/purple neon city and a long low-profile black/white weapon with yellow-green accents. The user requested a concentrated street and VANTA-7 quality pass. The images are used only for direction and are not redistributed in this archive.

New `public/effects.js`: EffectComposer, UnrealBloomPass and OutputPass; a single 640px softened planar Reflector across the street. The reflection camera uses world-only layer 0; view models and muzzle flash use layer 1, enabled only on the main camera. Planar reflections are blended with the pavement, with five shader taps for softening. This is a single horizontal plane, not full-scene ray-traced or screen-space reflection. Reflection/bloom add render cost. F2 toggles both for a lower-cost comparison; it does not disable the neon scene geometry/lighting.

New `public/neon.js`: emissive cyan/magenta facade ribbons, store-canopy accents, framed shop entrance, gantry accents, sparse tower lights, a purple horizon sky shader, and six local colored lights which affect pavement and buildings. Repeated strip geometry is instanced. Ambient and directional lighting are reduced to preserve visible neon contrast. Shop-sign emission is increased to feed bloom. Gameplay paths/collisions and server combat rules remain as v0.6.

VANTA-7 alone is revised to a long, low white/black body and shroud, lime magazine/side accent, low open-bore optic and split skeletal stock. KRAIT/ORACLE retain the previous variants. This is a reference-led original interpretation, not an imported or replicated competitor asset. No claim of reference-equivalent final production quality is made.

12 tests pass, including module/addon HTTP serving, geometry, city/shared cover, traversal, recoil and two-client reconnection. Syntax checks pass. GPU shader compilation, reflection appearance, first-person sight readability, audio and actual device FPS remain unverified because the available browser disables WebGL. These must be checked on the user's PC. The F2 rendering path is provided for comparison, not proof of achieving 60FPS.

Upload the entire archive to the repository root, including new `public/effects.js` and `public/neon.js`, then redeploy with unchanged Render settings and Ctrl+F5. No dependency installation changes; the existing Three.js addon route serves postprocessing and Reflector modules. This update is not pushed/deployed by the assistant. Keep v0.6 for rollback.

## v0.8 — actual irregular district expansion, surface station and all-weapon detailing

The map perimeter is now a 14-vertex stepped outline, not the original rectangle. The floor uses the same outline; boundary collision walls are generated from its segments. West Lantern Alley and its open Midnight Noodles restaurant, east Night Food Court and its open Kairo Kitchen, and the north station spur are playable expansions. Interiors include counters, menu signs, kitchen details and tables. Some small dining props are visual detail; major counters/walls/roof/cover have shared collision. New alley signs, neon entry frames, lanterns, restaurant fascia, station canopy strips and six colored local lights increase street-level emission and illumination. Existing core planar reflection remains one plane; expanded side lanes do not have independent mirror surfaces.

YARD STATION has a ground concourse, ticket machines, an actual ramp and a 2.4m boarding platform with generated rail colliders. To reach it from the east spawn, head to x≈22, follow the cyan line north past the platform to z≈-34, turn west to x≈18 and climb the ramp southward. West alley is around x=-27,z=15; food court x=27,z=-15.5. The train is static, with shared body collision, windows, door seams, wheels/bogies and carriage seams; there is no train boarding, movement, timetable or ticket interaction claimed. These are intentionally not represented by inactive buttons.

The old gallery and its ramp remain. The rail generator now supports a per-platform entry position and width, preserving the station ramp opening. Tests caught a column obstructing the approach and its shared location was corrected.

All three weapon models gain named ejection ports/lips, fire selector, magazine release, charging handle, optic mount and bolt carrier. VANTA gets gas block, muzzle rings and stock lock; KRAIT gets ported muzzle, heat shield, angled foregrip and stock latch; ORACLE gets objective bell, focus rings, windage/elevation turrets, barrel sleeves and bipod hinge. Existing reload animation still drives the magazine and bolt. These are further modelling passes, not a claim of finished competitor-level assets. Firing stats and base/sprint speeds are unchanged.

15 tests pass, including traversing both new restaurant entrances, navigating station approach/ramp to the actual platform, stepped-boundary enclosure, required model parts/finite geometry, all new module routes, and previous network/physics/cover/handling checks. Syntax checks pass. Browser GPU visual verification and actual device FPS are pending. The added lights/reflections may cost frame time; F2 disables bloom and planar reflection for comparison.

Upload the ENTIRE archive to GitHub root and redeploy with unchanged Render commands. New `shared/district.js` and `public/district.js` are required; the shared map, client and weapon files change together. Ctrl+F5 after deploy. No push/deployment was performed by the assistant. Keep v0.7 for rollback.
