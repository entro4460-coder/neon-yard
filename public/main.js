import * as THREE from 'three';
import { io } from '/socket.io/socket.io.esm.min.js';

const $ = (id) => document.getElementById(id);
const el = { menu: $('menu'), hud: $('hud'), play: $('play'), nick: $('nick'), err: $('err'), dot: $('dot'), stat: $('stat'), online: $('online'),
  loading: $('loading'), paused: $('paused'), lost: $('lost'), lostmsg: $('lostmsg'), retry: $('retry'), hp: $('hp'), ammo: $('ammo'),
  feed: $('feed'), board: $('board'), dead: $('dead'), hitm: $('hitm'), vig: $('vig'), myk: $('myk'), canvas: $('game'), weaponhud: $('weaponhud'), hurtDir: $('hurtDir') };

// ---------- 상수 ----------
const EYE = 1.6, H = 1.8, HW = 0.35, GRAV = 20, JUMP = 7.2, WALK = 6, RUN = 9.5;
const state = { id: null, joined: false, alive: true, hp: 100, ammo: 30, reserve: 120, reloading: false, weapon: 'rifle', weapons: { rifle: { ammo: 30, reserve: 120 }, pistol: { ammo: 12, reserve: 48 } }, kills: 0, deaths: 0 };
const weaponCfg = { rifle: { fireMs: 110, auto: true }, pistol: { fireMs: 300, auto: false }, knife: { fireMs: 600, auto: false } };
let MAP = null, socket = null, running = false, locked = false;

// ---------- Three.js 씬 ----------
const renderer = new THREE.WebGLRenderer({ canvas: el.canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0b1e);
scene.fog = new THREE.Fog(0x0d0b1e, 25, 110);
const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 200);
camera.rotation.order = 'YXZ';
scene.add(camera);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

scene.add(new THREE.HemisphereLight(0x6a7bff, 0x1a0b2e, 0.9));
const sun = new THREE.DirectionalLight(0xbfa8ff, 1.1);
sun.position.set(30, 60, 20); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 140 });
scene.add(sun);

const colliders = [];        // {minX,maxX,minY,maxY,minZ,maxZ}
const mapGroup = new THREE.Group(); scene.add(mapGroup);

function buildMap(m) {
  const L = m.bounds + 2;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(L * 2, L * 2), new THREE.MeshStandardMaterial({ color: 0x14122e, roughness: 0.85, metalness: 0.2 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; mapGroup.add(floor);
  const grid = new THREE.GridHelper(L * 2, L, 0xff2e88, 0x2a2660); grid.position.y = 0.01; mapGroup.add(grid);
  // 외곽 벽 (시각용 + 경계는 이동 클램프로 처리)
  for (const [x, z, w, d] of [[0, -L, L * 2, 1], [0, L, L * 2, 1], [-L, 0, 1, L * 2], [L, 0, 1, L * 2]]) {
    const w1 = new THREE.Mesh(new THREE.BoxGeometry(w, 6, d), new THREE.MeshStandardMaterial({ color: 0x1b1840, emissive: 0x19e3ff, emissiveIntensity: 0.12 }));
    w1.position.set(x, 3, z); mapGroup.add(w1);
  }
  for (const b of m.boxes) {
    const geo = new THREE.BoxGeometry(...b.s);
    const col = new THREE.Color(b.c);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1d1a40, roughness: 0.6, metalness: 0.4, emissive: col, emissiveIntensity: 0.08 }));
    mesh.position.set(...b.p); mesh.castShadow = mesh.receiveShadow = true; mapGroup.add(mesh);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: col }));
    edges.position.copy(mesh.position); mapGroup.add(edges);
    colliders.push({ minX: b.p[0] - b.s[0] / 2, maxX: b.p[0] + b.s[0] / 2, minY: b.p[1] - b.s[1] / 2, maxY: b.p[1] + b.s[1] / 2, minZ: b.p[2] - b.s[2] / 2, maxZ: b.p[2] + b.s[2] / 2 });
    if (b.s[1] > 5) { const pl = new THREE.PointLight(col, 18, 24); pl.position.set(b.p[0], b.s[1] + 1, b.p[2]); mapGroup.add(pl); }
  }
}

