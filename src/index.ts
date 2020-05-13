import VRDos from './VRDos';
import WebXRPolyfill from 'webxr-polyfill';
import { Key } from 'ts-keycode-enum';

(async () => {
  const container = document.getElementById('main');
  (new WebXRPolyfill());
  const vrDos = await new VRDos();
  await vrDos.init(container);
  document.body.classList.remove('loading');
  await vrDos.run('dos-hdd.zip', ['-c', 'c:\\doszip\\dz.exe']);
  document.body.classList.add('ready');
  const controls = document.getElementById('controls');
  const virtualButtons: { [buttonName: string]: number[]; } = {
    
    '←': [Key.LeftArrow],
    '↑': [Key.UpArrow],
    '↓': [Key.DownArrow],
    '→': [Key.RightArrow],
    'Ent': [Key.Enter],
    'Spc': [Key.Space],
    'Ctr': [Key.Ctrl],
    'Sft': [Key.Shift],
    'Esc': [Key.Ctrl, Key.Q, Key.X, Key.Escape],
  }
  Object.keys(virtualButtons).forEach(keyName => {
    const button = document.createElement('button');
    const keys = virtualButtons[keyName];
    button.innerHTML = keyName;
    button.addEventListener('mousedown',
      () =>
        keys.forEach(key => vrDos.emulateKeyEvent(key, 'keydown')
        )
    );
    button.addEventListener('mouseup',
      () =>
        keys.forEach(key => vrDos.emulateKeyEvent(key, 'keyup')
        )
    );
    controls?.appendChild(button);
  })

})();



