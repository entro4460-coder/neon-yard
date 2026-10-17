'use strict';
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const MAX_PLAYERS = parseInt(process.env.MAX_PLAYERS, 10) || 16;
const MAX_PER_IP = parseInt(process.env.MAX_PER_IP, 10) || 4;
const MAP = require('./data/map.json');

// ---- 게임 상수 (서버가 기준) ----
const HP = 100, DMG = 25, HEAD_MULT = 2, FIRE_MS = 110, MAG = 30, RELOAD_MS = 1800;
const RESPAWN_MS = 3000, EYE = 1.6, RANGE = 120, MAX_SPEED = 13;

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.get('/healthz', (_q, r) => r.send('ok'));
app.get('/api/status', (_q, r) => r.json({ online: players.size, max: MAX_PLAYERS }));
app.get('/api/map', (_q, r) => r.json(MAP));
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three/build'), { maxAge: '7d', immutable: true }));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, p) => { if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); else res.setHeader('Cache-Control', 'public, max-age=300'); }
}));

const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 2e3, pingInterval: 10000, pingTimeout: 8000, cors: { origin: false } });

const players = new Map(); // id -> player
const ipCount = new Map();

const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const r2 = (v) => Math.round(v * 100) / 100;
const ipOf = (s) => (s.handshake.headers['x-forwarded-for'] || s.handshake.address || '').toString().split(',')[0].trim();

function pickSpawn(excludeId) {
  let best = MAP.spawns[0], bestD = -1;
  for (const sp of MAP.spawns) {
    let d = 1e9;
    for (const p of players.values()) if (p.id !== excludeId && p.alive) d = Math.min(d, Math.hypot(p.x - sp[0], p.z - sp[2]));
    d += Math.random() * 10;
    if (d > bestD) { bestD = d; best = sp; }
  }
  return best;
}
function validName(raw) {
  if (typeof raw !== 'string') return null;
  const n = raw.trim().replace(/\s+/g, ' ');
  if (n.length < 2 || n.length > 16) return null;
  if (!/^[0-9A-Za-z가-힣_\- ]+$/.test(n)) return null;
  return n;
}
function nameTaken(n) { const l = n.toLowerCase(); for (const p of players.values()) if (p.name.toLowerCase() === l) return true; return false; }
const pub = (p) => ({ id: p.id, name: p.name, kills: p.kills, deaths: p.deaths, hp: p.hp, alive: p.alive });
const board = () => [...players.values()].map(pub).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
const broadcastOnline = () => io.emit('online', players.size);

