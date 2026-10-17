import * as THREE from 'three';
import { io } from '/socket.io/socket.io.esm.min.js';

const $ = (id) => document.getElementById(id);
const el = { menu: $('menu'), hud: $('hud'), play: $('play'), nick: $('nick'), err: $('err'), dot: $('dot'), stat: $('stat'), online: $('online'),
  loading: $('loading'), paused: $('paused'), lost: $('lost'), lostmsg: $('lostmsg'), retry: $('retry'), hp: $('hp'), ammo: $('ammo'),
  feed: $('feed'), board: $('board'), dead: $('dead'), hitm: $('hitm'), vig: $('vig'), myk: $('myk'), canvas: $('game') };

// ---------- 상수 ----------
const EYE = 1.6, H = 1.8, HW = 0.35, GRAV = 20, JUMP = 7.2, WALK = 6, RUN = 9.5;
const state = { id: null, joined: false, alive: true, hp: 100, ammo: 30, reloading: false, kills: 0, deaths: 0 };
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

// ---------- 총 모델 ----------
const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.5), new THREE.MeshStandardMaterial({ color: 0x222244, emissive: 0x19e3ff, emissiveIntensity: 0.35 }));
gun.position.set(0.22, -0.2, -0.45); camera.add(gun);
const flash = new THREE.PointLight(0xffd27a, 0, 8); flash.position.set(0.22, -0.15, -0.9); camera.add(flash);
let flashT = 0;

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
function addRemote(p) {
  if (remotes.has(p.id) || p.id === state.id) return;
  const g = new THREE.Group();
  const body = new THREE.Mesh(bodyGeo, bodyMat); body.position.y = 1.05;
  const head = new THREE.Mesh(headGeo, headMat); head.position.y = 1.72;
  const l1 = new THREE.Mesh(legGeo, bodyMat), l2 = new THREE.Mesh(legGeo, bodyMat); l1.position.set(-0.15, 0.35, 0); l2.position.set(0.15, 0.35, 0);
  const rg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.5), new THREE.MeshBasicMaterial({ color: 0x19e3ff })); rg.position.set(0.3, 1.15, -0.3);
  [body, head, l1, l2, rg].forEach(m => { m.castShadow = true; g.add(m); });
  const spr = nameSprite(p.name); g.add(spr);
  g.position.set(p.x || 0, p.y || 0, p.z || 0);
  scene.add(g);
  remotes.set(p.id, { g, l1, l2, spr, tx: p.x || 0, ty: p.y || 0, tz: p.z || 0, try: p.ry || 0, anim: 0, alive: true, name: p.name, phase: 0 });
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
let mouseDown = false, lastShotLocal = 0;
function onKey(e) {
  if (!running) return;
  if (e.type === 'keydown') {
    if (e.code === 'Tab') { e.preventDefault(); el.board.classList.remove('hidden'); }
    if (e.code === 'KeyR' && socket) socket.emit('reload');
    if (e.code === 'Space') e.preventDefault();
    keys.add(e.code);
  } else { keys.delete(e.code); if (e.code === 'Tab') el.board.classList.add('hidden'); }
}
function onMouseMove(e) {
  if (!locked) return;
  me.yaw -= e.movementX * 0.0022; me.pitch = Math.max(-1.5, Math.min(1.5, me.pitch - e.movementY * 0.0022));
}
function onMouseDown(e) { if (e.button === 0) { mouseDown = true; if (running && !locked && state.alive) el.canvas.requestPointerLock(); } }
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
const updHud = () => { el.hp.textContent = Math.max(0, Math.ceil(state.hp)); el.ammo.textContent = state.reloading ? '재장전…' : `${state.ammo} / 30`; };
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
  socket.on('shot', (s) => { tracer(s.from, s.to); spark(s.to, 0xffe08a); if (s.id !== state.id) sfx.shot(); });
  socket.on('hit', (h) => { flashEl(el.hitm, 'on', 80); el.hitm.classList.toggle('kill', h.killed); h.killed ? sfx.kill() : sfx.hit(); });
  socket.on('damaged', (d) => { state.hp = d.hp; updHud(); flashEl(el.vig, 'on', 120); sfx.hurt(); });
  socket.on('ammo', (a) => { state.ammo = a.ammo; state.reloading = a.reloading; updHud(); });
  socket.on('correct', (c) => { me.x = c.x; me.y = c.y; me.z = c.z; me.vy = 0; });
  socket.on('kill', (k) => {
    feed(`<b>${esc(k.killer || '?')}</b> ▸ ${esc(k.victim)}`);
    if (k.victimId === state.id) { state.alive = false; state.hp = 0; updHud(); el.dead.classList.remove('hidden'); }
  });
  socket.on('respawn', (r) => {
    me.x = r.x; me.y = r.y; me.z = r.z; me.vy = 0; state.alive = true; state.hp = 100; state.ammo = r.ammo; state.reloading = false;
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
    Object.assign(state, { id: res.id, joined: true, alive: true, hp: res.hp, ammo: res.ammo, reloading: false });
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
}
function showLost(msg) { el.lostmsg.textContent = msg; el.lost.classList.remove('hidden'); el.menu.classList.remove('hidden'); }

// ---------- 메인 루프 ----------
let last = 0, sendT = 0;
const dirV = new THREE.Vector3();
function loop(now) {
  if (!running) return;
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  stepPlayer(dt);
  camera.position.set(me.x, me.y + EYE, me.z); camera.rotation.set(me.pitch, me.yaw, 0);
  // 사격
  if (mouseDown && locked && state.alive && now - lastShotLocal > 110) {
    if (state.ammo > 0 && !state.reloading) {
      lastShotLocal = now; state.ammo--; updHud();
      camera.getWorldDirection(dirV); socket.emit('shoot', { dir: [dirV.x, dirV.y, dirV.z] });
      flash.intensity = 6; flashT = 0.05; gun.position.z = -0.4; sfx.shot();
    } else if (state.ammo <= 0 && !state.reloading) { lastShotLocal = now; sfx.empty(); socket.emit('reload'); }
  }
  if (flashT > 0) { flashT -= dt; if (flashT <= 0) flash.intensity = 0; }
  gun.position.z += (-0.45 - gun.position.z) * Math.min(1, dt * 20);
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
    const sw = spd > 0.5 ? Math.sin(r.phase) * 0.7 : 0; r.l1.rotation.x = sw; r.l2.rotation.x = -sw;
  }
  for (let i = tracers.length - 1; i >= 0; i--) { const t = tracers[i]; t.t -= dt; t.line.material.opacity = Math.max(0, t.t / 0.08);
    if (t.t <= 0) { scene.remove(t.line); t.line.geometry.dispose(); t.line.material.dispose(); tracers.splice(i, 1); } }
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
