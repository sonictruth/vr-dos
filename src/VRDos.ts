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
  LinearFilter,
  PlaneBufferGeometry,
  MeshPhongMaterial,
  DirectionalLight,
  AmbientLight,
  Light,
} from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';

import { DosFactory } from 'js-dos';
import 'js-dos';

const Dos = (window as any).Dos as DosFactory;



class VRDos {
  private scene: Scene | null = null;
  private camera: PerspectiveCamera | null = null;
  private renderer: WebGLRenderer | null = null;
  private dosTexture: CanvasTexture | null = null;
  private initialized = false;

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

  render() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
      if (this.dosTexture) {
        this.dosTexture.needsUpdate = true;
      }
    } else {
      throw Error('Not initialized properly');
    }
  }

  private createScene(
    color: Color = new Color('black')
  )
    : Scene {
    const scene = new Scene();
    scene.background = color;
    return scene;
  }

  private createCamera(
    fov: number,
    ratio: number,
    initialPosition: Vector3,
    near = 0.1,
    far = 30
  )
    : PerspectiveCamera {
    const camera = new PerspectiveCamera(fov, ratio, near, far);
    camera.position.copy(initialPosition);
    return camera;
  }

  private createRenderer(): WebGLRenderer {
    const renderer = new WebGLRenderer({ antialias: true });
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
  )
    : OrbitControls {
    const controls = new OrbitControls(camera, container);
    controls.target.copy(target);
    controls.update();
    return controls;
  }

  private createLights(): Light[] {
    var light = new DirectionalLight(0xFFFFFF);
    light.position.set(3, 3, 3)
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

  async run(domElement: HTMLElement | null) {
    if (this.initialized) {
      return;
    }

    const cameraPosition = new Vector3(0, 1.6, 0);
    const orbitalTarget = new Vector3(0, 1.6, 0);
    const fov = 70;
    this.scene = this.createScene();
    this.camera = this.createCamera(fov, this.aspectRatio, cameraPosition);
    this.renderer = this.createRenderer();
    this.createLights().forEach(light => this.scene?.add(light));

    if (domElement) {
      this.createOrbitControls(this.camera, domElement, orbitalTarget);
      domElement.appendChild(this.renderer.domElement);
      domElement.appendChild(VRButton.createButton(this.renderer));
    } else {
      throw Error('Missing container dom element');
    }
    window.addEventListener('resize', this.handleResize.bind(this));

    const dosCanvas = document.createElement('canvas');
    this.dosTexture = new CanvasTexture(dosCanvas);
    this.dosTexture.minFilter = LinearFilter;


    const cycles = 500;
    const wdosboxUrl = './dos/wdosbox.js';
    
    const dosRuntime = await Dos(dosCanvas, { cycles, wdosboxUrl });
    await dosRuntime.fs.extract('https://js-dos.com/6.22/current/test/digger.zip');

    const dosInterface = await dosRuntime.main(['-c', 'DIGGER.COM']);
    
    this.dosReady();

    this.renderer.setAnimationLoop(this.render.bind(this));
    this.initialized = true;

  }

  dosReady() {
    document.title = 'VR-DOS powered by JS-DOS';
    const geometry = new PlaneBufferGeometry(1, 1);

    const material = new MeshPhongMaterial({ 
      shininess: 40,
      specular: new Color(0xffffff),
      map: this.dosTexture,
     }); 
  
    const cube = new Mesh(geometry, material);
    cube.position.set(0, 1.6, -2);

    this.scene?.add(cube);
  }

}

export default VRDos;
