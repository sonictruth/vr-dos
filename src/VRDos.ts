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
  ArrayCamera,
  Group,
} from 'three';

import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';

import Stats from 'stats.js';

import { Key } from 'ts-keycode-enum';

import DosWorkerWrapper from './DosWorkerWrapper';

enum GamePadAxis {
  x = 2,
  y = 3,
}




class VRDos {
  private scene: Scene | null = null;
  private camera: PerspectiveCamera | null = null;
  private renderer: WebGLRenderer | null = null;

  private initialized = false;
  private screenMeshName = 'SM_Monitor_Screen_0';
  private gamepads: Gamepad[] = [];
  private pressThreshold = .5;
  private stats = new Stats();
  private isDev = document.location.port === '1234';

  private dosCanvas = document.createElement('canvas');

  private dosTexture = new CanvasTexture(this.dosCanvas);

  private dos = new DosWorkerWrapper(this.dosCanvas, this.dosTexture);

  private animationMixer: AnimationMixer | null = null;
  private animationClips: AnimationClip[] = [];
  private clock = new Clock();
  private isLoading = true;

  private userHeight = 0;
  private keyStatus: { [code: number]: string; } = {};

  private gamePadButtonMap: { [vrButtonIndex: number]: number[]; } = {
    0: [Key.Enter], // Trigger
    1: [Key.Shift], // Sqeeze
    3: [Key.Ctrl], // Joy fire
    4: [Key.Space, Key.Shift, Key.Ctrl], // A
    5: [Key.Ctrl, Key.Q, Key.Escape]  // B
  }
  vrUser: Group = new Group();

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

  private setLoading(
    loading: boolean,
    text: string = 'Loading...'
  ) {
    const ctx = this.dosCanvas.getContext('2d');
    if (loading) {
      if (ctx && this.dosTexture) {
        this.dosCanvas.width = 512;
        this.dosCanvas.height = 512;
        ctx.font = 'bold 15px Verdana';
        ctx.fillStyle = 'green';
        ctx.fillText(text, 40, 40);
      }
      this.isLoading = loading;
    } else {
      this.isLoading = loading;
    };

  }

  private emulateKeyEvent(code: number, type: 'keydown' | 'keyup') {
    if (!this.keyStatus[code] && type === 'keydown') {
      this.dos.sendKey(code, type);
      this.keyStatus[code] = type;
    } else if (this.keyStatus[code] === 'keydown' && type === 'keyup') {
      this.dos.sendKey(code, type);
      delete this.keyStatus[code];
    }
  }


  private processGamepadsInputs() {
      if (this.gamepads.length === 0) {
        return;
      }
      const gamepad = this.gamepads[this.gamepads.length-1];
      
      // Joystick
      for (let ai = 0; ai < gamepad.axes.length; ai++) {
        const value = gamepad.axes[ai];
        if (ai === GamePadAxis.x) {
          if (value > this.pressThreshold) {
            this.emulateKeyEvent(Key.RightArrow, 'keydown');
          } else if (value < -this.pressThreshold) {
            this.emulateKeyEvent(Key.LeftArrow, 'keydown');
          } else {
            this.emulateKeyEvent(Key.RightArrow, 'keyup');
            this.emulateKeyEvent(Key.LeftArrow, 'keyup');
          }
        }
        if (ai === GamePadAxis.y) {
          if (value > this.pressThreshold) {
            this.emulateKeyEvent(Key.DownArrow, 'keydown');
          } else if (value < -this.pressThreshold) {
            this.emulateKeyEvent(Key.UpArrow, 'keydown');
          } else {
            this.emulateKeyEvent(Key.UpArrow, 'keyup');
            this.emulateKeyEvent(Key.DownArrow, 'keyup');
          }
        }
      }
      // Buttons
      for (let bi = 0; bi < gamepad.buttons.length; bi++) {
        const button = gamepad.buttons[bi];
        const map = this.gamePadButtonMap[bi];
        if(map){
          map.forEach(key => {
            const action = button.pressed ? 'keydown': 'keyup';
            this.emulateKeyEvent(key, action);
          });
        }
    };
  }