// ---------- 1인칭 무기 모델 ----------
const weaponRoot = new THREE.Group(); camera.add(weaponRoot);
const flash = new THREE.PointLight(0xffd27a, 0, 8); flash.position.set(0.42, -0.19, -1.12); camera.add(flash);
let flashT = 0, recoilPitch = 0, recoilYaw = 0, knifeSwingT = 0, weaponKick = 0;
const mat = (color, emissive = 0x000000, intensity = 0) => new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.42, emissive, emissiveIntensity: intensity });
function part(parent, size, pos, material, rot = [0,0,0]) { const m = new THREE.Mesh(new THREE.BoxGeometry(...size), material); m.position.set(...pos); m.rotation.set(...rot); m.castShadow = true; parent.add(m); return m; }
function buildWeapon(type) {
  weaponRoot.clear();
  const w = new THREE.Group(); weaponRoot.add(w);
  const dark = mat(0x171a2d, 0x19e3ff, 0.12), metal = mat(0x353a50, 0x19e3ff, 0.18), sleeve = mat(0x25264c, 0xff2e88, 0.08), skin = mat(0x9b6c55);
  if (type === 'rifle') {
    part(w,[0.14,0.13,0.48],[0,0,0],dark); part(w,[0.055,0.055,0.38],[0,0.005,-0.39],metal); part(w,[0.075,0.075,0.12],[0,0,-0.63],dark);
    part(w,[0.1,0.1,0.22],[0,0,0.32],dark); part(w,[0.09,0.18,0.12],[0,-0.12,0.08],metal,[0.18,0,0]); part(w,[0.18,0.04,0.2],[0,0.09,-0.03],metal);
    part(w,[0.05,0.08,0.09],[0,0.105,-0.04],dark);
    part(w,[0.16,0.11,0.2],[-0.15,-0.16,0.03],sleeve,[0.2,0.15,-0.18]); part(w,[0.13,0.07,0.11],[-0.13,-0.12,-0.11],skin);
    part(w,[0.16,0.12,0.25],[0.12,-0.19,0.22],sleeve,[-0.15,0.1,0.18]); part(w,[0.12,0.07,0.12],[0.1,-0.13,0.02],skin);
    w.position.set(0.22,-0.19,-0.58);
  } else if (type === 'pistol') {
    part(w,[0.13,0.13,0.3],[0,0,0],dark); part(w,[0.055,0.055,0.25],[0,0.01,-0.26],metal); part(w,[0.07,0.18,0.1],[0,-0.12,0.06],dark,[0.2,0,0]);
    part(w,[0.1,0.04,0.13],[0,0.08,-0.02],metal); part(w,[0.16,0.11,0.2],[-0.1,-0.17,0.08],sleeve,[0.2,0.1,-0.18]); part(w,[0.12,0.07,0.11],[-0.08,-0.12,-0.06],skin);
    part(w,[0.16,0.12,0.23],[0.11,-0.19,0.15],sleeve,[-0.15,0.1,0.15]); part(w,[0.12,0.07,0.12],[0.09,-0.13,-0.02],skin); w.position.set(0.22,-0.19,-0.58);
  } else {
    part(w,[0.13,0.1,0.18],[0,0,0.08],sleeve); part(w,[0.1,0.08,0.12],[0,-0.02,-0.03],skin);
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.055,0.48,4), mat(0xc8d9ee,0x19e3ff,0.35)); blade.rotation.x = -Math.PI/2; blade.position.set(0,0,-0.34); w.add(blade);
    part(w,[0.2,0.035,0.055],[0,0,-0.08],metal); w.position.set(0.24,-0.2,-0.53);
  }
  w.userData.basePos = w.position.clone(); return w;
}
let weaponModel = buildWeapon('rifle');
function setWeaponModel(type) { weaponRoot.clear(); weaponModel = buildWeapon(type); weaponRoot.rotation.set(0,0,0); weaponKick = 0; document.querySelectorAll('.weapon-slot').forEach(n => n.classList.toggle('active', n.dataset.slot === type)); }
function getMuzzleWorld() { camera.updateMatrixWorld(true); const v = new THREE.Vector3(0,0,-0.72); weaponModel.localToWorld(v); return [v.x,v.y,v.z]; }
function playKnifeSwing() { knifeSwingT = 0.22; }

