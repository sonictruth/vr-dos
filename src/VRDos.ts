import {
  Scene,
  Color,
  PerspectiveCamera,
  WebGLRenderer,
  sRGBEncoding,
  Camera,
  Vector3,
  Mesh,
  CanvasTexture,
  PlaneBufferGeometry,
  MeshPhongMaterial,
  DirectionalLight,
  AmbientLight,
  Light,
  FrontSide,
  MathUtils,
  Vector2,
  AnimationMixer,
  Clock,
  LoopOnce,
  AnimationClip,
  Raycaster,
} from 'three';

import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';

import { DosFactory } from 'js-dos';
import 'js-dos';
import { DosCommandInterface } from 'js-dos/dist/typescript/js-dos-ci';
const Dos = (window as any).Dos as DosFactory;

import Stats from 'stats.js';

import keycode from 'keycode';

enum GamePadAxis {
  x = 2,
  y = 3,
}



class VRDos {
  private scene: Scene | null = null;
  private camera: PerspectiveCamera | null = null;
  private renderer: WebGLRenderer | null = null;
  private dosTexture: CanvasTexture | null = null;
  private initialized = false;
  private dosCommandInterface: DosCommandInterface | null = null;
  private screenMeshName = 'SM_Monitor_Screen_0';
  private gamepads: Gamepad[] = [];
  private pressThreshold = .5;
  private stats = new Stats();
  private isDev = document.location.port === '1234';
  private oddFrame = false;
  private wdosBoxUrl = './dos/wdosbox.js';
  private gameArchiveUrl = './pop.zip';
  private dosCanvas: HTMLCanvasElement = document.createElement('canvas');
  private dosCycles: string | number = 'auto';
  private animationMixer: AnimationMixer | null = null;
  private animationClips: AnimationClip[] = [];
  private clock = new Clock();
  private loading = true;

  get devicePixelRatio(): number {
    return window.devicePixelRatio;
  }

  get width(): number {
    return window.innerWidth;
  }

  get height(): number {
    return window.innerHeight;
  }

  get aspectRatio(): number {
    return (this.width / this.height)
  }

  private processGamepadsInputs() {
    for (let i = 0; i < this.gamepads.length; i++) {
      const gamepad = this.gamepads[i];
      for (let ai = 0; ai < gamepad.axes.length; ai++) {
        const value = gamepad.axes[ai];
        if (ai === GamePadAxis.x) {
          if (value > this.pressThreshold) {
            this.sendCode('right');
          } else if (value < -this.pressThreshold) {
            this.sendCode('left');
          }
        }
        if (ai === GamePadAxis.y) {
          if (value > this.pressThreshold) {
            this.sendCode('down');
          } else if (value < -this.pressThreshold) {
            this.sendCode('up');
          }
        }
      }
      for (let bi = 0; bi < gamepad.buttons.length; bi++) {
        const button = gamepad.buttons[bi];
        if (button.pressed) {
          // https://www.w3.org/TR/webxr-gamepads-module-1/#xr-standard-gamepad-mapping
          // https://w3c.github.io/gamepad/#dfn-standard-gamepad-layout
          // 0 1,  4 5 
          if (bi === 3) {
            this.sendText('prince.exe\r\n');
          }
          if (bi === 0) {

            this.sendCode('enter');
          }
        }
      }
    };
  }

  render() {

    const dosTexture = <CanvasTexture>this.dosTexture;
    this.fixTextureSize(this.dosCanvas, dosTexture);

    if (this.animationMixer) {
      const deltaTime = this.clock.getDelta();
      this.animationMixer.update(deltaTime);
    }

    if (this.loading) {
      const ctx = <CanvasRenderingContext2D>this.dosCanvas.getContext('2d');
      ctx.font = `20px 'VT323', monospace`;
      ctx.fillStyle = 'green';
      ctx.textAlign = 'left';
      ctx.fillText(
        'Booting...',
        10, 40
      );
      dosTexture.needsUpdate = false;
    } else {
      this.processGamepadsInputs();
      if (this.oddFrame) {
        dosTexture.needsUpdate = true;
        this.oddFrame = false;
      } else {
        this.oddFrame = true;
      }
    }

    this.renderer?.render(<Scene>this.scene, <Camera>this.camera);

    if (this.isDev) {
      this.stats.update();
    }
  }

