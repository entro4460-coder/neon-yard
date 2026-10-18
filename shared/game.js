export const weapons=[{name:'VANTA-7',mag:30,rate:110,damage:28,reload:1800,spread:.008},{name:'KRAIT-4',mag:36,rate:72,damage:19,reload:1400,spread:.016},{name:'ORACLE-X',mag:8,rate:800,damage:85,reload:2300,spread:.001}];
// Shared collision geometry: walls have real entrance gaps.
export const boxes=[
 [-19,3,-5,.5,6,18],[-15,3,-14,8,6,.5],[-15,3,4,8,6,.5],
 [-11,3,-11,.5,6,6],[-11,3,1,.5,6,6],[-15,6,-5,8,.3,18],
 [19,4,5,.5,8,18],[15,4,-4,8,8,.5],[15,4,14,8,8,.5],
 [11,4,-1,.5,8,6],[11,4,11,.5,8,6],[15,8,5,8,.3,18],
 [-16,1,-8,4,2,1],[-17,1,-1,2,2,2],[16,1.4,9,3,2.8,3],
 [-6,1.2,0,3,2.4,3],[6,1.2,-6,3,2.4,5],[0,2,10,5,4,4],[0,1,-12,4,2,3],
 [-24,5,0,2,10,52],[24,5,0,2,10,52],[0,5,-26,50,10,2],[0,5,26,50,10,2]
];
export const platforms=[{x:15,z:8,w:7,d:6,y:3}];
export const ramps=[{x:15,z:2,w:3,d:6,low:0,high:3}];
// Physical rail bars/posts also drive rendering and hitscan.
export const rails=[];
for(const p of platforms){
 const segments=[[p.x-p.w/2,p.z,.06,p.d],[p.x+p.w/2,p.z,.06,p.d],[p.x,p.z+p.d/2,p.w,.06],[12.5,p.z-p.d/2,2,.06],[17.5,p.z-p.d/2,2,.06]];
 for(const [x,z,w,d] of segments){for(const y of [.45,1])rails.push([x,p.y+y,z,w,.06,d]);const n=Math.max(1,Math.ceil(Math.max(w,d)/1.5));for(let i=0;i<=n;i++)rails.push([x+(w>.1?(i/n-.5)*w:0),p.y+.5,z+(d>.1?(i/n-.5)*d:0),.05,1,.05]);}
}
export function rayRamp(o,d,p){
 const angle=Math.atan2(p.high-p.low,p.d),c=Math.cos(angle),s=Math.sin(angle);
 const center=(p.high+p.low)/2-.075/c,dy=o[1]-center,dz=o[2]-p.z;
 return rayBox([o[0]-p.x,c*dy-s*dz,s*dy+c*dz],[d[0],c*d[1]-s*d[2],s*d[1]+c*d[2]],[0,0,0,p.w,.15,Math.hypot(p.d,p.high-p.low)]);
}
export function coverDistance(o,d,door=false){return Math.min(150,...[...boxes,...rails,...platforms.map(p=>[p.x,p.y-.1,p.z,p.w,.2,p.d]),...(door?[[0,1.5,3,4,3,.4]]:[])].map(b=>rayBox(o,d,b)),...ramps.map(p=>rayRamp(o,d,p)));}
export function floorAt(x,z){let y=0;for(const p of platforms)if(Math.abs(x-p.x)<p.w/2&&Math.abs(z-p.z)<p.d/2)y=Math.max(y,p.y);for(const p of ramps)if(Math.abs(x-p.x)<p.w/2&&Math.abs(z-p.z)<p.d/2)y=Math.max(y,p.low+(z-(p.z-p.d/2))/p.d*(p.high-p.low));return y;}

export function blocked(x,y,z,h=1.8,door=false){return [...boxes,...rails,...(door?[[0,1.5,3,4,3,.4]]:[])].some(b=>Math.abs(x-b[0])<b[3]/2+.3&&Math.abs(z-b[2])<b[5]/2+.3&&y<b[1]+b[4]/2&&y+h>b[1]-b[4]/2);}
export function move(p,i,dt,door){
 const standingBlocked=blocked(p.x,p.y,p.z,1.8,door);
 const crouch=!!i.crouch||(!!p.crouch&&standingBlocked);
 const h=crouch?1.1:1.8,s=crouch?2:i.sprint&&!i.ads?8:5.5;
 let x=Number(i.x)||0,z=Number(i.z)||0;const l=Math.max(1,Math.hypot(x,z));x/=l;z/=l;
 const dx=(x*Math.cos(p.yaw)+z*Math.sin(p.yaw))*s*dt,dz=(-x*Math.sin(p.yaw)+z*Math.cos(p.yaw))*s*dt;
 const oldFloor=floorAt(p.x,p.z),grounded=p.y<=oldFloor+.04;
 for(const [nx,nz] of [[p.x+dx,p.z],[null,p.z+dz]]){
  const tx=nx===null?p.x:nx,tz=nz,ground=floorAt(tx,tz);
  if(ground>p.y+.22)continue;
  const ty=grounded?Math.max(p.y,ground):p.y;
  if(!blocked(tx,ty,tz,h,door)){p.x=tx;p.z=tz;if(grounded)p.y=ty;}
 }
 const ground=floorAt(p.x,p.z);
 if(i.jump&&grounded)p.vy=6;
 p.vy-=18*dt;p.y=Math.max(ground,p.y+p.vy*dt);if(p.y===ground)p.vy=0;p.crouch=crouch;
}

export function rayBox(o,d,b){let lo=0,hi=200;for(let k=0;k<3;k++){const a=b[k]-b[k+3]/2,c=b[k]+b[k+3]/2;if(Math.abs(d[k])<1e-8){if(o[k]<a||o[k]>c)return Infinity;continue;}let t=(a-o[k])/d[k],u=(c-o[k])/d[k];if(t>u)[t,u]=[u,t];lo=Math.max(lo,t);hi=Math.min(hi,u);if(lo>hi)return Infinity;}return lo;}

// Radians, evaluated from the server clock; cosmetic kick is separate.
export const handling=[
 {kick:.018,cap:.12,recovery:5,visual:.045,fov:54},
 {kick:.012,cap:.09,recovery:6,visual:.032,fov:58},
 {kick:.052,cap:.13,recovery:3.8,visual:.085,fov:36}
];
export function recoilAt(p,now){return (p.kickPitch||0)*Math.exp(-handling[p.weapon].recovery*Math.max(0,now-(p.kickTime||0))/1000);}
export function nextRecoil(p,now,ads){const h=handling[p.weapon];return Math.min(h.cap,recoilAt(p,now)+h.kick*(ads?.65:1));}
export function reloadPose(progress){
 const t=Math.max(0,Math.min(1,progress)),smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
 const dip=smooth(t/.15)*(1-smooth((t-.86)/.14));
 const magazine=smooth((t-.18)/.18)*(1-smooth((t-.51)/.2));
 const bolt=smooth((t-.74)/.06)*(1-smooth((t-.82)/.06));
 const slap=Math.sin(Math.PI*Math.max(0,Math.min(1,(t-.67)/.07)));
 return {dip,magazine,bolt,slap,phase:t<.18?'RELEASE':t<.51?'MAG OUT':t<.74?'MAG IN':t<.88?'CHAMBER':'READY'};
}
