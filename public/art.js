import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Bevelled, smooth-shaded mechanical geometry. All artwork is generated here.
export function createWeapon(index,materials){
 const {metal,dark,orange,cyan}=materials;
 const gun=new T.Group();gun.name=['VANTA-7','KRAIT-4','ORACLE-X'][index];
 const mesh=(g,m,x,y,z,parent=gun)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);parent.add(o);return o;};
 const box=(x,y,z,w,h,d,m=dark,parent=gun)=>mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(.018,w*.18,h*.18,d*.18)),m,x,y,z,parent);
 const tube=(x,y,z,r,length,m=metal,parent=gun)=>{const o=mesh(new T.CylinderGeometry(r,r,length,20,1,true),m,x,y,z,parent);o.rotation.x=Math.PI/2;return o;};
 const ring=(x,y,z,r,width,m=metal,parent=gun)=>mesh(new T.TorusGeometry(r,width,8,24),m,x,y,z,parent);
 // Side profiles are extruded and bevelled, rather than stacked cuboids.
 const profiles=[
 [[-.43,-.07],[-.38,.09],[.21,.10],[.36,.02],[.29,-.10],[-.05,-.11]],
 [[-.30,-.06],[-.24,.11],[.18,.11],[.24,.03],[.19,-.09],[-.12,-.10]],
 [[-.56,-.06],[-.48,.07],[.30,.07],[.38,-.01],[.26,-.10],[-.20,-.09]]
 ];
 const profile=profiles[index],shape=new T.Shape();profile.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
 const geometry=new T.ExtrudeGeometry(shape,{depth:.14,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.012,bevelThickness:.012});geometry.translate(0,0,-.07);geometry.rotateY(-Math.PI/2);mesh(geometry,dark,0,0,0);
 const front=[-.48,-.32,-.72][index],muzzleZ=[-.84,-.62,-1.18][index];
 tube(0,-.015,(front+muzzleZ)/2,.033,front-muzzleZ,metal);tube(0,-.015,muzzleZ+.035,index===2?.045:.06,.09,dark);ring(0,-.015,muzzleZ-.01,index===2?.044:.058,.009);
 // Forward handguard: long ventilated rifle / short shroud / precision cage.
 box(0,-.015,front+.14,index===1?.21:.17,.14,index===2?.38:.27,index===1?orange:metal);
 for(const side of [-1,1]){for(let n=0;n<(index===1?3:5);n++)box(side*.091,.015,front+.02+n*.05,.012,.025,.026,dark);box(side*.08,-.008,.08,.018,.11,index===1?.20:.30,metal);box(side*.094,.022,.12,.005,.018,.09,cyan);}
 const grip=box(0,-.2,.19,.10,.27,.12,dark);grip.rotation.x=-.24;
 // Open trigger guard with a separate curved trigger.
 box(0,-.31,.095,.095,.025,.20,metal);box(0,-.23,.005,.025,.15,.025,metal);const trigger=ring(0,-.16,.06,.042,.008,dark);trigger.rotation.y=Math.PI/2;
 const magazine=new T.Group();magazine.position.set(0,-.23,-.1);magazine.rotation.x=.15;gun.add(magazine);
 box(0,-.035,0,index===1?.08:.105,index===2?.17:.28,index===2?.12:.16,metal,magazine);box(0,index===2?-.13:-.19,.018,index===1?.10:.125,.04,.18,dark,magazine);
 for(let n=0;n<3;n++)box(.057,-.10+n*.055,.02,.007,.014,.10,dark,magazine);
 // Individually recognizable stocks and sight assemblies.
 const stockEnd=index===1?.39:index===2?.66:.56;
 if(index===1){for(const side of [-1,1])tube(side*.055,.015,.32,.014,.25,metal);box(0,.01,stockEnd,.16,.20,.04,dark);}
 else {box(0,-.01,.37,.09,.10,.24,metal);box(0,.0,stockEnd-.05,index===2?.13:.15,.16,.24,dark);box(0,0,stockEnd+.08,.17,.24,.035,metal);box(0,.10,stockEnd-.08,.12,.045,.17,dark);}
 for(let n=0;n<9;n++)box(0,.112,-.28+n*.054,.105,.015,.025,metal);
 if(index===2){
  // Open optical tube: visible bore remains aligned with the view axis.
  tube(0,.21,-.07,.072,.24,dark);for(const z of [-.19,.05])ring(0,.21,z,.072,.013,metal);box(.10,.22,-.07,.06,.06,.06,metal);box(0,.11,-.08,.055,.10,.05,metal);
  for(const side of [-1,1]){const leg=box(side*.06,-.19,-.51,.025,.30,.035,metal);leg.rotation.z=side*.19;}
 }else{ring(0,.21,.03,index===1?.048:.055,.01,dark);box(0,.13,.03,.035,.10,.035,metal);}
 box(0,.21,-.21,.012,.014,.016,cyan);
 const bolt=box(.105,.07,.12,.045,.04,.13,metal);
 const supportHand=box(-.07,-.19,-.34,.14,.13,.19,dark);box(.08,-.31,.25,.14,.20,.15,dark);
 return {gun,magazine,bolt,supportHand,muzzleZ};
}

export function materialMaps(base,kind='metal',maxAnisotropy=4){
 const n=512,c=document.createElement('canvas');c.width=c.height=n;const ctx=c.getContext('2d');ctx.fillStyle=base;ctx.fillRect(0,0,n,n);
 let seed=137;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 // Fine grain, anti-aliased brushing and hairline wear replace pixel blocks.
 for(let i=0;i<8000;i++){ctx.strokeStyle=random()>.5?'#ffffff0a':'#0000000c';ctx.lineWidth=.4+random()*.5;const x=random()*n,y=random()*n;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(kind==='metal'?12:2)*random(),y+random());ctx.stroke();}
 if(kind==='concrete'){ctx.strokeStyle='#03070b30';ctx.lineWidth=.8;for(let i=0;i<12;i++){ctx.beginPath();let x=random()*n,y=random()*n;ctx.moveTo(x,y);for(let j=0;j<4;j++){x+=random()*20-10;y+=random()*18;ctx.lineTo(x,y);}ctx.stroke();}}
 const rough=document.createElement('canvas');rough.width=rough.height=n;const rc=rough.getContext('2d');rc.fillStyle=kind==='metal'?'#858585':'#cecece';rc.fillRect(0,0,n,n);for(let i=0;i<1000;i++){rc.fillStyle=`rgba(255,255,255,${random()*.08})`;rc.fillRect(random()*n,random()*n,random()*30,1);}
 const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;const roughnessMap=new T.CanvasTexture(rough);
 for(const t of [map,roughnessMap]){t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=Math.min(8,maxAnisotropy);}
 return {map,roughnessMap};
}
