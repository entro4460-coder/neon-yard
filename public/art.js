import * as T from 'three';

export {createWeapon} from './weapons.js';

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
