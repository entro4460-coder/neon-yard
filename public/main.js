import * as THREE from 'three';
import { io } from '/socket.io/socket.io.esm.min.js';

const $ = (id) => document.getElementById(id);
const el = { menu: $('menu'), hud: $('hud'), play: $('play'), nick: $('nick'), err: $('err'), dot: $('dot'), stat: $('stat'), online: $('online'),
  loading: $('loading'), paused: $('paused'), lost: $('lost'), lostmsg: $('lostmsg'), retry: $('retry'), hp: $('hp'), ammo: $('ammo'),
  feed: $('feed'), board: $('board'), dead: $('dead'), hitm: $('hitm'), vig: $('vig'), myk: $('myk'), canvas: $('game'), weaponhud: $('weaponhud'), hurtDir: $('hurtDir') };

// ---------- 상수 ----------
const EYE = 1.6, H = 1.8, HW = 0.35, GRAV = 20, JUMP = 7.2, WALK = 6, RUN = 9.5;
const state = { id:null, joined:false, alive:true, hp:100, ammo:30, reserve:120, reloading:false, weapon:'VANTA7', slot:'rifle', loadout:{rifle:'VANTA7',pistol:'DEAGLE_BLACK',knife:'GURKHA'}, weapons:{}, kills:0, deaths:0 };
const weaponCfg = { VANTA7:{slot:'rifle',fireMs:115,auto:true,recoil:0.013,reloadMs:1900,mag:30}, KRAIT4:{slot:'rifle',fireMs:86,auto:true,recoil:0.010,reloadMs:1650,mag:30}, ORACLEX:{slot:'rifle',fireMs:145,auto:true,recoil:0.008,reloadMs:2050,mag:30}, DEAGLE_BLACK:{slot:'pistol',fireMs:360,auto:false,recoil:0.038,reloadMs:1450,mag:7}, DEAGLE_WHITE:{slot:'pistol',fireMs:360,auto:false,recoil:0.038,reloadMs:1450,mag:7}, GURKHA:{slot:'knife',fireMs:650,auto:false,recoil:0,reloadMs:0}, FIELD_KNIFE:{slot:'knife',fireMs:430,auto:false,recoil:0,reloadMs:0} };
const displayWeapon = id => ({VANTA7:'VANTA-7',KRAIT4:'KRAIT-4',ORACLEX:'ORACLE-X',DEAGLE_BLACK:'DESERT EAGLE BLACK',DEAGLE_WHITE:'DESERT EAGLE WHITE',GURKHA:'GURKHA KNIFE',FIELD_KNIFE:'FIELD KNIFE'}[id]||id);
const isMelee = id => weaponCfg[id]?.slot==='knife';
let MAP = null, socket = null, running = false, locked = false;