// ---- 레이캐스트 ----
function rayBox(o, d, b) {
  let tmin = 0, tmax = RANGE;
  for (let i = 0; i < 3; i++) {
    const lo = b.p[i] - b.s[i] / 2, hi = b.p[i] + b.s[i] / 2;
    if (Math.abs(d[i]) < 1e-9) { if (o[i] < lo || o[i] > hi) return null; }
    else {
      let t1 = (lo - o[i]) / d[i], t2 = (hi - o[i]) / d[i];
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}
function raySphere(o, d, c, r) {
  const ox = o[0] - c[0], oy = o[1] - c[1], oz = o[2] - c[2];
  const b = ox * d[0] + oy * d[1] + oz * d[2];
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : (cc <= 0 ? 0 : null);
}

function startReload(p) {
  if (p.reloading || p.ammo >= MAG || !p.alive) return;
  p.reloading = true;
  p.reloadTimer = setTimeout(() => {
    p.reloading = false; p.ammo = MAG;
    p.sock.emit('ammo', { ammo: p.ammo, reloading: false });
  }, RELOAD_MS);
  p.sock.emit('ammo', { ammo: p.ammo, reloading: true });
}
function die(victim, killer) {
  victim.alive = false; victim.hp = 0; victim.deaths++;
  clearTimeout(victim.reloadTimer); victim.reloading = false;
  if (killer && killer.id !== victim.id) killer.kills++;
  io.emit('kill', { killer: killer ? killer.name : null, victim: victim.name, killerId: killer ? killer.id : null, victimId: victim.id });
  io.emit('board', board());
  victim.respawnTimer = setTimeout(() => {
    if (!players.has(victim.id)) return;
    const sp = pickSpawn(victim.id);
    Object.assign(victim, { x: sp[0], y: sp[1], z: sp[2], hp: HP, alive: true, ammo: MAG, reloading: false, lastMove: Date.now() });
    victim.sock.emit('respawn', { x: sp[0], y: sp[1], z: sp[2], ammo: MAG });
    io.emit('board', board());
  }, RESPAWN_MS);
}

io.on('connection', (socket) => {
  const ip = ipOf(socket);
  const c = (ipCount.get(ip) || 0) + 1;
  if (c > MAX_PER_IP) { socket.emit('denied', '같은 네트워크에서 접속한 인원이 너무 많습니다.'); return socket.disconnect(true); }
  ipCount.set(ip, c);
  socket.emit('online', players.size);

  // 이벤트 폭주 차단
  let evCount = 0, evStart = Date.now();
  socket.use((_pkt, next) => {
    const now = Date.now();
    if (now - evStart > 1000) { evStart = now; evCount = 0; }
    if (++evCount > 120) { socket.disconnect(true); return; }
    next();
  });

  socket.on('join', (data, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    if (players.has(socket.id)) return reply({ ok: false, error: '이미 참가 중입니다.' });
    if (players.size >= MAX_PLAYERS) return reply({ ok: false, error: `서버가 가득 찼습니다 (${MAX_PLAYERS}명).` });
    const name = validName(data && data.name);
    if (!name) return reply({ ok: false, error: '닉네임은 2~16자 (한글/영문/숫자/_/-) 이어야 합니다.' });
    if (nameTaken(name)) return reply({ ok: false, error: '이미 사용 중인 닉네임입니다.' });
    const sp = pickSpawn(socket.id);
    const p = { id: socket.id, sock: socket, name, x: sp[0], y: sp[1], z: sp[2], ry: 0, pitch: 0, anim: 0,
      hp: HP, alive: true, kills: 0, deaths: 0, ammo: MAG, reloading: false, lastShot: 0, lastMove: Date.now(), moves: 0, moveWin: Date.now() };
    players.set(socket.id, p);
    reply({ ok: true, id: p.id, spawn: sp, ammo: MAG, hp: HP, players: [...players.values()].map(q => ({ ...pub(q), x: q.x, y: q.y, z: q.z, ry: q.ry })) });
    socket.broadcast.emit('joined', { ...pub(p), x: p.x, y: p.y, z: p.z, ry: 0 });
    io.emit('board', board()); broadcastOnline();
  });

  socket.on('move', (m) => {
    const p = players.get(socket.id);
    if (!p || !p.alive || !m) return;
    const now = Date.now();
    if (now - p.moveWin > 1000) { p.moveWin = now; p.moves = 0; }
    if (++p.moves > 60) return;
    if (!num(m.x, -60, 60) || !num(m.y, -5, 30) || !num(m.z, -60, 60) || !num(m.ry, -1000, 1000) || !num(m.pitch, -2, 2)) return;
    const dt = Math.min(Math.max((now - p.lastMove) / 1000, 0.016), 0.5);
    p.lastMove = now;
    const dist = Math.hypot(m.x - p.x, m.z - p.z);
    if (dist > MAX_SPEED * dt + 0.6) { socket.emit('correct', { x: p.x, y: p.y, z: p.z }); return; }
    const L = MAP.bounds;
    p.x = Math.max(-L, Math.min(L, m.x)); p.z = Math.max(-L, Math.min(L, m.z)); p.y = m.y;
    p.ry = m.ry; p.pitch = m.pitch; p.anim = m.anim === 1 || m.anim === 2 ? m.anim : 0;
  });

  socket.on('reload', () => { const p = players.get(socket.id); if (p) startReload(p); });

  socket.on('shoot', (d) => {
    const p = players.get(socket.id);
    if (!p || !p.alive || !d || !Array.isArray(d.dir) || d.dir.length !== 3) return;
    const now = Date.now();
    if (p.reloading || now - p.lastShot < FIRE_MS - 15) return;
    if (p.ammo <= 0) return startReload(p);
    let [dx, dy, dz] = d.dir;
    if (![dx, dy, dz].every(v => num(v, -1.01, 1.01))) return;
    const len = Math.hypot(dx, dy, dz); if (len < 0.5) return;
    dx /= len; dy /= len; dz /= len;
    p.lastShot = now; p.ammo--;
    const o = [p.x, p.y + EYE, p.z], dir = [dx, dy, dz];
    let tWall = RANGE;
    for (const b of MAP.boxes) { const t = rayBox(o, dir, b); if (t !== null && t < tWall) tWall = t; }
    let best = null, bestT = tWall, head = false;
    for (const q of players.values()) {
      if (q.id === p.id || !q.alive) continue;
      const th = raySphere(o, dir, [q.x, q.y + 1.6, q.z], 0.25);
      const tb = Math.min(...[0.3, 0.8, 1.15].map(h => { const t = raySphere(o, dir, [q.x, q.y + h, q.z], 0.42); return t === null ? 1e9 : t; }));
      const t = th !== null && th < tb + 0.3 ? th : (tb < 1e9 ? tb : null);
      if (t !== null && t < bestT) { bestT = t; best = q; head = th !== null && t === th; }
    }
    const to = [r2(o[0] + dx * bestT), r2(o[1] + dy * bestT), r2(o[2] + dz * bestT)];
    io.emit('shot', { id: p.id, from: o.map(r2), to });
    let killed = false;
    if (best) {
      best.hp -= DMG * (head ? HEAD_MULT : 1);
      if (best.hp <= 0) { killed = true; die(best, p); }
      else { best.sock.emit('damaged', { hp: best.hp, from: [p.x, p.z] }); io.emit('board', board()); }
      socket.emit('hit', { head, killed });
    }
    socket.emit('ammo', { ammo: p.ammo, reloading: false });
    if (p.ammo <= 0) startReload(p);
  });

  socket.on('disconnect', () => {
    ipCount.set(ip, Math.max(0, (ipCount.get(ip) || 1) - 1));
    const p = players.get(socket.id);
    if (!p) return;
    clearTimeout(p.reloadTimer); clearTimeout(p.respawnTimer);
    players.delete(socket.id);
    io.emit('left', { id: p.id, name: p.name });
    io.emit('board', board()); broadcastOnline();
  });
});

// 20Hz 상태 브로드캐스트 (이동 데이터만, 소형 패킷)
setInterval(() => {
  if (!players.size) return;
  const s = [];
  for (const p of players.values()) s.push([p.id, r2(p.x), r2(p.y), r2(p.z), r2(p.ry), r2(p.pitch), p.anim, p.alive ? 1 : 0]);
  io.volatile.emit('state', s);
}, 50);

process.on('uncaughtException', (e) => console.error('uncaught', e));
process.on('unhandledRejection', (e) => console.error('unhandled', e));
server.listen(PORT, '0.0.0.0', () => console.log(`NEON YARD listening on :${PORT} (max ${MAX_PLAYERS} players)`));
