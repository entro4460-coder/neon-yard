'use strict';
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const MAX_PLAYERS = parseInt(process.env.MAX_PLAYERS, 10) || 16;
const MAX_PER_IP = parseInt(process.env.MAX_PER_IP, 10) || 4;
const MAP = require('./data/map.json');
const HP = 100, HEAD_MULT = 2, RELOAD_MS = 1800, RESPAWN_MS = 3000, EYE = 1.6;
const WEAPONS = {
  K2C1: { slot:'rifle', mag:30, reserve:120, damage:25, fireMs:115, range:125, reloadMs:1900, tracerSpeed:190, recoil:0.013, kind:'gun' },
  M4A1: { slot:'rifle', mag:30, reserve:120, damage:22, fireMs:86, range:112, reloadMs:1650, tracerSpeed:235, recoil:0.010, kind:'gun' },
  AUG: { slot:'rifle', mag:30, reserve:120, damage:29, fireMs:145, range:145, reloadMs:2050, tracerSpeed:260, recoil:0.008, kind:'gun' },
  DEAGLE_BLACK: { slot:'pistol', mag:7, reserve:42, damage:48, fireMs:360, range:90, reloadMs:1450, tracerSpeed:175, recoil:0.038, kind:'gun' },
  DEAGLE_WHITE: { slot:'pistol', mag:7, reserve:42, damage:48, fireMs:360, range:90, reloadMs:1450, tracerSpeed:175, recoil:0.038, kind:'gun' },
  GURKHA: { slot:'knife', mag:Infinity, reserve:Infinity, damage:55, fireMs:650, range:3.0, reloadMs:0, tracerSpeed:0, recoil:0, kind:'melee' },
  FIELD_KNIFE: { slot:'knife', mag:Infinity, reserve:Infinity, damage:38, fireMs:430, range:2.5, reloadMs:0, tracerSpeed:0, recoil:0, kind:'melee' }
};
const DEFAULT_LOADOUT = { rifle:'K2C1', pistol:'DEAGLE_BLACK', knife:'GURKHA' };
const safeLoadout = (raw) => ({ rifle: raw && WEAPONS[raw.rifle]?.slot==='rifle' ? raw.rifle : DEFAULT_LOADOUT.rifle, pistol: raw && WEAPONS[raw.pistol]?.slot==='pistol' ? raw.pistol : DEFAULT_LOADOUT.pistol, knife: raw && WEAPONS[raw.knife]?.slot==='knife' ? raw.knife : DEFAULT_LOADOUT.knife });
const app = express();
app.set('trust proxy', 1); app.disable('x-powered-by');
app.use((_req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin'); next(); });
app.get('/healthz', (_q, r) => r.send('ok'));
app.get('/api/status', (_q, r) => r.json({ online: players.size, max: MAX_PLAYERS }));
app.get('/api/map', (_q, r) => r.json(MAP));
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three/build'), { maxAge: '7d', immutable: true }));
app.use(express.static(path.join(__dirname, 'public'), { setHeaders: (res, p) => { if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); else res.setHeader('Cache-Control', 'public, max-age=300'); } }));
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 2e3, pingInterval: 10000, pingTimeout: 8000, cors: { origin: false } });
const players = new Map(), ipCount = new Map();
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const r2 = (v) => Math.round(v * 100) / 100;
const ipOf = (s) => (s.handshake.headers['x-forwarded-for'] || s.handshake.address || '').toString().split(',')[0].trim();
function pickSpawn(excludeId) {
  let best = MAP.spawns[0], bestD = -1;
  for (const sp of MAP.spawns) { let d = 1e9; for (const p of players.values()) if (p.id !== excludeId && p.alive) d = Math.min(d, Math.hypot(p.x - sp[0], p.z - sp[2])); d += Math.random() * 10; if (d > bestD) { bestD = d; best = sp; } }
  return best;
}
function validName(raw) { if (typeof raw !== 'string') return null; const n = raw.trim().replace(/\s+/g, ' '); return n.length >= 2 && n.length <= 16 && /^[0-9A-Za-z가-힣_\- ]+$/.test(n) ? n : null; }
function nameTaken(n) { const l = n.toLowerCase(); for (const p of players.values()) if (p.name.toLowerCase() === l) return true; return false; }
const pub = (p) => ({ id:p.id, name:p.name, kills:p.kills, deaths:p.deaths, hp:p.hp, alive:p.alive });
const board = () => [...players.values()].map(pub).sort((a,b) => b.kills-a.kills || a.deaths-b.deaths);
const broadcastOnline = () => io.emit('online', players.size);
function ammoPayload(p) { const w=p.weapon,cfg=WEAPONS[w]; return { weapon:w, slot:cfg.slot, ammo:cfg.kind==='gun'?p.ammo[w]:0, reserve:cfg.kind==='gun'?p.reserve[w]:0, reloading:p.reloading, loadout:p.loadout, weapons:Object.fromEntries(['rifle','pistol'].map(slot=>{const id=p.loadout[slot];return [id,{ammo:p.ammo[id],reserve:p.reserve[id]}]})) }; }
function rayBox(o,d,b,maxRange) {
  let tmin=0,tmax=maxRange;
  for(let i=0;i<3;i++){const lo=b.p[i]-b.s[i]/2,hi=b.p[i]+b.s[i]/2;if(Math.abs(d[i])<1e-9){if(o[i]<lo||o[i]>hi)return null;}else{let t1=(lo-o[i])/d[i],t2=(hi-o[i])/d[i];if(t1>t2)[t1,t2]=[t2,t1];tmin=Math.max(tmin,t1);tmax=Math.min(tmax,t2);if(tmin>tmax)return null;}}
  return tmin;
}
function raySphere(o,d,c,r) { const ox=o[0]-c[0],oy=o[1]-c[1],oz=o[2]-c[2],b=ox*d[0]+oy*d[1]+oz*d[2],cc=ox*ox+oy*oy+oz*oz-r*r,disc=b*b-cc;if(disc<0)return null;const t=-b-Math.sqrt(disc);return t>=0?t:(cc<=0?0:null); }
function wallDistance(o,d,maxRange) { let best=maxRange; for(const b of MAP.boxes){const t=rayBox(o,d,b,maxRange);if(t!==null&&t<best)best=t;} return best; }
function startReload(p) {
  const w=p.weapon, cfg=WEAPONS[w];
  if(cfg.kind!=='gun'||p.reloading||p.ammo[w]>=cfg.mag||p.reserve[w]<=0||!p.alive)return;
  p.reloading=true; clearTimeout(p.reloadTimer);
  p.reloadTimer=setTimeout(()=>{if(!players.has(p.id))return;const need=cfg.mag-p.ammo[w],take=Math.min(need,p.reserve[w]);p.ammo[w]+=take;p.reserve[w]-=take;p.reloading=false;p.sock.emit('ammo',ammoPayload(p));},cfg.reloadMs);
  p.sock.emit('ammo',ammoPayload(p));
}
function die(victim,killer) {
  victim.alive=false;victim.hp=0;victim.deaths++;clearTimeout(victim.reloadTimer);victim.reloading=false;
  if(killer&&killer.id!==victim.id)killer.kills++;
  io.emit('kill',{killer:killer?killer.name:null,victim:victim.name,killerId:killer?killer.id:null,victimId:victim.id});io.emit('board',board());
  victim.respawnTimer=setTimeout(()=>{if(!players.has(victim.id))return;const sp=pickSpawn(victim.id);Object.assign(victim,{x:sp[0],y:sp[1],z:sp[2],hp:HP,alive:true,ammo:{[victim.loadout.rifle]:30,[victim.loadout.pistol]:7},reserve:{[victim.loadout.rifle]:120,[victim.loadout.pistol]:42},weapon:victim.loadout.rifle,reloading:false,lastMove:Date.now()});victim.sock.emit('respawn',{x:sp[0],y:sp[1],z:sp[2],hp:HP,...ammoPayload(victim)});io.emit('board',board());},RESPAWN_MS);
}
io.on('connection',(socket)=>{
  const ip=ipOf(socket),c=(ipCount.get(ip)||0)+1;if(c>MAX_PER_IP){socket.emit('denied','같은 네트워크에서 접속한 인원이 너무 많습니다.');return socket.disconnect(true);}ipCount.set(ip,c);socket.emit('online',players.size);
  let evCount=0,evStart=Date.now();socket.use((_pkt,next)=>{const now=Date.now();if(now-evStart>1000){evStart=now;evCount=0;}if(++evCount>120){socket.disconnect(true);return;}next();});
  socket.on('join',(data,ack)=>{
    const reply=typeof ack==='function'?ack:()=>{};if(players.has(socket.id))return reply({ok:false,error:'이미 참가 중입니다.'});if(players.size>=MAX_PLAYERS)return reply({ok:false,error:`서버가 가득 찼습니다 (${MAX_PLAYERS}명).`});
    const name=validName(data&&data.name);if(!name)return reply({ok:false,error:'닉네임은 2~16자 (한글/영문/숫자/_/-) 이어야 합니다.'});if(nameTaken(name))return reply({ok:false,error:'이미 사용 중인 닉네임입니다.'});
    const sp=pickSpawn(socket.id),loadout=safeLoadout(data&&data.loadout),p={id:socket.id,sock:socket,name,x:sp[0],y:sp[1],z:sp[2],ry:0,pitch:0,anim:0,hp:HP,alive:true,kills:0,deaths:0,loadout,weapon:loadout.rifle,ammo:{[loadout.rifle]:30,[loadout.pistol]:7},reserve:{[loadout.rifle]:120,[loadout.pistol]:42},reloading:false,reloadTimer:null,lastShot:{K2C1:0,M4A1:0,AUG:0,DEAGLE_BLACK:0,DEAGLE_WHITE:0,GURKHA:0,FIELD_KNIFE:0},lastMove:Date.now(),moves:0,moveWin:Date.now()};
    players.set(socket.id,p);reply({ok:true,id:p.id,spawn:sp,hp:HP,...ammoPayload(p),players:[...players.values()].map(q=>({...pub(q),x:q.x,y:q.y,z:q.z,ry:q.ry}))});
    socket.broadcast.emit('joined',{...pub(p),x:p.x,y:p.y,z:p.z,ry:0});io.emit('board',board());broadcastOnline();
  });
  socket.on('move',(m)=>{const p=players.get(socket.id);if(!p||!p.alive||!m)return;const now=Date.now();if(now-p.moveWin>1000){p.moveWin=now;p.moves=0;}if(++p.moves>60)return;if(!num(m.x,-MAP.bounds,MAP.bounds)||!num(m.y,-5,30)||!num(m.z,-MAP.bounds,MAP.bounds)||!num(m.ry,-1000,1000)||!num(m.pitch,-2,2))return;const dt=Math.min(Math.max((now-p.lastMove)/1000,0.016),0.5);p.lastMove=now;const dist=Math.hypot(m.x-p.x,m.z-p.z);if(dist>13*dt+0.6){socket.emit('correct',{x:p.x,y:p.y,z:p.z});return;}p.x=Math.max(-MAP.bounds,Math.min(MAP.bounds,m.x));p.z=Math.max(-MAP.bounds,Math.min(MAP.bounds,m.z));p.y=m.y;p.ry=m.ry;p.pitch=m.pitch;p.anim=m.anim===1||m.anim===2?m.anim:0;p.crouched=m.crouched===true;});
  socket.on('weapon',(d)=>{const p=players.get(socket.id);if(!p||!p.alive||!d||!['rifle','pistol','knife'].includes(d.slot))return;clearTimeout(p.reloadTimer);p.reloading=false;p.weapon=p.loadout[d.slot];p.sock.emit('weapon',ammoPayload(p));});
  socket.on('reload',()=>{const p=players.get(socket.id);if(p)startReload(p);});
  socket.on('shoot',(d)=>{
    const p=players.get(socket.id);if(!p||!p.alive||!d||!Array.isArray(d.dir)||d.dir.length!==3)return;const w=p.weapon,cfg=WEAPONS[w];if(cfg.kind!=='gun'||p.reloading)return;const now=Date.now();if(now-p.lastShot[w]<cfg.fireMs-15)return;if(p.ammo[w]<=0)return startReload(p);
    let [dx,dy,dz]=d.dir;if(![dx,dy,dz].every(v=>num(v,-1.01,1.01)))return;const len=Math.hypot(dx,dy,dz);if(len<0.5)return;dx/=len;dy/=len;dz/=len;p.lastShot[w]=now;p.ammo[w]--;
    const o=[p.x,p.y+(p.crouched?1.05:EYE),p.z],dir=[dx,dy,dz],tWall=wallDistance(o,dir,cfg.range);let best=null,bestT=tWall,head=false;
    for(const q of players.values()){if(q.id===p.id||!q.alive)continue;const th=raySphere(o,dir,[q.x,q.y+1.6,q.z],0.25),tb=Math.min(...[0.3,0.8,1.15].map(h=>{const t=raySphere(o,dir,[q.x,q.y+h,q.z],0.42);return t===null?1e9:t;}));const t=th!==null&&th<tb+0.3?th:(tb<1e9?tb:null);if(t!==null&&t<bestT){bestT=t;best=q;head=th!==null&&t===th;}}
    const to=[r2(o[0]+dx*bestT),r2(o[1]+dy*bestT),r2(o[2]+dz*bestT)];io.emit('shot',{id:p.id,weapon:w,tracerSpeed:cfg.tracerSpeed,from:o.map(r2),to});
    if(best){const dmg=cfg.damage*(head?HEAD_MULT:1);best.hp-=dmg;const killed=best.hp<=0;if(killed)die(best,p);else{best.sock.emit('damaged',{hp:best.hp,from:[p.x,p.z]});io.emit('board',board());}socket.emit('hit',{head,killed,weapon:w});}
    socket.emit('ammo',ammoPayload(p));if(p.ammo[w]<=0&&p.reserve[w]>0)startReload(p);
  });
  socket.on('melee',()=>{
    const p=players.get(socket.id);if(!p||!p.alive||WEAPONS[p.weapon]?.kind!=='melee')return;const now=Date.now(),cfg=WEAPONS[p.weapon];if(now-p.lastShot.knife<cfg.fireMs)return;p.lastShot.knife=now;
    const yaw=p.ry,dir=[-Math.sin(yaw),0,-Math.cos(yaw)],o=[p.x,p.y+(p.crouched?0.78:1.1),p.z],wall=wallDistance(o,dir,cfg.range);let best=null,bestD=cfg.range;
    for(const q of players.values()){if(q.id===p.id||!q.alive)continue;const vx=q.x-p.x,vz=q.z-p.z,dist=Math.hypot(vx,vz);if(dist>bestD||dist<0.01)continue;const dot=(vx*dir[0]+vz*dir[2])/dist;if(dot<0.45)continue;if(dist>wall)continue;best=q;bestD=dist;}
    io.emit('meleeSwing',{id:p.id});if(best){best.hp-=cfg.damage;const killed=best.hp<=0;if(killed)die(best,p);else{best.sock.emit('damaged',{hp:best.hp,from:[p.x,p.z]});io.emit('board',board());}socket.emit('hit',{head:false,killed,weapon:'knife'});io.emit('meleeHit',{id:p.id,target:best.id});}
  });
  socket.on('disconnect',()=>{ipCount.set(ip,Math.max(0,(ipCount.get(ip)||1)-1));const p=players.get(socket.id);if(!p)return;clearTimeout(p.reloadTimer);clearTimeout(p.respawnTimer);players.delete(socket.id);io.emit('left',{id:p.id,name:p.name});io.emit('board',board());broadcastOnline();});
});
setInterval(()=>{if(!players.size)return;const s=[];for(const p of players.values())s.push([p.id,r2(p.x),r2(p.y),r2(p.z),r2(p.ry),r2(p.pitch),p.anim,p.alive?1:0]);io.volatile.emit('state',s);},50);
process.on('uncaughtException',(e)=>console.error('uncaught',e));process.on('unhandledRejection',(e)=>console.error('unhandled',e));
server.listen(PORT,'0.0.0.0',()=>console.log(`NEON YARD listening on :${PORT} (max ${MAX_PLAYERS} players)`));