// ---------- Three.js 씬 ----------
const renderer = new THREE.WebGLRenderer({ canvas: el.canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
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
  // 도시형 교전 구역: 어두운 아스팔트 도로, 횡단보도, 네온 가로등과 원거리 스카이라인
  const roadMat=new THREE.MeshStandardMaterial({color:0x080d18,roughness:0.96,metalness:0.05});
  for(const [x,z,w,d] of [[0,0,12,L*1.7],[0,0,L*1.7,12],[-30,0,5,L*1.6],[30,0,5,L*1.6],[0,-30,L*1.6,5],[0,30,L*1.6,5]]){const road=new THREE.Mesh(new THREE.PlaneGeometry(w,d),roadMat);road.rotation.x=-Math.PI/2;road.position.set(x,0.018,z);mapGroup.add(road);}
  const laneMat=new THREE.MeshBasicMaterial({color:0x19e3ff,transparent:true,opacity:0.42});
  const whiteLine=new THREE.MeshBasicMaterial({color:0xa8c7d8,transparent:true,opacity:0.65});
  // Main avenues: dashed lane dividers and crosswalks, scaled to the actual arena.
  for(let n=-10;n<=10;n++){
    const z=n*7;
    const dash=new THREE.Mesh(new THREE.PlaneGeometry(2.8,0.12),laneMat);dash.rotation.x=-Math.PI/2;dash.position.set(0,0.035,z);mapGroup.add(dash);
    const dash2=new THREE.Mesh(new THREE.PlaneGeometry(0.12,2.8),laneMat);dash2.rotation.x=-Math.PI/2;dash2.position.set(z,0.036,0);mapGroup.add(dash2);
  }
  for (const cross of [{x:8,z:0,rot:0},{x:-8,z:0,rot:0},{x:0,z:8,rot:Math.PI/2},{x:0,z:-8,rot:Math.PI/2}]) for(let k=-4;k<=4;k++){
    const stripe=new THREE.Mesh(new THREE.PlaneGeometry(0.82,4.2),whiteLine);stripe.rotation.x=-Math.PI/2;stripe.rotation.z=cross.rot;stripe.position.set(cross.x+(cross.rot? k*0.98: k*0.98),0.04,cross.z);mapGroup.add(stripe);
  }
  // Detailed skyline blocks with window grids, roof caps and neon sign bands instead of bare pixel-like cubes.
  const buildingMat=[0x101927,0x17172a,0x14202b,0x20182d].map(c=>new THREE.MeshStandardMaterial({color:c,roughness:0.62,metalness:0.38}));
  const windowMats=[new THREE.MeshBasicMaterial({color:0x1abfe9}),new THREE.MeshBasicMaterial({color:0xf52c91}),new THREE.MeshBasicMaterial({color:0x4ce6bd}),new THREE.MeshBasicMaterial({color:0x27384b})];
  for(let i=0;i<26;i++){
    const side=i%4,along=-L*0.76+(i%13)*(L*0.126),x=side===0?-L*0.84:side===1?L*0.84:along,z=side===2?-L*0.84:side===3?L*0.84:along;
    const w=5.5+(i%3)*1.8,d=5.5+((i+1)%3)*1.4,h=10+(i%6)*3.2;
    const bld=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),buildingMat[i%buildingMat.length]);bld.position.set(x,h/2,z);bld.castShadow=true;bld.receiveShadow=true;mapGroup.add(bld);
    const roof=new THREE.Mesh(new THREE.BoxGeometry(w+0.28,0.22,d+0.28),mat(0x252b3c, i%2?0xff2e88:0x19e3ff,0.28));roof.position.set(x,h+0.1,z);mapGroup.add(roof);
    const frontZ=z+(side===2?d/2+0.04:side===3?-d/2-0.04:0);
    const frontX=x+(side===0?w/2+0.04:side===1?-w/2-0.04:0);
    for(let fy=2;fy<h-1.2;fy+=2.15) for(let fx=-w/2+0.9;fx<w/2-0.5;fx+=1.35){
      const win=new THREE.Mesh(new THREE.PlaneGeometry(0.72,0.95),windowMats[(i+Math.round(fy+fx))%windowMats.length]);
      if(side<2){win.rotation.y=side===0?Math.PI/2:-Math.PI/2;win.position.set(frontX,fy,z+fx*0.55);}else{win.position.set(x+fx*0.55,fy,frontZ);}
      mapGroup.add(win);
    }
    const sign=new THREE.Mesh(new THREE.BoxGeometry(Math.min(w-0.7,4.8),0.55,0.16),new THREE.MeshBasicMaterial({color:i%2?0xff2e88:0x19e3ff}));sign.position.set(x,h*0.62,z+d/2+0.14);mapGroup.add(sign);
  }
  // Street lamps, bollards and cover props add readable scale and more realistic combat lanes.
  for(const [x,z] of [[-15,-15],[15,-15],[-15,15],[15,15],[-42,0],[42,0],[0,-42],[0,42]]){
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.14,5.2,8),mat(0x20283a));pole.position.set(x,2.6,z);mapGroup.add(pole);
    const arm=new THREE.Mesh(new THREE.BoxGeometry(1.25,0.09,0.12),mat(0x30364a));arm.position.set(x+0.45,5.05,z);mapGroup.add(arm);
    const lamp=new THREE.PointLight(0x19dfff,2.4,13);lamp.position.set(x+0.55,4.9,z);mapGroup.add(lamp);
  }
  for(let i=0;i<14;i++){
    const x=((i*17)%83)-41,z=((i*29)%83)-41;if(Math.abs(x)<12||Math.abs(z)<12)continue;
    const crate=new THREE.Mesh(new THREE.BoxGeometry(1.5,1.25,1.35),mat(i%2?0x242c3d:0x31233d,i%2?0x19e3ff:0xff2e88,0.12));crate.position.set(x,0.625,z);crate.castShadow=true;mapGroup.add(crate);
    const stripe=new THREE.Mesh(new THREE.BoxGeometry(1.52,0.08,1.37),new THREE.MeshBasicMaterial({color:i%2?0x19e3ff:0xff2e88}));stripe.position.set(x,0.9,z);mapGroup.add(stripe);
  }
  // 외곽 벽 (시각용 + 경계는 이동 클램프로 처리)
  for (const [x, z, w, d] of [[0, -L, L * 2, 1], [0, L, L * 2, 1], [-L, 0, 1, L * 2], [L, 0, 1, L * 2]]) {
    const w1 = new THREE.Mesh(new THREE.BoxGeometry(w, 6, d), new THREE.MeshStandardMaterial({ color: 0x1b1840, emissive: 0x19e3ff, emissiveIntensity: 0.12 }));
    w1.position.set(x, 3, z); mapGroup.add(w1);
  }
  for (const b of m.boxes) {
    const geo = new THREE.BoxGeometry(...b.s);
    const col = new THREE.Color(b.c);
    // Large building collision volumes stay invisible: detailed facades are authored separately above.
    // Low cover remains visible but uses restrained industrial materials, not neon wireframe cubes.
    if (b.s[1] <= 2.2) {
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x252a35, roughness: 0.72, metalness: 0.42 }));
      mesh.position.set(...b.p); mesh.castShadow = mesh.receiveShadow = true; mapGroup.add(mesh);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(b.s[0]*0.96,0.045,b.s[2]*0.96), new THREE.MeshBasicMaterial({color:col}));
      stripe.position.set(b.p[0],b.p[1]+b.s[1]*0.34,b.p[2]);mapGroup.add(stripe);
    }
    colliders.push({ minX: b.p[0] - b.s[0] / 2, maxX: b.p[0] + b.s[0] / 2, minY: b.p[1] - b.s[1] / 2, maxY: b.p[1] + b.s[1] / 2, minZ: b.p[2] - b.s[2] / 2, maxZ: b.p[2] + b.s[2] / 2 });
  }
}