// ---------- 다른 플레이어 ----------
const remotes = new Map();
const bodyGeo = new THREE.BoxGeometry(0.6, 1.0, 0.35), headGeo = new THREE.BoxGeometry(0.34, 0.34, 0.34), legGeo = new THREE.BoxGeometry(0.22, 0.7, 0.25);
const headMat = new THREE.MeshStandardMaterial({ color: 0xffd5e6, emissive: 0xff2e88, emissiveIntensity: 0.25 });
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2b2764, emissive: 0xff2e88, emissiveIntensity: 0.3 });
function nameSprite(name) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 48;
  const g = c.getContext('2d'); g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 5;
  g.strokeText(name, 128, 34); g.fillText(name, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(2, 0.375, 1); s.position.y = 2.2; s.renderOrder = 5; return s;
}
function colorForId(id) { let h = 2166136261; for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); const palette = [0x2b2764,0x174c63,0x5a2455,0x5b3b20,0x244c37,0x3d315e,0x4b2d2d,0x1f456f]; return palette[(h >>> 0) % palette.length]; }
function addRemote(p) {
  if (remotes.has(p.id) || p.id === state.id) return;
  const g = new THREE.Group();
  const tint = colorForId(p.id); const pmat = new THREE.MeshStandardMaterial({ color: tint, emissive: 0xff2e88, emissiveIntensity: 0.18 });
  const hmat = new THREE.MeshStandardMaterial({ color: 0xffd5e6, emissive: tint, emissiveIntensity: 0.08 });
  const body = new THREE.Mesh(bodyGeo, pmat); body.position.y = 1.05;
  const head = new THREE.Mesh(headGeo, hmat); head.position.y = 1.72;
  const l1 = new THREE.Mesh(legGeo, pmat), l2 = new THREE.Mesh(legGeo, pmat); l1.position.set(-0.15, 0.35, 0); l2.position.set(0.15, 0.35, 0);
  const a1 = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.62,0.24), pmat), a2 = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.62,0.24), pmat); a1.position.set(-0.39,1.08,0); a2.position.set(0.39,1.08,0);
  const rg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.5), new THREE.MeshStandardMaterial({ color: 0x20263a, emissive: 0x19e3ff, emissiveIntensity: 0.25 })); rg.position.set(0.3, 1.15, -0.3);
  [body, head, l1, l2, a1, a2, rg].forEach(m => { m.castShadow = true; g.add(m); });
  const spr = nameSprite(p.name); g.add(spr);
  g.position.set(p.x || 0, p.y || 0, p.z || 0);
  scene.add(g);
  remotes.set(p.id, { g, l1, l2, a1, a2, spr, tx: p.x || 0, ty: p.y || 0, tz: p.z || 0, try: p.ry || 0, anim: 0, alive: true, name: p.name, phase: 0 });
}
function removeRemote(id) {
  const r = remotes.get(id); if (!r) return;
  scene.remove(r.g); r.spr.material.map.dispose(); r.spr.material.dispose(); remotes.delete(id);
}
function clearRemotes() { for (const id of [...remotes.keys()]) removeRemote(id); }

// ---------- 효과 ----------
const tracers = [];
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true });
function tracer(a, b) {
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]);
  const line = new THREE.Line(geo, tracerMat.clone()); scene.add(line); tracers.push({ line, t: 0.08 });
}
const casings = [];
function ejectCasing() {
  const p = getMuzzleWorld(); const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.035,0.035,0.085), new THREE.MeshStandardMaterial({ color: 0xcaa34b, metalness: 0.8, roughness: 0.25 }));
  mesh.position.set(p[0]-0.08,p[1]-0.04,p[2]+0.02); scene.add(mesh); casings.push({ mesh, vx: 1.2 + Math.random()*0.8, vy: 1.2 + Math.random()*0.8, vz: -0.2 + Math.random()*0.4, t: 1.1 });
}
const sparks = [];
const sparkGeo = new THREE.SphereGeometry(0.06, 6, 6);
function spark(pos, color) {
  const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color, transparent: true })); m.position.set(...pos); scene.add(m); sparks.push({ m, t: 0.25 });
}
let actx = null;
function beep(freq, dur, type = 'square', vol = 0.06, slide = 0) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), actx.currentTime + dur);
    g.gain.setValueAtTime(vol, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + dur);
  } catch (_) {}
}
const sfx = { shot: () => beep(220, 0.1, 'sawtooth', 0.07, -150), hit: () => beep(900, 0.06, 'square', 0.05), kill: () => beep(500, 0.25, 'triangle', 0.08, 500), hurt: () => beep(110, 0.2, 'sawtooth', 0.08, -50), empty: () => beep(150, 0.04) };

