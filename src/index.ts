import VRDos from './VRDos';
import WebXRPolyfill from 'webxr-polyfill';


(async ()=> {
  const container = document.getElementById('main');
  (new WebXRPolyfill());
  await new VRDos().run(container);
  document.body.classList.remove('loading');
})();