// ---------- NEON YARD original compact cyberpunk district dressing ----------
// Adds road slabs, curbs, signage, cables, roof machinery, storefronts, windows and neon light accents.
function dressCyberCity(m){
  const asphalt=new THREE.MeshStandardMaterial({color:0x080d14,roughness:0.3,metalness:0.32});
  const concrete=new THREE.MeshStandardMaterial({color:0x252a35,roughness:0.86,metalness:0.12});
  const glass=[0x12c8ed,0xf52c91,0x8a6cff,0x45ffd0].map(c=>new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:1.2,roughness:0.22,metalness:0.4}));
  const neon=[0x19e3ff,0xff2e88,0x9a67ff,0xffb04a];
  const addBox=(x,y,z,w,h,d,mat,group=mapGroup)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;group.add(o);return o;};
  // asphalt islands, sidewalks and segmented crosswalks
  for(let k=-2;k<=2;k++){
    addBox(k*27,0.025,0,17,0.05,154,asphalt); addBox(0,0.026,k*27,154,0.05,17,asphalt);
    for(let q=-6;q<=6;q++){addBox(k*27+q*2.4,0.06,8,1.2,0.025,0.13,glass[0]);addBox(8,0.06,k*27+q*2.4,0.13,0.025,1.2,glass[0]);}
  }
  // facade panels, ledges, illuminated windows and rooftop HVAC on buildings
  const blocks=[[-28,-28,16,16,18], [0,-31,19,13,25],[29,-27,17,18,22],[-31,4,13,19,17],[31,5,15,20,20],[-27,31,18,14,21],[2,31,20,15,24],[30,32,15,14,18]];
  blocks.forEach((b,i)=>{const [x,z,w,d,h]=b;const face=glass[i%glass.length];
    for(let y=2.2;y<h-1;y+=2.4){for(let xx=-w/2+1;xx<w/2-0.5;xx+=2.1){addBox(x+xx,y,z+d/2+0.09,1.15,1.15,0.08,face);addBox(x+xx,y,z-d/2-0.09,1.15,1.15,0.08,face);}}
    for(let y=2.2;y<h-1;y+=2.4){for(let zz=-d/2+1;zz<d/2;zz+=2.2){addBox(x+w/2+0.09,y,z+zz,0.08,1.1,1.2,glass[(i+1)%4]);addBox(x-w/2-0.09,y,z+zz,0.08,1.1,1.2,glass[(i+2)%4]);}}
    addBox(x,h+0.35,z,w+0.6,0.35,d+0.6,concrete);addBox(x,h+0.62,z,w*0.55,0.22,0.5,glass[i%4]);
    // floating sign fascia at street-facing side
    addBox(x,h*0.58,z+d/2+0.25,Math.min(w-1,7),0.75,0.16,glass[i%4]);
    for(let n=0;n<3;n++)addBox(x+(n-1)*0.6,h+0.9,z,0.18,0.7,0.18,glass[(i+n)%4]);
  });
  // lamps, overhead wires, vending kiosks and street-level cover
  for(let x=-54;x<=54;x+=18){for(const z of [-12,12]){addBox(x,2.3,z,0.16,4.6,0.16,concrete);addBox(x+0.65,4.5,z,1.3,0.12,0.16,concrete);addBox(x+0.65,4.38,z,0.75,0.06,0.12,glass[(Math.abs(x/18))%4]);}}
  for(let z=-54;z<=54;z+=18){addBox(-12,2.3,z,0.16,4.6,0.16,concrete);addBox(-11.4,4.5,z,1.2,0.12,0.16,concrete);addBox(-11.4,4.38,z,0.72,0.06,0.12,glass[1]);}
  for(let i=0;i<18;i++){const x=((i*23)%104)-52,z=((i*37)%104)-52;if(Math.abs(x)<10&&Math.abs(z)<10)continue;const c=glass[i%4];addBox(x,0.65,z,1.25,1.3,0.85,concrete);addBox(x,0.7,z+0.45,0.9,0.8,0.06,c);addBox(x,1.34,z,1.3,0.08,0.9,c);}
  // High-density cyberpunk street dressing: signage, vents, cables, storefronts, curbs and layered facade panels.
  const trim = new THREE.MeshStandardMaterial({color:0x343b4d,metalness:0.82,roughness:0.28});
  const rubber = new THREE.MeshStandardMaterial({color:0x080b12,metalness:0.12,roughness:0.88});
  const glassDark = new THREE.MeshPhysicalMaterial({color:0x071421,metalness:0.35,roughness:0.12,transparent:true,opacity:0.94,clearcoat:1});
  const makeSign=(x,y,z,text,color,rot=0)=>{
    const c=document.createElement('canvas');c.width=512;c.height=128;const g=c.getContext('2d');
    g.fillStyle='#080b16';g.fillRect(0,0,512,128);g.strokeStyle='#'+color.toString(16).padStart(6,'0');g.lineWidth=5;g.strokeRect(5,5,502,118);
    g.font='900 54px sans-serif';g.textAlign='center';g.textBaseline='middle';g.shadowColor='#'+color.toString(16).padStart(6,'0');g.shadowBlur=20;g.fillStyle='#eafaff';g.fillText(text,256,64);
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(5.2,1.3),new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide}));mesh.position.set(x,y,z);mesh.rotation.y=rot;mapGroup.add(mesh);
  };
  // Building detail clusters along the walkable lanes. Every facade gets non-flat geometry.
  const facades=[[-28,-28,14,14,17], [0,-31,17,13,22], [29,-27,15,16,19], [-31,4,13,18,16], [31,5,15,18,21], [-27,31,17,13,20], [2,31,18,14,24], [30,32,14,14,17],[-49,-18,8,12,11],[49,18,8,12,13],[-18,49,12,8,14],[18,-49,12,8,15]];
  facades.forEach((b,i)=>{
    const [x,z,w,d,h]=b, neonColor=neon[i%neon.length];
    // Heavy vertical corner rails and layered ledges
    for(const side of [-1,1]){
      addBox(x+side*(w/2+0.12),h*0.48,z,0.16,h*0.94,d+0.3,trim);
      addBox(x,h*0.22,z+side*(d/2+0.13),w+0.28,0.12,0.16,trim);
      addBox(x,h*0.76,z+side*(d/2+0.13),w+0.28,0.12,0.16,trim);
      addBox(x,h*0.76+0.1,z+side*(d/2+0.22),w+0.08,0.045,0.055,glass[i%4]);
    }
    // Storefront frames, dark glass panels and signage at street level
    const front=z+d/2+0.16;
    for(let j=0;j<Math.max(2,Math.floor(w/2.4));j++){
      const xx=x-w/2+1.25+j*2.2;
      addBox(xx,1.65,front,1.78,2.5,0.12,glassDark);
      addBox(xx-0.94,1.65,front+0.08,0.09,2.72,0.12,trim);
      addBox(xx+0.94,1.65,front+0.08,0.09,2.72,0.12,trim);
      addBox(xx,2.98,front+0.08,1.95,0.1,0.12,trim);
      addBox(xx,0.38,front+0.08,1.95,0.12,0.12,trim);
    }
    makeSign(x,h*0.46,front+0.18,['NEON MARKET','NIGHT / 24','CYBER CAFE','YARD-09','NOVA TECH','NO SIGNAL'][i%6],neonColor);
    // Roof HVAC, ducts and exhaust fans
    for(let n=0;n<2+(i%2);n++){
      const rx=x-w*0.3+n*w*0.25, rz=z-d*0.18;
      addBox(rx,h+0.48,rz,1.35,0.65,0.95,trim);addBox(rx,h+0.83,rz,1.05,0.08,0.72,rubber);
      for(let f=0;f<4;f++)addBox(rx-0.42+f*0.28,h+0.88,rz,0.06,0.07,0.62,glass[(i+n)%4]);
      addBox(rx,h+1.1,rz,0.14,0.38,0.14,trim);
    }
    // Vertical neon tubes and side-mounted service pipes
    for(let n=-1;n<=1;n++){
      addBox(x+n*(w/2-0.35),h*0.47,z+d/2+0.2,0.045,h*0.78,0.045,glass[(i+n+4)%4]);
    }
  });
  // Cable spans across alleys, with supports and short drops.
  for(let z=-42;z<=42;z+=21){
    const wire=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,22,6),rubber);wire.rotation.z=Math.PI/2;wire.position.set(0,7.1,z);mapGroup.add(wire);
    for(const x of [-10.5,10.5]){addBox(x,6.7,z,0.08,1.1,0.08,trim);addBox(x,7.22,z,0.35,0.07,0.07,glass[1]);}
  }
  // Drain grates, tactile curb edges and reflective puddle patches.
  const puddleMat=new THREE.MeshPhysicalMaterial({color:0x122b3a,metalness:0.6,roughness:0.12,clearcoat:1,transparent:true,opacity:0.8});
  for(let i=0;i<22;i++){
    const x=((i*17)%112)-56,z=((i*29)%112)-56;if(Math.abs(x)<9&&Math.abs(z)<9)continue;
    const puddle=new THREE.Mesh(new THREE.CircleGeometry(0.8+(i%4)*0.22,20),puddleMat);puddle.rotation.x=-Math.PI/2;puddle.scale.y=0.38;puddle.position.set(x,0.042,z);mapGroup.add(puddle);
    if(i%3===0){addBox(x,0.055,z+1.1,1.1,0.025,0.12,trim);for(let k=0;k<7;k++)addBox(x-0.45+k*0.15,0.073,z+1.1,0.035,0.012,0.14,glass[0]);}
  }
  // Neon bollards, trash containers and utility cabinets for human scale.
  for(let i=0;i<30;i++){
    const x=((i*13)%116)-58,z=((i*37)%116)-58;if(Math.abs(x)<12&&Math.abs(z)<12)continue;
    if(i%2===0){addBox(x,0.55,z,0.42,1.1,0.42,trim);addBox(x,0.94,z,0.44,0.08,0.44,glass[i%4]);addBox(x,0.23,z,0.46,0.06,0.46,rubber);}
    else {addBox(x,0.72,z,0.85,1.42,0.62,trim);addBox(x,0.76,z+0.33,0.62,0.66,0.045,glass[i%4]);addBox(x,1.36,z,0.9,0.06,0.67,glass[(i+1)%4]);}
  }
  // A restrained atmospheric haze and cinematic color contrast.
  scene.fog=new THREE.FogExp2(0x0a0d19,0.0072);
}