// ---------- 입력 / 플레이어 ----------
const keys = new Set();
const me = { x: 0, y: 0, z: 0, vy: 0, yaw: 0, pitch: 0, ground: false };
let mouseDown = false, lastShotLocal = 0, previousMouseDown = false;
function swingKnife() { if (performance.now() - lastShotLocal < weaponCfg.knife.fireMs) return; lastShotLocal = performance.now(); playKnifeSwing(); socket.emit('melee'); }
function onKey(e) {
  if (!running) return;
  if (e.type === 'keydown') {
    if (e.code === 'Tab') { e.preventDefault(); el.board.classList.remove('hidden'); }
    if (e.code === 'KeyR' && socket && state.weapon !== 'knife') socket.emit('reload');
    if (e.code === 'Digit1' && socket) socket.emit('weapon', { weapon: 'rifle' });
    if (e.code === 'Digit2' && socket) socket.emit('weapon', { weapon: 'pistol' });
    if (e.code === 'Digit3' && socket) socket.emit('weapon', { weapon: 'knife' });
    if (e.code === 'Space') e.preventDefault();
    keys.add(e.code);
  } else { keys.delete(e.code); if (e.code === 'Tab') el.board.classList.add('hidden'); }
}
function onMouseMove(e) {
  if (!locked) return;
  me.yaw -= e.movementX * 0.0022; me.pitch = Math.max(-1.5, Math.min(1.5, me.pitch - e.movementY * 0.0022));
}
function onMouseDown(e) { if (e.button === 0) { mouseDown = true; if (running && !locked && state.alive) el.canvas.requestPointerLock(); if (running && locked && state.alive) { if (state.weapon === 'knife') swingKnife(); else if (state.weapon === 'pistol') firePistol(); } } }
function firePistol() { const now = performance.now(); if (now - lastShotLocal < weaponCfg.pistol.fireMs || !state.alive || state.reloading) return; if (state.ammo <= 0) { sfx.empty(); if (state.reserve > 0) socket.emit('reload'); return; } lastShotLocal = now; state.ammo--; if (state.weapons.pistol) state.weapons.pistol.ammo = state.ammo; updHud(); camera.getWorldDirection(dirV); socket.emit('shoot', { weapon: 'pistol', dir: [dirV.x, dirV.y, dirV.z] }); flash.intensity = 5; flashT = 0.05; weaponKick = 0.12; recoilPitch += 0.035; recoilYaw += (Math.random() - 0.5) * 0.018; sfx.shot(); }
function onMouseUp(e) { if (e.button === 0) mouseDown = false; }
function onLockChange() {
  locked = document.pointerLockElement === el.canvas;
  if (running) el.paused.classList.toggle('hidden', locked || !state.joined);
  if (!locked) { keys.clear(); mouseDown = false; }
}
const onBlur = () => { keys.clear(); mouseDown = false; };
function bindInput() {
  addEventListener('keydown', onKey); addEventListener('keyup', onKey); addEventListener('mousemove', onMouseMove);
  addEventListener('mousedown', onMouseDown); addEventListener('mouseup', onMouseUp); addEventListener('blur', onBlur);
  document.addEventListener('pointerlockchange', onLockChange);
}
function unbindInput() {
  removeEventListener('keydown', onKey); removeEventListener('keyup', onKey); removeEventListener('mousemove', onMouseMove);
  removeEventListener('mousedown', onMouseDown); removeEventListener('mouseup', onMouseUp); removeEventListener('blur', onBlur);
  document.removeEventListener('pointerlockchange', onLockChange);
}
el.paused.addEventListener('click', () => el.canvas.requestPointerLock());