  private createScene(
    color: Color = new Color('white')
  ): Scene {
    const scene = new Scene();
    scene.castShadow = true;
    scene.background = color;
    return scene;
  }

  private createCamera(
    fov: number,
    ratio: number,
    initialPosition: Vector3,
    near = 0.1,
    far = 30
  ): PerspectiveCamera {
    const camera = new PerspectiveCamera(fov, ratio, near, far);
    camera.position.copy(initialPosition);
    return camera;
  }

  private createRenderer(): WebGLRenderer {
    // To enable WebGL2:
    // const canvas = document.createElement('canvas');
    // const context = <WebGL2RenderingContext>canvas.getContext('webgl2', { alpha: false });
    const renderer = new WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    renderer.xr.enabled = true;
    renderer.setPixelRatio(devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = sRGBEncoding;
    return renderer;
  }

  private createOrbitControls(
    camera: Camera,
    container: HTMLElement,
    target: Vector3,
  ): OrbitControls {
    const controls = new OrbitControls(camera, container);
    controls.target.copy(target);
    controls.update();
    return controls;
  }

  private createLights(): Light[] {
    var light = new DirectionalLight(0xFFFFFF);
    light.position.set(3, 5, 3)
    const alight = new AmbientLight(0xFFFFFF, 0.2)
    return [light, alight];
  }

  private handleResize() {
    if (this.camera && this.renderer) {
      this.camera.aspect = this.aspectRatio;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width, this.height);
    }
  }

  private sendText(text: string) {
    text.split('').forEach(chr =>
      this.dosCommandInterface?.sendKeyPress(chr.charCodeAt(0))
    )
  }

  private sendCode(name: string) {
    this.dosCommandInterface?.sendKeyPress(keycode(name));
  }

  private setupVRControllers() {

    /*
    const buildController = (xrInputSource: XRInputSource): Object3D | undefined => {
      let geometry, material;
      switch (xrInputSource.targetRayMode) {
        case 'tracked-pointer':
          geometry = new BufferGeometry();
          geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, - 1], 3));
          geometry.setAttribute('color', new Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3));
          material = new LineBasicMaterial({ vertexColors: true, blending: AdditiveBlending });
          return new Line(geometry, material);

        case 'gaze':
          geometry = new RingBufferGeometry(0.02, 0.04, 32).translate(0, 0, - 1);
          material = new MeshBasicMaterial({ opacity: 0.5, transparent: true });
          return new Mesh(geometry, material);
      }
    }
    */

    const xrManager = this.renderer?.xr;
    const scene = this.scene;

    if (xrManager && scene) {

      const controllers = [
        xrManager.getController(0),
        xrManager.getController(1)
      ];

      controllers.forEach(controller => {
        controller.addEventListener('connected', event => {

          const controller = <XRInputSource>event.data;
          if (controller.gamepad) {
            this.gamepads.push(controller.gamepad);
          }
          // controller0.add(<Object3D>buildController(event.data));
        });
        controller.addEventListener('disconnected', event => {
          const controller = <XRInputSource>event.data;
          this.gamepads = this.gamepads.filter(
            gamepad => controller.gamepad?.id !== gamepad.id
          );
        });

        scene.add(controller);

      });

      const controllerModelFactory = new XRControllerModelFactory();
      const controllerGrips = [
        xrManager.getControllerGrip(0),
        xrManager.getControllerGrip(1)
      ]
      controllerGrips.forEach(grip => {
        grip.add(controllerModelFactory.createControllerModel(grip));
        scene.add(grip);
      });

    }

  }