// ---------- 1인칭 무기 모델 ----------
const weaponRoot = new THREE.Group(); camera.add(weaponRoot);
const flash = new THREE.PointLight(0xffd27a, 0, 8); flash.position.set(0.42, -0.19, -1.12); camera.add(flash);
let flashT = 0, recoilPitch = 0, recoilYaw = 0, knifeSwingT = 0, weaponKick = 0;
const mat = (color, emissive = 0x000000, intensity = 0) => new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.42, emissive, emissiveIntensity: intensity });
function part(parent, size, pos, material, rot = [0,0,0]) { const m = new THREE.Mesh(new THREE.BoxGeometry(...size), material); m.position.set(...pos); m.rotation.set(...rot); m.castShadow = true; parent.add(m); return m; }
function buildWeapon(type) {
  const w = new THREE.Group();
  const dark = mat(type==='KRAIT4'?0x202a36:type==='ORACLEX'?0x3b3930:0x171a2d, 0x19e3ff, 0.12), metal = mat(0x353a50, 0x19e3ff, 0.18), sleeve = mat(0x25264c, 0xff2e88, 0.08), skin = mat(0x9b6c55);
  if (['rifle','VANTA7','KRAIT4','ORACLEX'].includes(type)) {
    part(w,[0.14,0.13,0.48],[0,0,0],dark); part(w,[0.055,0.055,0.38],[0,0.005,-0.39],metal); part(w,[0.075,0.075,0.12],[0,0,-0.63],dark);
    part(w,[0.1,0.1,0.22],[0,0,0.32],dark); part(w,[0.09,0.18,0.12],[0,-0.12,0.08],metal,[0.18,0,0]); part(w,[0.18,0.04,0.2],[0,0.09,-0.03],metal);
    part(w,[0.05,0.08,0.09],[0,0.105,-0.04],dark);
    part(w,[0.16,0.11,0.2],[-0.15,-0.16,0.03],sleeve,[0.2,0.15,-0.18]); part(w,[0.13,0.07,0.11],[-0.13,-0.12,-0.11],skin);
    part(w,[0.16,0.12,0.25],[0.12,-0.19,0.22],sleeve,[-0.15,0.1,0.18]); part(w,[0.12,0.07,0.12],[0.1,-0.13,0.02],skin);
    w.position.set(0.22,-0.19,-0.58);
  } else if (['pistol','DEAGLE_BLACK','DEAGLE_WHITE'].includes(type)) {
    part(w,[0.13,0.13,0.3],[0,0,0],dark); part(w,[0.055,0.055,0.25],[0,0.01,-0.26],metal); part(w,[0.07,0.18,0.1],[0,-0.12,0.06],dark,[0.2,0,0]);
    part(w,[0.1,0.04,0.13],[0,0.08,-0.02],metal); part(w,[0.16,0.11,0.2],[-0.1,-0.17,0.08],sleeve,[0.2,0.1,-0.18]); part(w,[0.12,0.07,0.11],[-0.08,-0.12,-0.06],skin);
    part(w,[0.16,0.12,0.23],[0.11,-0.19,0.15],sleeve,[-0.15,0.1,0.15]); part(w,[0.12,0.07,0.12],[0.09,-0.13,-0.02],skin); w.position.set(0.22,-0.19,-0.58);
  } else {
    part(w,[0.13,0.1,0.18],[0,0,0.08],sleeve); part(w,[0.1,0.08,0.12],[0,-0.02,-0.03],skin);
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.055,0.48,4), mat(0xc8d9ee,0x19e3ff,0.35)); blade.rotation.x = -Math.PI/2; blade.position.set(0,0,-0.34); w.add(blade);
    part(w,[0.2,0.035,0.055],[0,0,-0.08],metal); w.position.set(0.24,-0.2,-0.53);
  }
  // Futuristic industrial detailing: layered receiver plates, emissive rails and energy-coil rings.
  const cyanGlow=new THREE.MeshStandardMaterial({color:0x071e39,metalness:0.45,roughness:0.24,emissive:0x087fff,emissiveIntensity:2.2});
  const pinkGlow=new THREE.MeshStandardMaterial({color:0x30091f,metalness:0.35,roughness:0.24,emissive:0xff168f,emissiveIntensity:1.8});
  const greenGlow=new THREE.MeshStandardMaterial({color:0x09281b,metalness:0.35,roughness:0.24,emissive:0x20ff86,emissiveIntensity:1.65});
  const cylinder=(parent,r1,r2,len,pos,material,axis='z',segments=12)=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,len,segments),material);mesh.position.set(...pos);if(axis==='z')mesh.rotation.x=Math.PI/2;else if(axis==='x')mesh.rotation.z=Math.PI/2;parent.add(mesh);mesh.castShadow=true;return mesh;};
  if(['VANTA7','KRAIT4','ORACLEX'].includes(type)){
    // Coil chamber and energy muzzle, built from real 3D meshes rather than a flat image.
    cylinder(w,0.105,0.105,0.34,[0,0.025,-0.27],metal,'z',16);
    for(let i=0;i<5;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(0.102,0.014,8,20),i%2?pinkGlow:cyanGlow);ring.position.set(0,0.025,-0.16-i*0.075);w.add(ring);}
    cylinder(w,0.085,0.085,0.055,[0,0.025,-0.67],cyanGlow,'z',16);
    part(w,[0.21,0.025,0.42],[0,0.105,-0.12],metal);
    for(let i=0;i<4;i++)part(w,[0.025,0.025,0.31],[-0.085+i*0.056,0.125,-0.15],i%2?pinkGlow:cyanGlow);
    part(w,[0.18,0.025,0.09],[0,0.19,0.03],greenGlow);
    part(w,[0.06,0.055,0.16],[0.04,0.16,0.1],dark);
  }
  if(['VANTA7','KRAIT4','ORACLEX'].includes(type)){
    // Distinctive rifle silhouettes: skeletal stock, separate magazine, trigger guard, rail teeth and a real optic window.
    const stockMat=mat(type==='KRAIT4'?0x18222b:0x101522,0x061f31,0.16);
    part(w,[0.16,0.12,0.31],[0,0.005,0.34],stockMat,[0.02,0,0]);
    part(w,[0.19,0.045,0.1],[0,0.025,0.48],mat(0x202630));
    part(w,[0.095,0.23,0.14],[0,-0.19,0.12],stockMat,[0.14,0,0]);
    part(w,[0.12,0.19,0.12],[0,-0.23,-0.01],dark,[0.12,0,0]);
    // Magazine with bevel-like stacked plates and ribs
    part(w,[0.105,0.23,0.16],[0,-0.235,-0.13],stockMat,[0.12,0,0]);
    for(let r=0;r<4;r++)part(w,[0.11,0.018,0.17],[0,-0.17-r*0.045,-0.13],metal);
    // Picatinny rail teeth on top
    for(let r=0;r<9;r++)part(w,[0.055,0.025,0.055],[-0.08+r*0.02,0.19,-0.28+r*0.045],metal);
    // Hooded holographic optic, lens faces toward the player; inner reticle remains visible in ADS.
    part(w,[0.19,0.14,0.15],[0,0.28,-0.13],dark);
    part(w,[0.15,0.105,0.018],[0,0.28,-0.214],new THREE.MeshPhysicalMaterial({color:0x4b9ba9,metalness:0.35,roughness:0.08,transparent:true,opacity:0.68,clearcoat:1}));
    part(w,[0.018,0.13,0.035],[-0.095,0.28,-0.13],metal);part(w,[0.018,0.13,0.035],[0.095,0.28,-0.13],metal);
    const sightColor=type==='ORACLEX'?greenGlow:type==='KRAIT4'?pinkGlow:cyanGlow;
    part(w,[0.012,0.012,0.012],[0,0.28,-0.229],sightColor);
    // Muzzle crown, side vents and bolts
    for(let k=0;k<5;k++)part(w,[0.025,0.055,0.025],[-0.07+k*0.035,0.01,-0.56],metal);
    for(const side of [-1,1])for(let k=0;k<3;k++)part(w,[0.018,0.025,0.055],[side*0.086,0.015,-0.2-k*0.08],k%2?sightColor:metal);
  }
  if(type==='ORACLEX'){part(w,[0.21,0.16,0.34],[0,0.13,-0.24],metal);part(w,[0.13,0.11,0.22],[0,0.17,-0.25],dark);part(w,[0.25,0.04,0.17],[0,0.24,-0.24],greenGlow);part(w,[0.07,0.07,0.18],[0,0.27,-0.24],cyanGlow);part(w,[0.14,0.06,0.26],[0,-0.12,0.2],greenGlow);}
  if(type==='KRAIT4'){part(w,[0.06,0.06,0.42],[0,-0.02,-0.50],metal);part(w,[0.20,0.07,0.16],[0,0.02,0.30],dark);part(w,[0.025,0.025,0.31],[0.09,0.035,-0.38],cyanGlow);part(w,[0.13,0.10,0.18],[0,0.11,-0.03],pinkGlow);part(w,[0.045,0.045,0.26],[0,-0.10,0.18],metal);}
  if(type==='VANTA7'){part(w,[0.22,0.07,0.22],[0,0.13,-0.02],dark);part(w,[0.15,0.022,0.18],[0,0.176,-0.02],pinkGlow);part(w,[0.20,0.12,0.13],[0,0.11,0.19],metal);part(w,[0.05,0.035,0.25],[0.12,0.04,-0.27],cyanGlow);part(w,[0.18,0.025,0.12],[0,0.23,0.02],pinkGlow);}
  if(type==='DEAGLE_BLACK'||type==='DEAGLE_WHITE'){
    const accent=mat(type==='DEAGLE_WHITE'?0xe7edf6:0x090b11,0xff2e88,0.12);part(w,[0.14,0.035,0.28],[0,0.075,-0.05],accent);part(w,[0.07,0.035,0.18],[0,0.095,-0.30],metal);
    part(w,[0.13,0.025,0.2],[0,0.12,-0.08],cyanGlow);cylinder(w,0.045,0.045,0.035,[0,0.02,-0.42],pinkGlow,'z',12);
  }
  if(type==='GURKHA'||type==='FIELD_KNIFE'){
    // Shaped blade, fuller, guard and glowing pommel. A swept motion rotates this complete model.
    const bladeGeo=new THREE.BufferGeometry();const verts=new Float32Array([-0.055,0,0,0.055,0,0,-0.018,0,-0.48, 0.055,0,0,0.018,0,-0.48,-0.018,0,-0.48, -0.055,0,0,0,0.025,-0.22,-0.018,0,-0.48, 0.055,0,0,0.018,0,-0.48,0,0.025,-0.22]);bladeGeo.setAttribute('position',new THREE.BufferAttribute(verts,3));bladeGeo.computeVertexNormals();const bladeMesh=new THREE.Mesh(bladeGeo,new THREE.MeshStandardMaterial({color:0xb9c8d9,metalness:0.9,roughness:0.2,side:THREE.DoubleSide,emissive:0x063a5c,emissiveIntensity:0.25}));bladeMesh.position.set(0,0,-0.17);w.add(bladeMesh);
    part(w,[0.24,0.035,0.06],[0,0,-0.08],metal);part(w,[0.11,0.095,0.2],[0,0,0.08],dark);part(w,[0.12,0.025,0.17],[0,0.055,0.08],pinkGlow);cylinder(w,0.035,0.035,0.045,[0,0,0.19],cyanGlow,'z',10);
    if(type==='GURKHA')part(w,[0.025,0.02,0.25],[0,0.018,-0.34],cyanGlow);
  }
  w.userData.basePos=w.position.clone();return w;
}
let weaponModel;
function setWeaponModel(type) { weaponRoot.clear(); weaponModel = buildWeapon(type); weaponRoot.add(weaponModel); weaponRoot.rotation.set(0,0,0); weaponKick=0; document.querySelectorAll('.weapon-slot').forEach(n=>n.classList.toggle('active',n.dataset.slot===weaponCfg[type]?.slot)); }
function getMuzzleWorld() { camera.updateMatrixWorld(true); const v = new THREE.Vector3(0,0,-0.72); weaponModel.localToWorld(v); return [v.x,v.y,v.z]; }
function playKnifeSwing() { knifeSwingT = 0.22; }