function hits(x, y, z) {
  for (const c of colliders) if (x + HW > c.minX && x - HW < c.maxX && z + HW > c.minZ && z - HW < c.maxZ && y < c.maxY && y + H > c.minY) return true;
  return false;
}
function stepPlayer(dt) {
  let fx = 0, fz = 0;
  if (locked && state.alive) {
    if (keys.has('KeyW')) fz -= 1; if (keys.has('KeyS')) fz += 1; if (keys.has('KeyA')) fx -= 1; if (keys.has('KeyD')) fx += 1;
  }
  const len = Math.hypot(fx, fz) || 1; const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const sp = sprint ? RUN : WALK; fx = fx / len * sp; fz = fz / len * sp;
  const c = Math.cos(me.yaw), s = Math.sin(me.yaw);
  const vx = fx * c + fz * s, vz = -fx * s + fz * c;
  const B = MAP.bounds;
  let nx = Math.max(-B, Math.min(B, me.x + vx * dt)); if (!hits(nx, me.y, me.z)) me.x = nx;
  let nz = Math.max(-B, Math.min(B, me.z + vz * dt)); if (!hits(me.x, me.y, nz)) me.z = nz;
  if (me.ground && keys.has('Space') && locked && state.alive) { me.vy = JUMP; me.ground = false; }
  me.vy -= GRAV * dt;
  let ny = me.y + me.vy * dt; me.ground = false;
  if (ny <= 0) { ny = 0; if (me.vy < 0) me.ground = true; me.vy = 0; }
  else if (hits(me.x, ny, me.z)) { if (me.vy < 0) me.ground = true; me.vy = 0; ny = me.y; }
  me.y = ny;
  me.moving = (vx || vz) ? (sprint ? 2 : 1) : 0;
}

