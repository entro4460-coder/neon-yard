import * as T from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Reflector} from 'three/addons/objects/Reflector.js';

export function createEffects(renderer,scene,camera){
 const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
 const bloom=new UnrealBloomPass(new T.Vector2(innerWidth,innerHeight),.72,.6,1.05);composer.addPass(bloom);composer.addPass(new OutputPass());
 // One planar street reflection; the reflection camera excludes first-person layer 1.
 const shader={uniforms:T.UniformsUtils.clone(Reflector.ReflectorShader.uniforms),vertexShader:Reflector.ReflectorShader.vertexShader,fragmentShader:Reflector.ReflectorShader.fragmentShader.replace('vec4 base = texture2DProj( tDiffuse, vUv );',`vec4 projected=vUv;vec4 base=texture2DProj(tDiffuse,projected)*0.40;
 projected.x+=0.0025*projected.w;base+=texture2DProj(tDiffuse,projected)*0.15;
 projected.x-=0.005*projected.w;base+=texture2DProj(tDiffuse,projected)*0.15;
 projected.x+=0.0025*projected.w;projected.y+=0.003*projected.w;base+=texture2DProj(tDiffuse,projected)*0.15;
 projected.y-=0.006*projected.w;base+=texture2DProj(tDiffuse,projected)*0.15;`).replace('vec4( blendOverlay( base.rgb, color ), 1.0 )','vec4( blendOverlay( base.rgb, color ), 0.32 )')};
 const reflection=new Reflector(new T.PlaneGeometry(15.5,46),{color:0x5d6884,textureWidth:640,textureHeight:640,clipBias:.003,shader});reflection.rotation.x=-Math.PI/2;reflection.position.set(0,.024,0);reflection.material.transparent=true;reflection.material.depthWrite=false;scene.add(reflection);
 const originalBefore=reflection.onBeforeRender;reflection.onBeforeRender=function(...args){this.getReflectionCamera(args[2]).layers.set(0);originalBefore.apply(this,args);};
 // F2 provides a reversible cheaper rendering path for actual device testing.
 let enhanced=true;
 function toggle(){enhanced=!enhanced;reflection.visible=enhanced;return enhanced;}
 function render(){if(enhanced)composer.render();else renderer.render(scene,camera);}
 function resize(){composer.setSize(innerWidth,innerHeight);}
 return {render,resize,toggle,bloom,reflection};
}