// ---------- 3D 무기 선택 프리뷰: 동일한 절차적 모델을 실제 전투에도 사용 ----------
const previewCanvas=$('weapon-preview');let previewRenderer=null,previewScene=null,previewCamera=null,previewWeapon=null,previewId='VANTA7';
const previewStats={VANTA7:['25','115 ms','190 m/s','1.90 s','중간'],KRAIT4:['22','86 ms','235 m/s','1.65 s','낮음'],ORACLEX:['29','145 ms','260 m/s','2.05 s','낮음'],DEAGLE_BLACK:['48','360 ms','175 m/s','1.45 s','매우 높음'],DEAGLE_WHITE:['48','360 ms','175 m/s','1.45 s','매우 높음'],GURKHA:['55','650 ms','근접','—','휘두르기 넓음'],FIELD_KNIFE:['38','430 ms','근접','—','빠름']};
function previewSet(id){previewId=id;if(!previewRenderer){try{previewRenderer=new THREE.WebGLRenderer({canvas:previewCanvas,alpha:true,antialias:true});previewRenderer.setPixelRatio(Math.min(devicePixelRatio,2));previewScene=new THREE.Scene();previewCamera=new THREE.PerspectiveCamera(36,1,0.1,30);previewCamera.position.set(2.4,1.7,4.5);previewCamera.lookAt(0,0,0);previewScene.add(new THREE.HemisphereLight(0x9cefff,0x24102e,2));const pl=new THREE.DirectionalLight(0xffffff,3);pl.position.set(2,4,3);previewScene.add(pl);const rim=new THREE.PointLight(0xff2e88,4,8);rim.position.set(-2,1,-2);previewScene.add(rim);}catch(_){return;}}if(previewWeapon)previewScene.remove(previewWeapon);previewWeapon=buildWeapon(id);previewWeapon.position.set(0,0,0);previewWeapon.scale.setScalar(id==='GURKHA'||id==='FIELD_KNIFE'?2.5:1.65);previewScene.add(previewWeapon);const names={VANTA7:'VANTA-7',KRAIT4:'KRAIT-4',ORACLEX:'ORACLE-X',DEAGLE_BLACK:'DESERT EAGLE BLACK',DEAGLE_WHITE:'DESERT EAGLE WHITE',GURKHA:'GURKHA KNIFE',FIELD_KNIFE:'FIELD KNIFE'};$('preview-name').textContent=names[id]||id;const v=previewStats[id]||[];$('preview-stats').innerHTML=[['DAMAGE',v[0]],['FIRE / SWING RATE',v[1]],['TRACER SPEED',v[2]],['RELOAD',v[3]],['RECOIL / HANDLING',v[4]]].map(([a,b])=>`<div class="stat-row"><span>${a}</span><b>${b}</b></div>`).join('');$('preview-desc').textContent=weaponCfg[id]?.slot==='rifle'?'ASSAULT PLATFORM':weaponCfg[id]?.slot==='pistol'?'HEAVY SIDEARM':'CLOSE QUARTERS';}
window.addEventListener('ny-preview',e=>previewSet(e.detail.id));previewSet('VANTA7');

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
function tracer(a,b,speed=200){const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a),new THREE.Vector3(...b)]);const line=new THREE.Line(geo,tracerMat.clone());scene.add(line);const distance=new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b));const life=Math.max(0.035,Math.min(0.22,distance/Math.max(50,speed)));tracers.push({line,t:life,life});}
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
function swingKnife(){const cfg=weaponCfg[state.weapon];if(performance.now()-lastShotLocal<cfg.fireMs)return;lastShotLocal=performance.now();playKnifeSwing();socket.emit('melee');}
function onKey(e) {
  if (!running) return;
  if (e.type === 'keydown') {
    if (e.code === 'Tab') { e.preventDefault(); el.board.classList.remove('hidden'); }
    if (e.code === 'KeyR' && socket && !isMelee(state.weapon)) socket.emit('reload');
    if (e.code==='Digit1'&&socket) socket.emit('weapon',{slot:'rifle'});
    if (e.code==='Digit2'&&socket) socket.emit('weapon',{slot:'pistol'});
    if (e.code==='Digit3'&&socket) socket.emit('weapon',{slot:'knife'});
    if (e.code === 'Space') e.preventDefault();
    keys.add(e.code);
  } else { keys.delete(e.code); if (e.code === 'Tab') el.board.classList.add('hidden'); }
}
function onMouseMove(e) {
  if (!locked) return;
  me.yaw -= e.movementX * 0.0022; me.pitch = Math.max(-1.5, Math.min(1.5, me.pitch - e.movementY * 0.0022));
}
let aiming=false, aimBlend=0;
function onMouseDown(e) { if(e.button===2){e.preventDefault();aiming=!aiming;return;} if(e.button===0){mouseDown=true;if(running&&!locked&&state.alive)el.canvas.requestPointerLock();if(running&&locked&&state.alive){if(isMelee(state.weapon))swingKnife();else if(!weaponCfg[state.weapon]?.auto)firePistol();}} }
function onContextMenu(e){e.preventDefault();}
function onMouseUp(e){if(e.button===0)mouseDown=false;}
function firePistol(){const cfg=weaponCfg[state.weapon],now=performance.now();if(now-lastShotLocal<cfg.fireMs||!state.alive||state.reloading)return; if (state.ammo <= 0) { sfx.empty(); if (state.reserve > 0) socket.emit('reload'); return; } lastShotLocal = now; state.ammo--; if(state.weapons[state.weapon])state.weapons[state.weapon].ammo=state.ammo; updHud(); camera.getWorldDirection(dirV);socket.emit('shoot',{dir:[dirV.x,dirV.y,dirV.z]});flash.intensity=5;flashT=0.05;weaponKick=0.12;recoilPitch+=cfg.recoil*(aiming?0.72:1);recoilYaw+=(Math.random()-0.5)*cfg.recoil*0.8; sfx.shot(); }

