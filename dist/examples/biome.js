import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { scatter,createInstances,disposeInstances } from '@cranberry-forge/biome';

const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#162329');
const camera=new THREE.PerspectiveCamera(45,1,.1,200);camera.position.set(27,24,32);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
scene.add(new THREE.HemisphereLight('#e5f9e4','#384d44',2));const sun=new THREE.DirectionalLight('#ffe2b0',3);sun.position.set(-10,20,10);scene.add(sun);
const height=(x,z)=>Math.sin(x*.13)*Math.cos(z*.12)*2;
const terrainGeometry=new THREE.PlaneGeometry(40,40,80,80);terrainGeometry.rotateX(-Math.PI/2);
const positions=terrainGeometry.attributes.position;for(let i=0;i<positions.count;i++)positions.setY(i,height(positions.getX(i),positions.getZ(i)));terrainGeometry.computeVertexNormals();
scene.add(new THREE.Mesh(terrainGeometry,new THREE.MeshStandardMaterial({color:'#516d4c',roughness:1})));
const geometry=new THREE.ConeGeometry(.5,2.4,7);geometry.translate(0,1.2,0);const material=new THREE.MeshStandardMaterial({color:'#91ad70',roughness:1,flatShading:true});
let forest=null,seed=42;
function regenerate(){
  if(forest)disposeInstances(forest);
  const field=scatter({seed:seed++,count:600,radius:19,minDistance:1,exclusions:[{type:'path',points:[[-20,-4],[0,2],[20,-3]],width:3}]},height);
  forest=createInstances(field,[{geometry,material}]);scene.add(forest);
}
regenerate();document.querySelector('#regenerate').onclick=regenerate;
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}addEventListener('resize',resize);resize();
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
addEventListener('pagehide',()=>{renderer.setAnimationLoop(null);disposeInstances(forest);geometry.dispose();material.dispose();terrainGeometry.dispose();scene.traverse(o=>o.material?.dispose());controls.dispose();renderer.dispose();},{once:true});
