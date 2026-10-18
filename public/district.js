import * as T from 'three';
import {districtOutline} from '/shared/district.js';
export function createDistrict(scene,materials){
 const {metal,dark,orange,concrete}=materials,root=new T.Group();root.name='PLAYABLE / STATION AND SIDE STREETS';scene.add(root);
 const cyan=new T.MeshStandardMaterial({color:0x88e9e1,emissive:0x10dcca,emissiveIntensity:4});
 const pink=new T.MeshStandardMaterial({color:0xf795cc,emissive:0xe335a2,emissiveIntensity:3.8});
 const amber=new T.MeshStandardMaterial({color:0xffc18d,emissive:0xff813a,emissiveIntensity:3.3});
 const glass=new T.MeshStandardMaterial({color:0x153044,metalness:.5,roughness:.2,emissive:0x16464d,emissiveIntensity:.35});
 const batch=new Map(),unit=new T.BoxGeometry(1,1,1),pose=new T.Object3D();
 const box=(x,y,z,w,h,d,mat=metal)=>{let list=batch.get(mat);if(!list)batch.set(mat,list=[]);list.push([x,y,z,w,h,d]);};
 function sign(main,sub,x,y,z,w,h,ry=0,color='#7af7ec'){
  const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#101323';ctx.fillRect(0,0,1024,256);ctx.strokeStyle=color;ctx.lineWidth=6;ctx.strokeRect(16,16,992,224);ctx.fillStyle=color;ctx.textAlign='center';ctx.font='bold 82px Arial, sans-serif';ctx.fillText(main,512,122);ctx.font='25px Arial';ctx.fillText(sub,512,191);const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;const mesh=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map,emissiveMap:map,emissive:0xffffff,emissiveIntensity:2.5}));mesh.position.set(x,y,z);mesh.rotation.y=ry;root.add(mesh);
 }
 // The floor follows the actual perimeter, not a large square underneath it.
 const shape=new T.Shape();districtOutline.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();const floor=new T.Mesh(new T.ShapeGeometry(shape),new T.MeshStandardMaterial({color:0x26303b,metalness:.2,roughness:.35}));floor.rotation.x=-Math.PI/2;floor.position.y=-.01;root.add(floor);
 // West restaurant and alley: open doorway, kitchen, menu board and stools.
 sign('MIDNIGHT NOODLES','OPEN 24H / HAND-PULLED / SECTOR 07',-23.78,3.65,15,6.8,1.4,Math.PI/2,'#ffb57f');
 sign('麺 / NOODLES','HOT BROTH • 24H',-26,3,19.78,3.4,1,Math.PI,'#ffab90');
 for(const z of [12,18]){box(-23.70,1.8,z,.05,2,1.6,glass);box(-23.65,2.9,z,.06,.055,2.1,amber);}
 for(let z=12;z<=18;z+=1.5){box(-28.8,.45,z,.25,.9,.25,metal);box(-28.8,.94,z,.65,.1,.65,orange);box(-29.15,1.96,z,.9,.08,.75,metal);}
 for(let z=12;z<19;z+=.75){box(-29.8,2.1,z,.65,.12,.12,amber);box(-29.8,3.2,z,.4,.12,.35,dark);}
 sign('BOWL 07 / 120','NOODLE / SOUP / TEA',-30.65,3.3,15,4,1.5,Math.PI/2,'#f6ba88');
 // East kitchen and street-facing food signs.
 sign('KAIRO KITCHEN','RICE / GRILL / LATE SERVICE',23.78,3.7,-15.5,6.8,1.4,-Math.PI/2,'#f4a8e7');
 for(const z of [-18.8,-12.2]){box(23.7,1.9,z,.05,2.1,1.5,glass);box(23.65,3,z,.08,.07,2,pink);}
 for(let z=-17.5;z<-13;z+=.8){box(29.8,2.08,z,.85,.10,.45,metal);const stove=new T.Mesh(new T.TorusGeometry(.16,.025,6,16),amber);stove.rotation.x=-Math.PI/2;stove.position.set(29.7,2.15,z);root.add(stove);}
 sign('01 / 02 / 03','GRILL — RICE — DRINKS',30.9,3.3,-15.5,4.2,1.3,-Math.PI/2,'#ecb8fa');
 // Lit alley entry frames leave the existing walking openings clear.
 for(const [x,z,color] of [[-22,15,amber],[22,-15.5,pink]]){for(const dz of [-3,3])box(x,3,z+dz,.08,6,.08,color);box(x,6,z,.08,.08,6,color);}
 sign('LANTERN ALLEY','NIGHT MARKET / WEST',-21.8,4.8,15,5.5,1.05,Math.PI/2,'#ffb57f');
 sign('FOOD COURT','EAST / OPEN ALL NIGHT',21.8,4.8,-15.5,5.5,1.05,-Math.PI/2,'#f5a1e3');
 for(const side of [-1,1])for(let z=side<0?10:-20;z<(side<0?22:-10);z+=2.4){const lantern=new T.Mesh(new T.SphereGeometry(.22,12,8),side<0?amber:pink);lantern.scale.y=1.4;lantern.position.set(side<0?-22:22,3.2,z);root.add(lantern);box(side<0?-22:22,4.1,z,.025,1.2,.025,dark);}
 // Station is an accessible place with a ramp and boarding platform.
 sign('YARD STATION','M07 / SURFACE TRANSIT / PLATFORM 1',9,5.9,-21.8,14,1.1,0,'#85eaff');
 sign('RAMP / REAR ACCESS','FOLLOW THE CYAN LINE',21,1.6,-22.5,2.7,.7,0,'#8bf7de');
 box(22,.025,-28,.045,.02,13,cyan);
 sign('M07  →','PLATFORM ACCESS / VIA RAMP',18,2.1,-34.65,4,1.1,0,'#8bf7de');
 for(const z of [-34.5,-22.5]){box(10.5,6.05,z,23,.07,.10,cyan);box(10.5,6.46,z,23,.055,.10,pink);}
 for(let x=-1;x<22;x+=2){box(x,6.02,-29,1.4,.06,7.5,cyan);}
 for(const x of [2,4]){box(x,1.45,-33.87,.65,.6,.035,cyan);box(x,.55,-33.86,.65,.08,.035,pink);}
 // Track on the station slab; static train, no unimplemented ride prompt.
 for(const z of [-30,-28])box(7,2.43,z,23,.10,.08,metal);
 for(let x=-3;x<19;x+=.65)box(x,2.36,-29,.16,.12,3,dark);
 for(const z of [-30.38,-27.62]){box(6,3.2,z,17.7,.13,.03,cyan);for(let x=-1.5;x<14;x+=2.1){box(x,4.12,z,1.6,.85,.035,glass);box(x,4.64,z,1.8,.055,.045,pink);}}
 // Visible bogies, sliding-door seams and carriage joints on the static train.
 for(const z of [-30.40,-27.60]){for(const x of [0,6,12]){box(x,3.75,z,1.1,2.0,.04,dark);box(x-.29,4.12,z+(z<-29?-.025:.025),.46,.72,.018,glass);box(x+.29,4.12,z+(z<-29?-.025:.025),.46,.72,.018,glass);box(x,3.7,z+(z<-29?-.035:.035),.035,1.95,.022,metal);}
 for(const x of [-1,2.5,9.5,13]){const wheel=new T.Mesh(new T.CylinderGeometry(.23,.23,.18,14),dark);wheel.rotation.x=Math.PI/2;wheel.position.set(x,2.65,z+(z<-29?.30:-.30));root.add(wheel);}}
 for(const x of [3,9]){box(x,3.8,-27.56,.10,2.3,.04,dark);box(x,3.8,-30.44,.10,2.3,.04,dark);box(x,5.16,-29,.10,.06,2.8,dark);}
 sign('M07 / NIGHTLINE','YARD — CORE — UPPER CITY',6,3.65,-27.59,6,.65,0,'#7af7ec');
 box(6,5.12,-29,17.5,.13,2.5,dark);for(const x of [-2.5,14.5])box(x,3.9,-29,.18,1.8,2.65,metal);
 for(let x=-2;x<20;x+=.35)box(x,2.415,-25.75,.12,.025,.24,amber);
 // Neon reflects through the existing street reflector and these local sources.
 for(const [x,y,z,color,power] of [[-26,3,15,0xff8c44,90],[-21,3,15,0xff5b7d,70],[27,3,-15.5,0xe945bd,95],[21,3,-15.5,0x8b46df,65],[10,5,-24,0x30dce8,100],[8,4,-33,0xbb42dd,85]]){const l=new T.PointLight(color,power,15,2);l.position.set(x,y,z);root.add(l);}
 for(const [material,list] of batch){const mesh=new T.InstancedMesh(unit,material,list.length);for(let i=0;i<list.length;i++){const [x,y,z,w,h,d]=list[i];pose.position.set(x,y,z);pose.scale.set(w,h,d);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);}mesh.computeBoundingSphere();root.add(mesh);}
 return root;
}