function onLockChange() {
  locked = document.pointerLockElement === el.canvas;
  if (running) el.paused.classList.toggle('hidden', locked || !state.joined);
  if(!locked){keys.clear();mouseDown=false;aiming=false;}
}
const onBlur = () => { keys.clear(); mouseDown = false; };
function bindInput() {
  addEventListener('keydown', onKey); addEventListener('keyup', onKey); addEventListener('mousemove', onMouseMove);
  addEventListener('mousedown',onMouseDown);addEventListener('mouseup',onMouseUp);addEventListener('contextmenu',onContextMenu); addEventListener('blur', onBlur);
  document.addEventListener('pointerlockchange', onLockChange);
}
function unbindInput() {
  removeEventListener('keydown', onKey); removeEventListener('keyup', onKey); removeEventListener('mousemove', onMouseMove);
  removeEventListener('mousedown',onMouseDown);removeEventListener('mouseup',onMouseUp);removeEventListener('contextmenu',onContextMenu); removeEventListener('blur', onBlur);
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
  const crouched=keys.has('ControlLeft')||keys.has('ControlRight');const sp=crouched?WALK*0.48:(sprint&&!aiming?RUN:WALK); fx = fx / len * sp; fz = fz / len * sp;
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
  me.crouched=crouched;me.moving=(vx||vz)?(sprint&&!crouched?2:1):0;
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
const updHud=()=>{el.hp.textContent=Math.max(0,Math.ceil(state.hp));el.ammo.textContent=isMelee(state.weapon)?'MELEE':(state.reloading?'재장전…':`${state.ammo} / ${state.reserve}`);document.querySelectorAll('.weapon-slot').forEach(n=>n.classList.toggle('active',n.dataset.slot===state.slot));};
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
  socket.on('shot', (s) => { if (s.weapon === 'knife') return; let from = s.from; if (s.id === state.id) from = getMuzzleWorld(); else { const r = remotes.get(s.id); if (r) { r.g.updateMatrixWorld(true); const v = new THREE.Vector3(0.3,1.2,-0.62); r.g.localToWorld(v); from = [v.x,v.y,v.z]; } } tracer(from,s.to,s.tracerSpeed||200); spark(s.to, 0xffe08a); if (s.id !== state.id) sfx.shot(); });
  socket.on('hit', (h) => { flashEl(el.hitm, 'on', 80); el.hitm.classList.toggle('kill', h.killed); h.killed ? sfx.kill() : sfx.hit(); });
  socket.on('damaged', (d) => { state.hp = d.hp; updHud(); flashEl(el.vig, 'on', 150); shakeT = 0.22; shakeMag = 0.12; if (d.from) { const dx = d.from[0] - me.x, dz = d.from[1] - me.z; const ang = Math.atan2(-dx, -dz) - me.yaw; el.hurtDir.style.transform = `rotate(${ang * 180 / Math.PI}deg)`; flashEl(el.hurtDir, 'on', 450); } sfx.hurt(); });
  socket.on('ammo', (a) => { if(a.weapons)state.weapons=a.weapons;if(a.weapon){state.weapon=a.weapon;state.slot=a.slot||weaponCfg[a.weapon]?.slot||'rifle';state.loadout=a.loadout||state.loadout;state.ammo=a.ammo;state.reserve=a.reserve??0;state.reloading=a.reloading;}updHud(); });
  socket.on('weapon', (a) => { state.weapon=a.weapon;state.slot=a.slot||weaponCfg[a.weapon]?.slot||'rifle';state.loadout=a.loadout||state.loadout;state.ammo=a.ammo??0;state.reserve=a.reserve??0;state.reloading=!!a.reloading;if(a.weapons)state.weapons=a.weapons;setWeaponModel(state.weapon);updHud(); });
  socket.on('meleeSwing', (s) => { if(s.id===state.id){if(isMelee(state.weapon))playKnifeSwing();} else { const r = remotes.get(s.id); if (r) { r.a1.rotation.x = -0.8; r.a2.rotation.x = 0.8; } } });
  socket.on('correct', (c) => { me.x = c.x; me.y = c.y; me.z = c.z; me.vy = 0; });
  socket.on('kill', (k) => {
    feed(`<b>${esc(k.killer || '?')}</b> ▸ ${esc(k.victim)}`);
    if (k.victimId === state.id) { state.alive = false; state.hp = 0; updHud(); el.dead.classList.remove('hidden'); }
  });
  socket.on('respawn', (r) => {
    me.x = r.x; me.y = r.y; me.z = r.z; me.vy = 0; state.alive = true; state.hp = 100; state.ammo = r.ammo ?? 30; state.reserve = r.reserve ?? 120; state.weapon=r.weapon||state.loadout.rifle;state.slot=r.slot||'rifle';state.loadout=r.loadout||state.loadout;state.weapons=r.weapons||{}; state.reloading = false; setWeaponModel(state.weapon);
    el.dead.classList.add('hidden'); updHud();
  });
}
function setStatus(cls, txt) { el.dot.className = cls; el.stat.textContent = txt; }

