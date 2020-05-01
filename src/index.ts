import VRDos from './VRDos';
import WebXRPolyfill from 'webxr-polyfill';


(async ()=> {
  const container = document.getElementById('main');
  (new WebXRPolyfill());
  await new VRDos().run(container);
  document.body.classList.remove('loading');
})();


/*
import Dos from './Dos';
const canvas = document.createElement('canvas');
document.getElementById('main')?.appendChild(canvas);
canvas.style.border = '1px solid red';
canvas.width = 800;
canvas.height = 640;
document.body.classList.remove('loading');

const dos = new Dos(canvas);
dos.run('./pop.zip', ['-c','prince.exe']);
*/
