import * as T from 'three';
import {cityBlocks} from '/shared/city.js';

export function createCity(scene,materials){
 const {metal,dark,orange,concrete}=materials;
 const root=new T.Group();root.name='NEON YARD / CITY BLOCK';scene.add(root);
 // Reuse primitive geometry and batch every repeated facade component.
 const batches=new Map(),unit=new T.BoxGeometry(1,1,1),pose=new T.Object3D();
 const box=(x,y,z,w,h,d,mat=metal)=>{let batch=batches.get(mat);if(!batch)batches.set(mat,batch=[]);batch.push([x,y,z,w,h,d]);};
 const warm=new T.MeshStandardMaterial({color:0x6f786c,emissive:0xd4a16d,emissiveIntensity:.55,roughness:.3,metalness:.35});
 const cool=new T.MeshStandardMaterial({color:0x253e50,emissive:0x6498ad,emissiveIntensity:.38,roughness:.25,metalness:.4});
 const glass=new T.MeshStandardMaterial({color:0x101e29,metalness:.55,roughness:.22});
 const stone=new T.MeshStandardMaterial({color:0x656465,roughness:.9});
 const teal=new T.MeshStandardMaterial({color:0x81c7c0,emissive:0x409d99,emissiveIntensity:1.1,roughness:.3});
 const amber=new T.MeshStandardMaterial({color:0xd2a07b,emissive:0xc17748,emissiveIntensity:.9,roughness:.3});
 function sign(text,subtitle,x,y,z,w,h,rotation=0,color='#a9ded8'){
  const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#0c151f';ctx.fillRect(0,0,1024,256);ctx.fillStyle=color;ctx.font='600 94px Arial, sans-serif';ctx.textAlign='center';ctx.fillText(text,512,125);ctx.fillStyle='#91a4ac';ctx.font='24px Arial';ctx.letterSpacing='6px';ctx.fillText(subtitle,512,192);ctx.fillStyle=color;ctx.fillRect(60,221,904,3);
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map:t,emissiveMap:t,emissive:0xffffff,emissiveIntensity:.65,roughness:.6}));m.position.set(x,y,z);m.rotation.y=rotation;root.add(m);
 }
 for(const b of cityBlocks){
  const top=b.base+b.height;
  // Floor bands, inset windows and slim mullions on all four elevations.
  for(let y=b.base+2;y<top-1;y+=3.3){
   box(b.x,y-1.45,b.z,b.w+.15,.16,b.d+.15,stone);
   for(const face of [-1,1]){
    for(let x=b.x-b.w/2+1;x<b.x+b.w/2-.4;x+=1.65){const lit=(Math.floor((x+100)*3+y*2)%7)<3;box(x,y,b.z+face*(b.d/2+.035),1.25,1.9,.045,lit?(b.tone==='market'?warm:cool):glass);box(x-.71,y,b.z+face*(b.d/2+.07),.045,2.3,.11,metal);}
    for(let z=b.z-b.d/2+1;z<b.z+b.d/2-.4;z+=1.8){const lit=(Math.floor((z+120)*2+y)%7)<3;box(b.x+face*(b.w/2+.035),y,z,.045,1.9,1.35,lit?(b.tone==='market'?warm:cool):glass);box(b.x+face*(b.w/2+.07),y,z-.78,.11,2.3,.045,metal);}
   }
  }
  for(const side of [-1,1])box(b.x+side*(b.w/2-.1),b.base+b.height/2,b.z,.2,b.height,b.d+.2,stone);
  box(b.x,top+.14,b.z,b.w+.3,.3,b.d+.3,metal);
  // Rooftop equipment sits on roofs, never inside movement lanes.
  box(b.x,top+.8,b.z,2.5,1.3,2.8,dark);box(b.x+.4,top+1.6,b.z,.08,1.2,.08,metal);
 }
 // Street-level shopfronts face the actual crossing and existing entrances.
 for(const side of [-1,1]){
  const face=side<0?-10.68:10.68,normal=side<0?1:-1;
  const segments=side<0?[-11,1]:[-1,11];
  for(const z of segments){
   box(face,1.6,z,.06,2.9,4.8,glass);
   for(const dz of [-2.45,0,2.45])box(face+normal*.04,1.6,z+dz,.10,3,.07,metal);
   box(face+normal*.30,3.2,z,.85,.2,5.2,side<0?orange:metal);
   box(face+normal*.75,3.1,z,.05,.035,4.9,side<0?amber:teal);
  }
  // Entrance portal has a full-height opening, matching shared collision gaps.
  const center=side<0?-5:5;
  for(const dz of [-2.7,2.7])box(face+normal*.02,1.65,center+dz,.2,3.3,.16,metal);
  box(face+normal*.02,3.35,center,.2,.2,5.55,metal);
  for(let z=center-2.2;z<center+2.3;z+=.55)box(face+normal*.1,.025,z,.5,.02,.15,stone);
 }
 sign('AFTERHOURS','REPAIR / HARDWARE / 24H',-10.5,4.25,-5,7,1.6,Math.PI/2,'#e5ad87');
 sign('KAIRO SYSTEMS','AUGMENTATION • SERVICE 07',10.5,4.5,5,7,1.6,-Math.PI/2);
 sign('NIGHT LINE','YARD DISTRICT / NEXT TRANSIT 04:20',0,6.4,-24.7,11,2.5,0,'#afc5d9');
 sign('VANDAL','NO SIGNAL. NO MASTERS.',-10.87,13,-4,7,3,Math.PI/2,'#d0a29c');
 sign('07','KAIRO / LOWER CITY',10.87,16,5,5,6,-Math.PI/2,'#9ebbbf');
 // Corner signage facing the spawn approach and cross-street.
 sign('AFTERHOURS','OPEN ALL NIGHT',-15,4.7,4.28,6,1.25,0,'#e5ad87');
 sign('KAIRO','DISTRICT SERVICES',15,6.1,14.28,6,1.4,0);
 // Closed service booth replaces the central featureless solid cover volume.
 box(0,3.1,12.04,4.5,1.3,.04,glass);box(0,3.95,10,5.15,.12,4.15,metal);
 sign('YARD TRANSIT','LOCAL NETWORK / OFFLINE',0,2.9,12.08,4.3,.9,0,'#b4c4ce');
 // Thin road paint and crossing markings do not add movement obstacles.
 for(let z=-22;z<24;z+=4)box(0,.009,z,.10,.008,1.5,stone);
 for(const x of [-8.2,8.2])box(x,.01,0,.10,.008,47,stone);
 for(let z=16;z<20;z+=.65)box(0,.012,z,9,.008,.3,stone);
 // Elevated utility gantry frames the street; only outside the jump envelope.
 for(const z of [-17,17]){box(0,9,z,22,.28,.8,dark);for(const x of [-8,-4,0,4,8])box(x,8.8,z,.035,.06,.9,amber);}
 // Hanging cables form a sagging silhouette against the urban skyline.
 for(const z of [-15,15])for(let j=0;j<3;j++){
  const curve=new T.CatmullRomCurve3([new T.Vector3(-11,10+j*.3,z),new T.Vector3(0,8.4+j*.25,z+.6),new T.Vector3(11,11+j*.3,z)]);
  root.add(new T.Mesh(new T.TubeGeometry(curve,24,.025,5,false),dark));
 }
 // Render repeated city geometry in a handful of batches.
 for(const [material,items] of batches){const instanced=new T.InstancedMesh(unit,material,items.length);for(let i=0;i<items.length;i++){const [x,y,z,w,h,d]=items[i];pose.position.set(x,y,z);pose.scale.set(w,h,d);pose.updateMatrix();instanced.setMatrixAt(i,pose.matrix);}instanced.computeBoundingSphere();root.add(instanced);}
 return root;
}