// ---------- 게임 흐름 ----------
async function ensureMap() {
  if (MAP) return;
  MAP = await (await fetch('/api/map')).json(); buildMap(MAP); dressCyberCity(MAP);
}
async function startGame() {
  const name = el.nick.value.trim();
  el.err.textContent = '';
  if (name.length < 2) { el.err.textContent = '닉네임을 2자 이상 입력하세요.'; return; }
  el.canvas.requestPointerLock(); // 사용자 클릭 직후 호출해야 허용됨
  el.loading.classList.remove('hidden');
  try { await ensureMap(); } catch (_) { el.loading.classList.add('hidden'); el.err.textContent = '맵을 불러오지 못했습니다.'; return; }
  let loadout=window.NYLoadout||{rifle:'VANTA7',pistol:'DEAGLE_BLACK',knife:'GURKHA'};try{loadout=JSON.parse(sessionStorage.getItem('ny-loadout')||'null')||loadout}catch(_){}
  socket.timeout(6000).emit('join',{name,loadout}, (err, res) => {
    el.loading.classList.add('hidden');
    if (err || !res || !res.ok) { el.err.textContent = (res && res.error) || '입장 요청이 시간 초과되었습니다.'; document.exitPointerLock(); return; }
    Object.assign(state,{id:res.id,joined:true,alive:true,hp:res.hp,ammo:res.ammo,reserve:res.reserve??120,weapon:res.weapon||'VANTA7',slot:res.slot||'rifle',loadout:res.loadout||loadout,weapons:res.weapons||{},reloading:false});
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
  if (shakeT > 0) shakeT = Math.max(0, shakeT - dt); const shake = shakeT > 0 ? shakeMag * (shakeT / 0.22) : 0; camera.position.set(me.x+Math.sin(now*0.09)*shake,me.y+(me.crouched?1.05:EYE)+Math.cos(now*0.12)*shake,me.z); camera.rotation.set(me.pitch + recoilPitch, me.yaw + recoilYaw, 0);
  const aimTarget=aiming&&state.slot==='rifle'&&!keys.has('ShiftLeft')&&!keys.has('ShiftRight')?1:0; aimBlend += (aimTarget-aimBlend)*(1-Math.exp(-dt*13)); camera.fov=THREE.MathUtils.lerp(75,48,aimBlend); camera.updateProjectionMatrix(); $('cross').classList.toggle('aiming',aimBlend>0.8);
  // 사격
  const cfg=weaponCfg[state.weapon]||weaponCfg.VANTA7;
  if(mouseDown&&locked&&state.alive&&!isMelee(state.weapon)&&cfg.auto&&now-lastShotLocal>cfg.fireMs){
    if (state.ammo > 0 && !state.reloading) {
      lastShotLocal = now; state.ammo--; if (state.weapons[state.weapon]) state.weapons[state.weapon].ammo = state.ammo; updHud();
      camera.getWorldDirection(dirV);socket.emit('shoot',{dir:[dirV.x,dirV.y,dirV.z]});flash.intensity=6;flashT=0.055;weaponKick=0.075;ejectCasing();recoilPitch+=cfg.recoil*(aiming?0.72:1);recoilYaw+=(Math.random()-0.5)*cfg.recoil*0.8; sfx.shot();
    } else if (state.ammo <= 0 && !state.reloading) { lastShotLocal = now; sfx.empty(); if (state.reserve > 0) socket.emit('reload'); }
  }
  // 권총은 클릭당 한 발 (mouseDown 시작 프레임에서 처리)
  if (flashT > 0) { flashT -= dt; if (flashT <= 0) flash.intensity = 0; }
  recoilPitch *= Math.exp(-dt * 8); recoilYaw *= Math.exp(-dt * 10);
  weaponKick = Math.max(0, weaponKick - dt * 1.8);
  weaponModel.position.z = THREE.MathUtils.lerp(weaponModel.userData.basePos.z + weaponKick, -0.88 + weaponKick, aimBlend); weaponModel.position.x=THREE.MathUtils.lerp(weaponModel.userData.basePos.x,0.02,aimBlend); weaponModel.position.y=THREE.MathUtils.lerp(weaponModel.userData.basePos.y,-0.16,aimBlend); weaponModel.rotation.y=THREE.MathUtils.lerp(weaponModel.rotation.y,0,aimBlend*0.18);
  if(state.reloading&&!isMelee(state.weapon)){const reloadPhase=(now%(cfg.reloadMs||1800))/(cfg.reloadMs||1800); weaponModel.rotation.x = -Math.sin(reloadPhase * Math.PI) * 0.42; weaponModel.position.y = weaponModel.userData.basePos.y - Math.sin(reloadPhase * Math.PI) * 0.075; } else if (!isMelee(state.weapon)) { weaponModel.rotation.x *= Math.exp(-dt * 14); weaponModel.position.y += (weaponModel.userData.basePos.y - weaponModel.position.y) * Math.min(1, dt * 12); }
  if(isMelee(state.weapon)&&knifeSwingT>0) { knifeSwingT -= dt; const p=Math.max(0,knifeSwingT/0.22);const heavy=state.weapon==='GURKHA';weaponModel.rotation.x=-Math.sin((1-p)*Math.PI)*(heavy?1.55:1.12);weaponModel.rotation.y=Math.sin((1-p)*Math.PI)*(heavy?0.34:0.18); if (knifeSwingT <= 0) weaponModel.rotation.set(0,0,0); }
  // 위치 전송 (30Hz)
  sendT += dt;
  if(sendT>1/30&&state.alive){sendT=0;socket.volatile.emit('move',{x:me.x,y:me.y,z:me.z,ry:me.yaw,pitch:me.pitch,anim:me.moving,crouched:!!me.crouched});}
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
  for (let i = tracers.length - 1; i >= 0; i--) { const t = tracers[i]; t.t -= dt; t.line.material.opacity=Math.max(0,t.t/(t.life||0.08));
    if (t.t <= 0) { scene.remove(t.line); t.line.geometry.dispose(); t.line.material.dispose(); tracers.splice(i, 1); } }
  for (let i = casings.length - 1; i >= 0; i--) { const c = casings[i]; c.t -= dt; c.vy -= 7 * dt; c.mesh.position.x += c.vx * dt; c.mesh.position.y += c.vy * dt; c.mesh.position.z += c.vz * dt; c.mesh.rotation.x += dt * 9; c.mesh.rotation.z += dt * 12; if (c.mesh.position.y < 0.05) { c.mesh.position.y = 0.05; c.vy *= -0.25; c.vx *= 0.45; } if (c.t <= 0) { scene.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh.material.dispose(); casings.splice(i,1); } }
  for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.t -= dt; s.m.material.opacity = Math.max(0, s.t / 0.25);
    if (s.t <= 0) { scene.remove(s.m); s.m.material.dispose(); sparks.splice(i, 1); } }
  renderer.render(scene,camera);if(previewRenderer&&previewWeapon){previewWeapon.rotation.y=now*0.00035;previewWeapon.rotation.x=Math.sin(now*0.00022)*0.07;const r=previewCanvas.getBoundingClientRect();if(r.width&&r.height){previewRenderer.setSize(r.width,r.height,false);previewCamera.aspect=r.width/r.height;previewCamera.updateProjectionMatrix();}previewRenderer.render(previewScene,previewCamera);}
}

// ---------- 초기화 ----------
// 메뉴 배경: 맵 위를 천천히 도는 카메라
function idle(t){if(running)return;requestAnimationFrame(idle);const a=t/9000;camera.position.set(Math.cos(a)*55,22,Math.sin(a)*55);camera.lookAt(0,3,0);renderer.render(scene,camera);if(previewRenderer&&previewWeapon){previewWeapon.rotation.y=t*0.00035;previewWeapon.rotation.x=Math.sin(t*0.00022)*0.07;const r=previewCanvas.getBoundingClientRect();if(r.width&&r.height){previewRenderer.setSize(r.width,r.height,false);previewCamera.aspect=r.width/r.height;previewCamera.updateProjectionMatrix();}previewRenderer.render(previewScene,previewCamera);}}
ensureMap().then(() => requestAnimationFrame(idle)).catch(() => {});
el.nick.value = localStorage.getItem('nick') || '';
el.nick.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !el.play.disabled) startGame(); });
el.play.addEventListener('click', startGame);
el.retry.addEventListener('click', () => { el.lost.classList.add('hidden'); setStatus('', '재접속 중…'); if (socket.connected) { el.play.disabled = false; setStatus('ok', '서버 연결됨'); } else socket.connect(); });
fetch('/api/status').then(r => r.json()).then(s => { el.online.textContent = `접속 ${s.online}명`; }).catch(() => {});
connect();
