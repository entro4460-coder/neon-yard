# NEON YARD — Visual Overhaul Prototype

Three.js + Express + Socket.IO browser FPS. This package intentionally excludes the prior `map.json`; `data/map.json` is a newly authored compact cyberpunk district layout for collision and spawn data. Visual facade dressing is generated in `public/main.js`.

## Run

```bash
npm install
npm start
```

Open `http://localhost:3000` in Chrome or Edge.

## Controls

- WASD move, Shift sprint, Space jump, Ctrl crouch
- Mouse look, left click fire
- Right click toggles ADS (rifle)
- 1 / 2 / 3 switch rifle / pistol / knife
- R reload, Tab scoreboard, Esc releases pointer lock

## Visual pass

- New compact cyberpunk street layout, storefronts, illuminated signs, facade rails, roof HVAC, cables, puddles, grates and street props
- More differentiated rifle silhouettes with receiver plates, magazine ribs, rail teeth, optic housing, muzzle crown and side vents
- ACES tone mapping and sRGB output for improved browser rendering

This is still a procedural Three.js asset pass, not a hand-authored AAA asset pack. Test locally and tune for your target device/browser. Existing server-authoritative multiplayer and weapon handling code are retained as far as possible.
