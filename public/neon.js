import * as T from 'three';

export function createNeonStreet(scene){
 const root=new T.Group();root.name='AFTERHOURS / NEON FOCUS STREET';scene.add(root);
 const cyan=new T.MeshStandardMaterial({color:0x79f0e5,emissive:0x10e5d4,emissiveIntensity:4.2,roughness:.28});
 const pink=new T.MeshStandardMaterial({color:0xf184e1,emissive:0xe530be,emissiveIntensity:3.8,roughness:.3});
 const violet=new T.MeshStandardMaterial({color:0x9581d4,emissive:0x6c43d4,emissiveIntensity:2.4});
 const black=new T.MeshStandardMaterial({color:0x111420,metalness:.5,roughness:.4});
 const geo=new T.BoxGeometry(1,1,1),batches=new Map(),pose=new T.Object3D();
 function box(x,y,z,w,h,d,mat){let items=batches.get(mat);if(!items)batches.set(mat,items=[]);items.push([x,y,z,w,h,d]);}
 // Tall facade light ribbons create height and strong city silhouettes.
 for(const [x,z,top,w] of [[-10.85,-10,22,1.2],[-10.85,1,19,.55],[10.85,11,27,1],[10.85,-1,23,.55]]){
  box(x,top/2+2,z,.14,top,w,black);box(x+(x<0?.09:-.09),top/2+2,z,.03,top-.3,w*.65,x<0?pink:cyan);
  for(let y=5;y<top;y+=1.3)box(x+(x<0?.115:-.115),y,z,.02,.035,w*.8,black);
 }
 // Continuous canopy accents anchor the color down at street level.
 for(const side of [-1,1]){const x=side<0?-10.20:10.20,center=side<0?-5:5;
  box(x,3.14,center,.10,.07,14,side<0?pink:cyan);
  for(const z of [center-7,center+7])box(x,2.0,z,.07,2.2,.07,side<0?pink:cyan);
  for(let z=center-6;z<center+7;z+=3){box(x,4.8,z,.55,1.5,.2,black);box(x+(side<0?.30:-.30),4.8,z,.025,1.1,.12,side<0?cyan:pink);}
 }
 // Bright rim around the original storefront, without closing the doorway.
 for(const z of [-7.6,-2.4])box(-10.48,1.65,z,.06,3,.055,cyan);box(-10.48,3.15,-5,.06,.05,5.25,cyan);
 // A narrow overhead light spine follows the existing elevated utility gantry.
 for(const z of [-17,17]){box(0,8.82,z,21,.055,.10,cyan);box(0,9.18,z,21,.04,.07,pink);}
 // Local light sources actually color nearby architecture and pavement.
 for(const [x,y,z,color,power] of [[-9,3,-7,0xed3bc7,70],[-9,3,0,0xad45ed,55],[9,3,5,0x20d9df,75],[9,3,12,0x21b2e8,65],[-1,6,-17,0x8a4ad9,50],[0,4,16,0xd94daa,48]]){const light=new T.PointLight(color,power,16,2);light.position.set(x,y,z);root.add(light);}
 // Background towers carry sparse, oversized emission panels rather than neon grids.
 for(const [x,z,h,color] of [[-29,-8,38,cyan],[29,7,46,pink],[-10,-33,32,pink],[12,33,39,cyan],[-32,31,52,violet],[32,-32,60,cyan]]){
  box(x,h*.58,z+(z>0?-6:6),1.4,h*.48,.06,color);
  box(x+3,h*.40,z+(z>0?-6:6),.35,h*.32,.06,color);
 }
 for(const [material,items] of batches){const mesh=new T.InstancedMesh(geo,material,items.length);for(let i=0;i<items.length;i++){const [x,y,z,w,h,d]=items[i];pose.position.set(x,y,z);pose.scale.set(w,h,d);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);}mesh.computeBoundingSphere();root.add(mesh);}
 // Sky shader supplies the magenta horizon, not a flat black background.
 const sky=new T.Mesh(new T.SphereGeometry(220,32,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{},vertexShader:'varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 vDirection;void main(){float h=normalize(vDirection).y;vec3 low=vec3(.13,.035,.15);vec3 high=vec3(.008,.014,.045);vec3 color=mix(low,high,smoothstep(.0,.55,h));float band=exp(-pow((h-.025)*16.,2.));color+=band*vec3(.13,.025,.065);gl_FragColor=vec4(color,1.);}` }));sky.frustumCulled=false;scene.add(sky);
 return root;
}