// ---------- UI 도우미 ----------
function feed(html) {
  const d = document.createElement('div'); d.innerHTML = html; el.feed.prepend(d);
  while (el.feed.children.length > 6) el.feed.lastChild.remove();
  setTimeout(() => d.remove(), 6000);
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function renderBoard(list) {
  el.board.innerHTML = '<tr><th>플레이어</th><th>킬</th><th>데스</th></tr>' + list.map(p => `<tr class="${p.id === state.id ? 'me' : ''}"><td>${esc(p.name)}</td><td>${p.kills}</td><td>${p.deaths}</td></tr>`).join('');
  const m = list.find(p => p.id === state.id); if (m) el.myk.textContent = `K ${m.kills}  /  D ${m.deaths}`;
}
const updHud = () => { el.hp.textContent = Math.max(0, Math.ceil(state.hp)); el.ammo.textContent = state.weapon === 'knife' ? 'MELEE' : (state.reloading ? '재장전…' : `${state.ammo} / ${state.reserve}`); document.querySelectorAll('.weapon-slot').forEach(n => n.classList.toggle('active', n.dataset.slot === state.weapon)); };
function flashEl(node, cls, ms) { node.classList.add(cls); setTimeout(() => node.classList.remove(cls), ms); }

// ---------- 네트워크 ----------
function connect() {
  if (socket) return;
  socket = io({ transports: ['websocket', 'polling'], reconnection: true, reconnectionAttempts: 6, reconnectionDelay: 800, timeout: 8000 });
  socket.on('connect', () => { setStatus('ok', '서버 연결됨'); el.play.disabled = false; el.lost.classList.add('hidden'); });
  socket.on('connect_error', () => { setStatus('bad', '서버에 연결할 수 없습니다'); el.play.disabled = true; });
  socket.on('online', (n) => { el.online.textContent = `접속 ${n}명`; });
  socket.on('denied', (m) => { el.err.textContent = m; });
  socket.on('disconnect', (why) => {
    setStatus('bad', '연결 끊김'); el.play.disabled = true;
    if (state.joined) { leaveGame(); showLost('서버와 연결이 끊어졌습니다 (' + why + ')'); }
  });
  socket.io.on('reconnect_failed', () => { if (state.joined) showLost('재접속에 실패했습니다'); });
  socket.on('joined', (p) => { addRemote(p); feed(`${esc(p.name)} 입장`); });
  socket.on('left', (p) => { removeRemote(p.id); feed(`${esc(p.name)} 퇴장`); });
  socket.on('board', renderBoard);
  socket.on('state', (arr) => {
    for (const [id, x, y, z, ry, , anim, alive] of arr) {
      if (id === state.id) continue;
      const r = remotes.get(id); if (!r) continue;
      r.tx = x; r.ty = y; r.tz = z; r.try = ry; r.anim = anim; r.alive = !!alive; r.g.visible = !!alive;
    }
  });
  socket.on('shot', (s) => { if (s.weapon === 'knife') return; let from = s.from; if (s.id === state.id) from = getMuzzleWorld(); else { const r = remotes.get(s.id); if (r) { r.g.updateMatrixWorld(true); const v = new THREE.Vector3(0.3,1.2,-0.62); r.g.localToWorld(v); from = [v.x,v.y,v.z]; } } tracer(from, s.to); spark(s.to, 0xffe08a); if (s.id !== state.id) sfx.shot(); });
  socket.on('hit', (h) => { flashEl(el.hitm, 'on', 80); el.hitm.classList.toggle('kill', h.killed); h.killed ? sfx.kill() : sfx.hit(); });
  socket.on('damaged', (d) => { state.hp = d.hp; updHud(); flashEl(el.vig, 'on', 150); shakeT = 0.22; shakeMag = 0.12; if (d.from) { const dx = d.from[0] - me.x, dz = d.from[1] - me.z; const ang = Math.atan2(-dx, -dz) - me.yaw; el.hurtDir.style.transform = `rotate(${ang * 180 / Math.PI}deg)`; flashEl(el.hurtDir, 'on', 450); } sfx.hurt(); });
  socket.on('ammo', (a) => { if (a.weapons) state.weapons = a.weapons; if (a.weapon) { state.weapon = a.weapon; state.ammo = a.ammo; state.reserve = a.reserve ?? 0; state.reloading = a.reloading; } updHud(); });
  socket.on('weapon', (a) => { state.weapon = a.weapon; state.ammo = a.ammo ?? 0; state.reserve = a.reserve ?? 0; state.reloading = !!a.reloading; if (a.weapons) state.weapons = a.weapons; setWeaponModel(state.weapon); updHud(); });
  socket.on('meleeSwing', (s) => { if (s.id === state.id) { if (state.weapon === 'knife') playKnifeSwing(); } else { const r = remotes.get(s.id); if (r) { r.a1.rotation.x = -0.8; r.a2.rotation.x = 0.8; } } });
  socket.on('correct', (c) => { me.x = c.x; me.y = c.y; me.z = c.z; me.vy = 0; });
  socket.on('kill', (k) => {
    feed(`<b>${esc(k.killer || '?')}</b> ▸ ${esc(k.victim)}`);
    if (k.victimId === state.id) { state.alive = false; state.hp = 0; updHud(); el.dead.classList.remove('hidden'); }
  });
  socket.on('respawn', (r) => {
    me.x = r.x; me.y = r.y; me.z = r.z; me.vy = 0; state.alive = true; state.hp = 100; state.ammo = r.ammo ?? 30; state.reserve = r.reserve ?? 120; state.weapon = r.weapon || 'rifle'; state.weapons = r.weapons || { rifle: { ammo: 30, reserve: 120 }, pistol: { ammo: 12, reserve: 48 } }; state.reloading = false; setWeaponModel(state.weapon);
    el.dead.classList.add('hidden'); updHud();
  });
}
function setStatus(cls, txt) { el.dot.className = cls; el.stat.textContent = txt; }

// ---------- 게임 흐름 ----------
async function ensureMap() {
  if (MAP) return;
  MAP = await (await fetch('/api/map')).json(); buildMap(MAP);
}
async function startGame() {
  const name = el.nick.value.trim();
  el.err.textContent = '';
  if (name.length < 2) { el.err.textContent = '닉네임을 2자 이상 입력하세요.'; return; }
  el.canvas.requestPointerLock(); // 사용자 클릭 직후 호출해야 허용됨
  el.loading.classList.remove('hidden');
  try { await ensureMap(); } catch (_) { el.loading.classList.add('hidden'); el.err.textContent = '맵을 불러오지 못했습니다.'; return; }
  socket.timeout(6000).emit('join', { name }, (err, res) => {
    el.loading.classList.add('hidden');
    if (err || !res || !res.ok) { el.err.textContent = (res && res.error) || '입장 요청이 시간 초과되었습니다.'; document.exitPointerLock(); return; }
    Object.assign(state, { id: res.id, joined: true, alive: true, hp: res.hp, ammo: res.ammo, reserve: res.reserve ?? 120, weapon: res.weapon || 'rifle', weapons: res.weapons || { rifle: { ammo: 30, reserve: 120 }, pistol: { ammo: 12, reserve: 48 } }, reloading: false });
    setWeaponModel(state.weapon);
    me.x = res.spawn[0]; me.y = res.spawn[1]; me.z = res.spawn[2]; me.vy = 0; me.yaw = 0; me.pitch = 0;
    res.players.forEach(addRemote); renderBoard(res.players);
    localStorage.setItem('nick', name);
    el.menu.classList.add('hidden'); el.hud.classList.remove('hidden'); updHud();
    bindInput(); running = true; last = performance.now(); requestAnimationFrame(loop);
    if (!locked) el.paused.classList.remove('hidden');
  });
}
function leaveGame() {
  running = false; state.joined = false; unbindInput(); clearRemotes();
  if (document.pointerLockElement) document.exitPointerLock();
  requestAnimationFrame(idle); el.hud.classList.add('hidden'); el.paused.classList.add('hidden'); el.dead.classList.add('hidden'); el.feed.innerHTML = '';
  for (const t of tracers.splice(0)) { scene.remove(t.line); t.line.geometry.dispose(); t.line.material.dispose(); }
  for (const s of sparks.splice(0)) { scene.remove(s.m); s.m.material.dispose(); }
  for (const c of casings.splice(0)) { scene.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh.material.dispose(); }
}
function showLost(msg) { el.lostmsg.textContent = msg; el.lost.classList.remove('hidden'); el.menu.classList.remove('hidden'); }

// ---------- 메인 루프 ----------
let last = 0, sendT = 0, shakeT = 0, shakeMag = 0;
const dirV = new THREE.Vector3();
function loop(now) {
  if (!running) return;
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  stepPlayer(dt);
  if (shakeT > 0) shakeT = Math.max(0, shakeT - dt); const shake = shakeT > 0 ? shakeMag * (shakeT / 0.22) : 0; camera.position.set(me.x + Math.sin(now * 0.09) * shake, me.y + EYE + Math.cos(now * 0.12) * shake, me.z); camera.rotation.set(me.pitch + recoilPitch, me.yaw + recoilYaw, 0);
  // 사격
  const cfg = weaponCfg[state.weapon] || weaponCfg.rifle;
  if (mouseDown && locked && state.alive && state.weapon !== 'knife' && cfg.auto && now - lastShotLocal > cfg.fireMs) {
    if (state.ammo > 0 && !state.reloading) {
      lastShotLocal = now; state.ammo--; if (state.weapons[state.weapon]) state.weapons[state.weapon].ammo = state.ammo; updHud();
      camera.getWorldDirection(dirV); socket.emit('shoot', { weapon: state.weapon, dir: [dirV.x, dirV.y, dirV.z] });
      flash.intensity = 6; flashT = 0.055; weaponKick = 0.075; ejectCasing(); recoilPitch += 0.012; recoilYaw += (Math.random() - 0.5) * 0.006; sfx.shot();
    } else if (state.ammo <= 0 && !state.reloading) { lastShotLocal = now; sfx.empty(); if (state.reserve > 0) socket.emit('reload'); }
  }
  // 권총은 클릭당 한 발 (mouseDown 시작 프레임에서 처리)
  if (flashT > 0) { flashT -= dt; if (flashT <= 0) flash.intensity = 0; }
  recoilPitch *= Math.exp(-dt * 8); recoilYaw *= Math.exp(-dt * 10);
  weaponKick = Math.max(0, weaponKick - dt * 1.8);
  weaponModel.position.z = weaponModel.userData.basePos.z + weaponKick;
  if (state.reloading && state.weapon !== 'knife') { const reloadPhase = (now % 850) / 850; weaponModel.rotation.x = -Math.sin(reloadPhase * Math.PI) * 0.42; weaponModel.position.y = weaponModel.userData.basePos.y - Math.sin(reloadPhase * Math.PI) * 0.075; } else if (state.weapon !== 'knife') { weaponModel.rotation.x *= Math.exp(-dt * 14); weaponModel.position.y += (weaponModel.userData.basePos.y - weaponModel.position.y) * Math.min(1, dt * 12); }
  if (state.weapon === 'knife' && knifeSwingT > 0) { knifeSwingT -= dt; const p = Math.max(0, knifeSwingT / 0.22); weaponModel.rotation.x = -Math.sin((1-p) * Math.PI) * 1.35; weaponModel.rotation.y = Math.sin((1-p) * Math.PI) * 0.28; if (knifeSwingT <= 0) weaponModel.rotation.set(0,0,0); }
  // 위치 전송 (30Hz)
  sendT += dt;
  if (sendT > 1 / 30 && state.alive) { sendT = 0; socket.volatile.emit('move', { x: me.x, y: me.y, z: me.z, ry: me.yaw, pitch: me.pitch, anim: me.moving }); }
  // 원격 플레이어 보간
  const k = Math.min(1, dt * 12);
  for (const r of remotes.values()) {
    const g = r.g, px = g.position.x, pz = g.position.z;
    g.position.x += (r.tx - px) * k; g.position.y += (r.ty - g.position.y) * k; g.position.z += (r.tz - pz) * k;
    let dr = r.try - g.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); g.rotation.y += dr * k;
    const spd = Math.hypot(g.position.x - px, g.position.z - pz) / Math.max(dt, 1e-3);
    r.phase += dt * (r.anim === 2 ? 14 : 9) * (spd > 0.5 ? 1 : 0);
    const sw = spd > 0.5 ? Math.sin(r.phase) * 0.7 : 0; r.l1.rotation.x = sw; r.l2.rotation.x = -sw; r.a1.rotation.x = -sw * 0.45; r.a2.rotation.x = sw * 0.45;
  }
  for (let i = tracers.length - 1; i >= 0; i--) { const t = tracers[i]; t.t -= dt; t.line.material.opacity = Math.max(0, t.t / 0.08);
    if (t.t <= 0) { scene.remove(t.line); t.line.geometry.dispose(); t.line.material.dispose(); tracers.splice(i, 1); } }
  for (let i = casings.length - 1; i >= 0; i--) { const c = casings[i]; c.t -= dt; c.vy -= 7 * dt; c.mesh.position.x += c.vx * dt; c.mesh.position.y += c.vy * dt; c.mesh.position.z += c.vz * dt; c.mesh.rotation.x += dt * 9; c.mesh.rotation.z += dt * 12; if (c.mesh.position.y < 0.05) { c.mesh.position.y = 0.05; c.vy *= -0.25; c.vx *= 0.45; } if (c.t <= 0) { scene.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh.material.dispose(); casings.splice(i,1); } }
  for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.t -= dt; s.m.material.opacity = Math.max(0, s.t / 0.25);
    if (s.t <= 0) { scene.remove(s.m); s.m.material.dispose(); sparks.splice(i, 1); } }
  renderer.render(scene, camera);
}

// ---------- 초기화 ----------
// 메뉴 배경: 맵 위를 천천히 도는 카메라
function idle(t) { if (running) return; requestAnimationFrame(idle); const a = t / 9000; camera.position.set(Math.cos(a) * 55, 22, Math.sin(a) * 55); camera.lookAt(0, 3, 0); renderer.render(scene, camera); }
ensureMap().then(() => requestAnimationFrame(idle)).catch(() => {});
el.nick.value = localStorage.getItem('nick') || '';
el.nick.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !el.play.disabled) startGame(); });
el.play.addEventListener('click', startGame);
el.retry.addEventListener('click', () => { el.lost.classList.add('hidden'); setStatus('', '재접속 중…'); if (socket.connected) { el.play.disabled = false; setStatus('ok', '서버 연결됨'); } else socket.connect(); });
fetch('/api/status').then(r => r.json()).then(s => { el.online.textContent = `접속 ${s.online}명`; }).catch(() => {});
connect();
