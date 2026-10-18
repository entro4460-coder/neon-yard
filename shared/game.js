export const weapons=[{name:'VANTA-7',mag:30,rate:110,damage:28,reload:1800,spread:.008},{name:'KRAIT-4',mag:36,rate:72,damage:19,reload:1400,spread:.016},{name:'ORACLE-X',mag:8,rate:800,damage:85,reload:2300,spread:.001}];
export const boxes=[[-15,3,-5,8,6,18],[15,4,5,8,8,18],[-6,1.2,0,3,2.4,3],[6,1.2,-6,3,2.4,5],[0,2,10,5,4,4],[0,1,-12,4,2,3],[-24,5,0,2,10,52],[24,5,0,2,10,52],[0,5,-26,50,10,2],[0,5,26,50,10,2]];
export function blocked(x,y,z,h=1.8,door=false){return [...boxes,...(door?[[0,1.5,3,4,3,.4]]:[])].some(b=>Math.abs(x-b[0])<b[3]/2+.3&&Math.abs(z-b[2])<b[5]/2+.3&&y<b[1]+b[4]/2&&y+h>b[1]-b[4]/2);}
export function move(p,i,dt,door){const h=i.crouch?1.1:1.8,s=i.walk?2.4:i.crouch?2:5.5;let x=Number(i.x)||0,z=Number(i.z)||0;const l=Math.max(1,Math.hypot(x,z));x/=l;z/=l;const yaw=p.yaw;const dx=(x*Math.cos(yaw)+z*Math.sin(yaw))*s*dt,dz=(-x*Math.sin(yaw)+z*Math.cos(yaw))*s*dt;if(!blocked(p.x+dx,p.y,p.z,h,door))p.x+=dx;if(!blocked(p.x,p.y,p.z+dz,h,door))p.z+=dz;if(i.jump&&p.y<=0)p.vy=6;p.vy-=18*dt;p.y=Math.max(0,p.y+p.vy*dt);if(p.y===0)p.vy=0;p.crouch=!!i.crouch;}
export function rayBox(o,d,b){let lo=0,hi=200;for(let k=0;k<3;k++){const a=b[k]-b[k+3]/2,c=b[k]+b[k+3]/2;if(Math.abs(d[k])<1e-8){if(o[k]<a||o[k]>c)return Infinity;continue;}let t=(a-o[k])/d[k],u=(c-o[k])/d[k];if(t>u)[t,u]=[u,t];lo=Math.max(lo,t);hi=Math.min(hi,u);if(lo>hi)return Infinity;}return lo;}

// Radians, evaluated from the server clock; cosmetic kick is separate.
export const handling=[
 {kick:.018,cap:.12,recovery:5,visual:.045,fov:54},
 {kick:.012,cap:.09,recovery:6,visual:.032,fov:58},
 {kick:.052,cap:.13,recovery:3.8,visual:.085,fov:36}
];
export function recoilAt(p,now){return (p.kickPitch||0)*Math.exp(-handling[p.weapon].recovery*Math.max(0,now-(p.kickTime||0))/1000);}
export function nextRecoil(p,now,ads){const h=handling[p.weapon];return Math.min(h.cap,recoilAt(p,now)+h.kick*(ads?.65:1));}
export function reloadPose(progress){const t=Math.max(0,Math.min(1,progress));const dip=Math.sin(Math.PI*t);let magazine=0;if(t>.16&&t<.48)magazine=(t-.16)/.32;else if(t>=.48&&t<.82)magazine=1-(t-.48)/.34;return {dip,magazine};}
