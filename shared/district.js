// An irregular playable perimeter: station spur, west lane and east food court.
export const districtOutline=[[-23,-25],[-2,-25],[-2,-36],[23,-36],[23,-21],[32,-21],[32,-10],[23,-10],[23,25],[-23,25],[-23,22],[-32,22],[-32,8],[-23,8]];
export const districtWalls=districtOutline.map((a,i)=>{const b=districtOutline[(i+1)%districtOutline.length];return[(a[0]+b[0])/2,3,(a[1]+b[1])/2,Math.abs(a[0]-b[0])+.4,6,Math.abs(a[1]-b[1])+.4];});
export const districtSolids=[
 // West noodle shop: entry at x=-24, z=13..17.
 [-31.3,2.5,15,.35,5,10],[-27.65,2.5,10,7.65,5,.35],[-27.65,2.5,20,7.65,5,.35],[-24,2.5,11.5,.35,5,3],[-24,2.5,18.5,.35,5,3],[-27.65,5,15,7.65,.2,10],
 [-29.8,.95,15,1.2,1.9,6],[-26.4,.65,18.3,1.8,1.3,1],
 // East restaurant: entry at x=24, z=-17.5..-13.5.
 [31.3,2.5,-15.5,.35,5,9],[27.65,2.5,-20,7.65,5,.35],[27.65,2.5,-11,7.65,5,.35],[24,2.5,-18.75,.35,5,2.5],[24,2.5,-12.25,.35,5,2.5],[27.65,5,-15.5,7.65,.2,9],
 [29.8,1,-15.5,1.2,2,5],[26.6,.7,-12.5,1.5,1.4,1],
 // Street furniture creates staggered cover without closing either side lane.
 [-21.2,1.05,9.2,1.1,2.1,1.5],[21.2,1.05,-8,1.1,2.1,1.5],
 // Elevated station roof, columns, ticket machines and stationary train body.
 [10.5,6.3,-29,24,.3,12],[-.5,3.1,-34,.3,6.2,.3],[21.5,3.1,-32,.3,6.2,.3],[-.5,3.1,-22,.3,6.2,.3],[21.5,3.1,-22,.3,6.2,.3],
 [2,1.15,-34.2,1,2.3,.6],[4,1.15,-34.2,1,2.3,.6],
 [5,2.2,-29,20,.4,4],[6,3.85,-29,18,2.5,2.7]
];
export const districtPlatforms=[{x:9,z:-23.5,w:24,d:5,y:2.4,entryX:18,entryWidth:3.4}];
export const districtRamps=[{x:18,z:-30,w:3.4,d:8,low:0,high:2.4}];
export function districtName(x,z,y=0){if(z<-25||z<-21&&x>-3&&x<22)return y>1.5?'YARD STATION / PLATFORM':'YARD STATION / CONCOURSE';if(x<-23&&z>8)return 'LANTERN ALLEY';if(x>23&&z<-10)return 'NIGHT FOOD COURT';return null;}
