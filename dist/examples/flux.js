import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Trail } from '@cranberry-forge/flux';

const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#071820');
const camera=new THREE.PerspectiveCamera(45,1,.1,100);camera.position.set(12,8,15);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
const trail=new Trail({capacity:300,lifetime:3,width:.65,color:'#b2ffcd',tailColor:'#326ea2',intensity:1.3});scene.add(trail);
const emitter=new THREE.Mesh(new THREE.SphereGeometry(.1,12,8),new THREE.MeshBasicMaterial({color:'#d5ffe8'}));scene.add(emitter);
let emitting=!matchMedia('(prefers-reduced-motion: reduce)').matches;
document.querySelector('#pause').textContent=emitting?'Pause emission':'Start emission';
document.querySelector('#pause').onclick=()=>{emitting=!emitting;trail.break();document.querySelector('#pause').textContent=emitting?'Pause emission':'Start emission';};
const position=new THREE.Vector3(),cameraPosition=new THREE.Vector3();const start=performance.now();
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}addEventListener('resize',resize);resize();
renderer.setAnimationLoop(()=>{
  const t=(performance.now()-start)/1000;
  position.set(Math.cos(t)*5,Math.sin(t*1.7)*2.5,Math.sin(t)*4);emitter.position.copy(position);
  if(emitting)trail.push(position,t);
  controls.update();camera.getWorldPosition(cameraPosition);trail.update(t,cameraPosition);renderer.render(scene,camera);
});
addEventListener('pagehide',()=>{renderer.setAnimationLoop(null);trail.dispose();emitter.geometry.dispose();emitter.material.dispose();controls.dispose();renderer.dispose();},{once:true});