  render(time: number, xrFrame: XRFrame) {


    if (this.animationMixer) {
      const deltaTime = this.clock.getDelta();
      this.animationMixer.update(deltaTime);
    }

    if (this.userHeight === 0 && xrFrame) {
      const xrPose = xrFrame.getViewerPose(this.renderer?.xr.getReferenceSpace());
      if (xrPose) {
        this.userHeight = xrPose?.transform.position.y;
      }
    }

    if (!this.isLoading) {
      this.fixTextureSize(this.dosCanvas, this.dosTexture);
      this.processGamepadsInputs();
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
          // controller.add(<Object3D>buildController(event.data));
        });
        controller.addEventListener('disconnected', event => {
          const controller = <XRInputSource>event.data;
          this.gamepads = this.gamepads.filter(
            gamepad => controller.gamepad?.id !== gamepad.id
          );
        });
       
        // this.vrUser.add(controller);

      });
  

      const controllerModelFactory = new XRControllerModelFactory();
      const controllerGrips = [
        xrManager.getControllerGrip(0),
        xrManager.getControllerGrip(1)
      ]
      controllerGrips.forEach(grip => {
        grip.add(controllerModelFactory.createControllerModel(grip));
        this.vrUser.add(grip);
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

    const computerMonitorHeight = .7;

    this.scene = this.createScene();

    const cameraPosition = new Vector3(0, computerMonitorHeight, 0);
    const fov = 65;
    this.camera = this.createCamera(fov, this.aspectRatio, cameraPosition);


    this.vrUser.position.set(0, 0, 0);
    this.vrUser.add(this.camera);
    this.scene.add(this.vrUser);

    const orbitalTarget = new Vector3(0, computerMonitorHeight, 0);
    this.createOrbitControls(this.camera, this.renderer.domElement, orbitalTarget);

    // Adjust VR view height
    // @ts-ignore
    this.renderer.xr.addEventListener(
      'sessionstart',
      () => {
        setTimeout(() => {
          const diff = computerMonitorHeight - this.userHeight;
          this.vrUser.position.set(0, diff, 0);
        }, 100); // FIXME
      }
    );

    // @ts-ignore
    this.renderer.xr.addEventListener(
      'sessionend',
      () => {
        this.userHeight = 0;
        this.vrUser.position.set(0, 0, 0);
      }
    );

    this.createLights().forEach(light => this.scene?.add(light));

    this.setupVRControllers();

    if (domElement) {
      domElement.appendChild(this.renderer.domElement);
      domElement.appendChild(
        VRButton.createButton(
          this.renderer,
          { referenceSpaceType: 'local-floor' }
        )
      );
    } else {
      throw Error('Missing container dom element');
    }
    window.addEventListener('resize', this.handleResize.bind(this));

    const roomGLTF = await this.loadGLTF('room.glb');
    const roomMesh = <Mesh>roomGLTF.scene.children[0];
    this.scene.add(roomMesh);

    this.animationClips = roomGLTF.animations;

    const roomScreenMesh = <Mesh>this.scene.getObjectByName(this.screenMeshName);

    if (roomScreenMesh) {
      await this.attachDosScreen(roomScreenMesh);
    } else {
      throw new Error('Screen mesh not found' + this.screenMeshName);
    }

    this.renderer.setAnimationLoop(this.render.bind(this));
    this.initialized = true;
    (async () => {
      this.setLoading(true, `Please wait...`);
      await this.playIntro();
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

  private async bootDosGame(archiveUrl = 'dos-hdd.zip') {
    this.setLoading(true, `Booting ${archiveUrl}`);
    await this.dos.run(archiveUrl, ['-c', 'c:\\doszip\\dz.exe']);  //
    this.setLoading(false);
  }

  private fixTextureSize(
    canvas: HTMLCanvasElement,
    texture: CanvasTexture
  ) {
    // Other possible fixes for 'not power of 2' textures:
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
