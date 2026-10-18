import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
const finishes={
 armor:new T.MeshStandardMaterial({color:0x303942,metalness:.68,roughness:.31}),
 ceramic:new T.MeshStandardMaterial({color:0x9ca6a7,metalness:.32,roughness:.38}),
 steel:new T.MeshStandardMaterial({color:0x657781,metalness:.92,roughness:.22}),
 rubber:new T.MeshStandardMaterial({color:0x10161c,metalness:.02,roughness:.86}),
 accent:new T.MeshStandardMaterial({color:0x9c6144,metalness:.5,roughness:.4})
};
export function createWeapon(index,materials){
 const gun=new T.Group();gun.name=['VANTA-7','KRAIT-4','ORACLE-X'][index];
 const {armor,ceramic,steel,rubber,accent}=finishes,light=materials.cyan;
 const add=(g,m,x=0,y=0,z=0,parent=gun)=>{const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
 const box=(x,y,z,w,h,d,m=armor,parent=gun)=>add(new RoundedBoxGeometry(w,h,d,2,Math.min(.014,w*.16,h*.16,d*.16)),m,x,y,z,parent);
 function profile(points,width,m=armor,x=0,y=0,z=0,parent=gun){const shape=new T.Shape();points.forEach(([long,up],i)=>i?shape.lineTo(long,up):shape.moveTo(long,up));shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth:width,bevelEnabled:true,bevelSegments:3,bevelSize:.009,bevelThickness:.008,steps:1});g.translate(0,0,-width/2);g.rotateY(-Math.PI/2);return add(g,m,x,y,z,parent);}
 const tube=(x,y,z,r,l,m=steel,open=false,parent=gun)=>{const o=add(new T.CylinderGeometry(r,r,l,20,1,open),m,x,y,z,parent);o.rotation.x=Math.PI/2;return o;};
 const ring=(x,y,z,r,th=.008,m=steel,parent=gun)=>add(new T.TorusGeometry(r,th,8,28),m,x,y,z,parent);
 const profiles=[
 [[-.53,-.07],[-.49,.045],[-.35,.105],[.24,.105],[.36,.02],[.28,-.13],[.04,-.14],[-.04,-.06]],
 [[-.34,-.07],[-.34,.08],[-.22,.13],[.23,.10],[.29,.025],[.19,-.115],[.02,-.115],[-.10,-.055]],
 [[-.71,-.04],[-.63,.04],[-.37,.085],[.30,.085],[.38,.01],[.26,-.12],[-.02,-.12],[-.14,-.045]]
 ];
 profile(profiles[index],index===1?.19:.165);
 const front=[-.54,-.35,-.74][index],muzzleZ=[-.94,-.65,-1.29][index];
 tube(0,-.015,(front+muzzleZ)/2,index===2?.027:.034,front-muzzleZ,steel);
 tube(0,-.015,muzzleZ+.035,index===2?.044:.057,.09,armor,true);ring(0,-.015,muzzleZ-.012,index===2?.044:.057,.007,steel);
 // Coherent outer armor follows receiver lines, leaving seams and a separate lower receiver.
 for(const side of [-1,1]){
  const panel=index===1?[[-.29,-.015],[-.23,.082],[.12,.064],[.18,.015],[.1,-.045],[-.18,-.045]]:[[-.44,-.015],[-.34,.072],[.18,.072],[.27,.015],[.18,-.06],[-.18,-.06]];
  profile(panel,.012,index===2?ceramic:armor,side*.092);
  box(side*.103,.028,.09,.009,.032,.14,rubber);box(side*.111,.035,.11,.005,.011,.065,light);
  for(const z of [-.17,.23]){const fastener=tube(side*.105,-.018,z,.014,.009,steel);fastener.rotation.set(0,0,Math.PI/2);}
 }
 profile([[-.13,-.08],[.22,-.08],[.24,-.15],[.09,-.19],[-.09,-.17]],.14,rubber);
 // Sculpted grip, open trigger guard and separate trigger.
 profile([[.13,-.12],[.25,-.13],[.31,-.39],[.20,-.41],[.14,-.32]],.10,rubber);
 for(let j=0;j<5;j++)box(.057,-.20-j*.035,.22+j*.012,.007,.012,.075,armor);
 profile([[-.05,-.13],[-.02,-.28],[.15,-.29],[.16,-.26],[.02,-.25],[-.02,-.13]],.08,steel);
 const trigger=ring(0,-.17,.075,.037,.006,rubber);trigger.rotation.y=Math.PI/2;
 // Magazine profiles now distinguish curved rifle, straight SMG and short precision box.
 const magazine=new T.Group();magazine.position.set(0,-.23,-.1);magazine.rotation.x=.15;gun.add(magazine);
 const magPoints=index===0?[[-.09,.08],[.09,.08],[.10,-.12],[.17,-.32],[.02,-.35],[-.06,-.13]]:index===1?[[-.055,.07],[.055,.07],[.065,-.32],[-.055,-.32]]:[[-.08,.07],[.08,.07],[.08,-.14],[-.08,-.14]];
 profile(magPoints,index===1?.082:.105,armor,0,0,0,magazine);
 for(let i=0;i<4;i++)box(.058,-.07-i*.045,index===0?.01+i*.018:0,.008,.015,index===1?.065:.1,rubber,magazine);
 if(index===0){
  profile([[-.58,-.065],[-.55,.06],[-.36,.095],[-.22,.04],[-.24,-.075]],.18,ceramic);
  for(const side of [-1,1])for(let n=0;n<5;n++)box(side*.102,.015,-.50+n*.045,.007,.026,.025,rubber);
  profile([[.31,.035],[.58,.02],[.69,-.03],[.67,-.16],[.54,-.20],[.35,-.10]],.12,armor);box(0,-.08,.69,.14,.23,.035,rubber);box(0,.075,.47,.105,.055,.20,ceramic);
 }else if(index===1){
  // Compact enclosed forward shroud and split skeletal shoulder frame.
  profile([[-.43,-.06],[-.43,.065],[-.30,.11],[-.19,.045],[-.22,-.065]],.21,armor);
  for(const side of [-1,1]){box(side*.06,.01,.39,.018,.025,.31,steel);box(side*.05,-.10,.37,.018,.025,.28,steel);}box(0,-.04,.54,.14,.20,.035,rubber);
 }else{
  profile([[-.76,-.05],[-.72,.045],[-.38,.07],[-.25,.02],[-.30,-.065]],.145,ceramic);
  profile([[.30,.035],[.67,.03],[.77,-.04],[.70,-.17],[.53,-.21],[.37,-.13]],.125,armor);box(0,-.08,.77,.15,.25,.035,rubber);box(0,.08,.52,.13,.07,.21,ceramic);
  for(const side of [-1,1]){const leg=box(side*.06,-.15,-.55,.025,.23,.035,steel);leg.rotation.z=side*.2;}
 }
 // Rail teeth, sight mount and a clear center line at y=.21 for ADS.
 for(let n=0;n<9;n++)box(0,.119,-.27+n*.049,.105,.014,.022,steel);
 if(index===2){tube(0,.21,-.09,.066,.32,armor,true);for(const z of [-.25,.07])ring(0,.21,z,.067,.01,steel);box(.09,.23,-.08,.045,.065,.06,steel);box(0,.135,-.09,.045,.08,.05,steel);}
 else {const sight=ring(0,.21,.025,index===1?.044:.05,.009,armor);sight.scale.y=.86;box(0,.14,.025,.035,.07,.035,steel);}
 box(0,.21,-.27,.009,.012,.015,light);
 const bolt=box(.109,.065,.12,.045,.035,.12,steel);
 function glove(x,y,z,parent=gun){const hand=new T.Group();hand.position.set(x,y,z);parent.add(hand);box(0,0,0,.12,.105,.15,rubber,hand);box(.01,.055,.005,.10,.025,.10,armor,hand);for(let f=0;f<4;f++){const finger=add(new T.CapsuleGeometry(.014,.055,3,6),rubber,-.043+f*.029,-.014,-.073,hand);finger.rotation.x=1.15;}const thumb=box(.07,-.012,0,.035,.045,.07,rubber,hand);thumb.rotation.z=-.5;return hand;}
 const supportHand=glove(-.07,-.14,-.34);const firingHand=glove(.08,-.31,.25);
 // Sleeves connect to each palm instead of floating beneath the weapon.
 function sleeve(hand,end){const direction=end.clone();const arm=add(new T.CapsuleGeometry(.056,direction.length()-.06,4,10),rubber,direction.x/2,direction.y/2,direction.z/2,hand);arm.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize());}
 sleeve(supportHand,new T.Vector3(-.07,-.39,.42));sleeve(firingHand,new T.Vector3(.10,-.32,.32));
 return {gun,magazine,bolt,supportHand,muzzleZ};
}