  async run(domElement: HTMLElement | null) {
    if (this.initialized) {
      return;
    }
    if (this.isDev) {
      this.stats.showPanel(0);
      document.body.appendChild(this.stats.dom);
    }
    this.renderer = this.createRenderer();

    //FIXME: When entering VR set the screen at the right height
    //       For now move the whole scene

    this.renderer.xr.addEventListener(
      'sessionstart',
      () => this.scene.position.set(0, -0.7, 0)
    );

    this.renderer.xr.addEventListener(
      'sessionend',
      () => this.scene.position.set(0, 0, 0)
    );

    this.renderer.domElement.addEventListener('click', (event) => {
      this.sendText('prince.exe\r\n');
    }, true);


    const cameraPosition = new Vector3(0, .7, 0);
    const orbitalTarget = new Vector3(0, .7, 0);
    const fov = 65;
    this.scene = this.createScene();
    this.camera = this.createCamera(fov, this.aspectRatio, cameraPosition);
    this.createOrbitControls(this.camera, this.renderer.domElement, orbitalTarget);

    this.createLights().forEach(light => this.scene?.add(light));

    this.setupVRControllers();

    if (domElement) {

      domElement.appendChild(this.renderer.domElement);

      domElement.appendChild(
        VRButton.createButton(
          this.renderer,
          { referenceSpaceType: 'local' } // or local-floor
        )
      );


    } else {
      throw Error('Missing container dom element');
    }
    window.addEventListener('resize', this.handleResize.bind(this));

    const roomGLTF = await this.loadGLTF('./room.glb');
    const roomMesh = <Mesh>roomGLTF.scene.children[0];
    this.scene.add(roomMesh);

    this.animationClips = roomGLTF.animations;

    const roomScreenMesh = <Mesh>this.scene.getObjectByName(this.screenMeshName);

    if (roomScreenMesh) {
      this.dosTexture = new CanvasTexture(this.dosCanvas);
      await this.attachDosScreen(roomScreenMesh);
    } else {
      throw new Error('Screen mesh not found' + this.screenMeshName);
    }

    this.renderer.setAnimationLoop(this.render.bind(this));
    this.initialized = true;
    (async () => {
      await this.playIntro();
      console.log('Booting...');
      this.bootDosGame();
    })();

  }

  private async playIntro() {
    return new Promise((resolve) => {
      if (this.scene && this.dosCanvas) {

        const mixer = this.animationMixer = new AnimationMixer(this.scene);
        const introClip = this.animationClips[0];
        const action = mixer.clipAction(introClip);
        action.clampWhenFinished = true;
        action.loop = LoopOnce;
        mixer.addEventListener('finished', () => {
          this.animationMixer = null;
          resolve();
        })
        action.play();
      } else {
        resolve();
      }
    })
  }

  private loadGLTF(path: string): Promise<GLTF> {
    const promise = new Promise((resolve, reject) => {
      const gltfLoader = new GLTFLoader();
      gltfLoader.load(
        path,
        (gltf) => resolve(gltf),
        () => { },
        (msg) => reject(msg)
      );
    });
    return <Promise<GLTF>>promise;
  }

  private async bootDosGame(url = this.gameArchiveUrl) {
    this.loading = true;
    if (this.dosCommandInterface) {
      this.dosCommandInterface.exit();
      this.dosCommandInterface.dos.terminate();
    }
    const dosRuntime = await Dos(this.dosCanvas,
      {
        cycles: this.dosCycles,
        wdosboxUrl: this.wdosBoxUrl
      });
    await dosRuntime.fs.createFile(
      'dosbox.conf',
      `
    [joystick]
    joysticktype=none
    [autoexec]
    @ECHO OFF
    echo -------------------------------
    echo Hello, type prince.exe to start
    echo -------------------------------


    `);

    await dosRuntime.fs.extract(url);

    this.dosCommandInterface = await dosRuntime.main(['-conf', 'dosbox.conf']);
    document.title = 'VR-DOS powered by JS-DOS';
    this.loading = false;
  }

  private fixTextureSize(
    canvas: HTMLCanvasElement,
    texture: CanvasTexture
  ) {
    // Other possible fixes for not power of 2 textures:
    // this.dosTexture.minFilter = LinearFilter; // looks ugly
    // or use WebGL 2 // Not supported by Safari
    if (!MathUtils.isPowerOfTwo(canvas.width)) {
      canvas.width = MathUtils.ceilPowerOfTwo(canvas.width);
      canvas.height = MathUtils.ceilPowerOfTwo(canvas.height);
      texture.offset = new Vector2(0, 0.2);
      texture.repeat.set(0.63, 0.8);
    }
  }

  private attachDosScreen(dosScreen: Mesh) {
    const material = new MeshPhongMaterial({
      side: FrontSide,
      shininess: 40,
      specular: new Color(0xffffff),
      map: this.dosTexture,
    });

    // TODO: Resize and position realScreen
    //        automatically relative to dosScreen 
    const geo = new PlaneBufferGeometry(.245, .23);
    const realScreen = new Mesh(geo, material);
    realScreen.position.set(-.25, .2, .1223);
    realScreen.rotateY(-Math.PI / 2);
    dosScreen.add(realScreen);

  }

}

export default VRDos;
