import {
  cloneObject,
  shouldPreventDefault,
  dosboxConf,
} from './utils';

import { Xhr } from 'js-dos/js-dos-ts/js-dos-xhr'
import CacheNoop from 'js-dos/js-dos-ts/js-dos-cache-noop';
import { CanvasTexture } from 'three';

class DosWorkerWrapper {
  private zipUrl: string = '';
  private workerUrl = 'wdosbox-emterp.worker.js';
  private home = '/home/web_user/';
  private canvas: HTMLCanvasElement;
  private renderFrameData: ArrayLike<number> | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private imageData: ImageData | null = null;
  private frameId = 0;
  private worker: Worker | null = null;
  private rpcPromises = <any>{};
  private commands: string[] = [];
  private startedPromise = () => {};
  private texture: CanvasTexture;


  constructor(canvas: HTMLCanvasElement, texture: CanvasTexture) {
    this.canvas = canvas;
    this.texture = texture;
    this.handleWorkerMessage = this.handleWorkerMessage.bind(this);
    this.attachEvents();
  }

  async run(
    zipUrl: string = '',
    commands: string[] = [],
  ) {
    return new Promise((resolve) => {
      this.terminate();
      this.renderFrameData = null;
      this.imageData = null;
      this.zipUrl = zipUrl;
      this.commands = commands;
      this.frameId = 0;
      this.worker = new Worker(this.workerUrl);
      this.worker.addEventListener('message', this.handleWorkerMessage);
      this.startedPromise = resolve;
    });
  }

  terminate() {
    this.worker?.removeEventListener('message', this.handleWorkerMessage);
    this.worker?.terminate();
  }

  private handleWorkerMessage(event: MessageEvent) {

    const data = event.data;
    switch (data.target) {
      case 'loaded': {
        this.initWorker();
        break;
      }
      case 'ready': {
        this.start();
        break;
      }
      case 'custom': {
        if (this.rpcPromises[data.id]) {
          if (data.error) {
            this.rpcPromises[data.id][1](data.result);
          } else {
            this.rpcPromises[data.id][0](data.result);
          }
          delete this.rpcPromises[data.id];
        }
        break;
      }
      case 'stdout': {
        this.print('DOSWorker: ' + data.content);
        break;
      }
      case 'stderr': {
        this.printErr('DOSWorker: ' + data.content);
        break;
      }
      case 'window': {
        (<any>window)[data.method]();
        break;
      }
      case 'canvas': {
        switch (data.op) {
          case 'getContext': {
            this.ctx = this.canvas.getContext(data.type, data.attributes);
            break;
          }
          case 'resize': {
            this.canvas.width = data.width;
            this.canvas.height = data.height;
            if (this.ctx && this.ctx.getImageData) {
              this.imageData = this.ctx.getImageData(0, 0, data.width, data.height);
            }

            this.worker?.postMessage(
              {
                target: 'canvas',
                boundingClientRect: cloneObject(this.canvas.getBoundingClientRect())
              }
            );
            break;
          }
          case 'render': {
            if (this.renderFrameData) {
              // previous image was not rendered yet, just update image
              this.renderFrameData = data.image.data;
            } else {
              // previous image was rendered so update image and request another frame
              this.renderFrameData = data.image.data;

              setTimeout(this.renderFrame.bind(this));
              // this.renderFrame();
            }
            break;
          }
          case 'setObjectProperty': {
            (<any>this.canvas)[data.object][data.property] = data.value;
            break;
          }
          default: 'eh?';
        }
        break;
      }
      case 'tick': {
        this.frameId = data.id;
        this.worker?.postMessage({ target: 'tock', id: this.frameId });
        break;
      }
      case 'setimmediate': {
        this.worker?.postMessage({ target: 'setimmediate' });
        break;
      }

    }

  }

  private async initWorker() {
    this.worker?.postMessage(
      { target: 'gl', op: 'setPrefetched', preMain: true }
    );
    this.worker?.postMessage({
      target: 'worker-init',
      width: this.canvas.width,
      height: this.canvas.height,
      boundingClientRect: cloneObject(this.canvas.getBoundingClientRect()),
      URL: document.URL,
      currentScriptUrl: this.workerUrl,
      preMain: true,
    });
  }

  private async start() {

    await this.callWorker(
      'Module.FS.chdir',
      this.home
    );

    await this.callWorker(
      'Module.FS.createDataFile',
      this.home,
      'dosbox.conf', dosboxConf,
      true,
      true,
      true
    );

    if (this.zipUrl !== '') {
      const bytes = await this.getArchive(this.zipUrl);
      await this.callWorker(
        'unzip',
        bytes
      );
    }
 
    const args = ['run', '-c', 'mount c .', '-c', 'c:', ...this.commands];
    await this.callWorker.apply(this, args);
    this.startedPromise();
  }

  private async getArchive(url: string): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      new Xhr(
        url,
        {
          cache: new CacheNoop(),
          responseType: "arraybuffer",
          fail: (msg) => reject(msg),
          success: (data: ArrayBuffer) => {
            const bytes = new Uint8Array(data);
            resolve(bytes);
          }
        })
    });
  }

  private async callWorker(...args: any[]) {

    const cmd = args.shift();

    const id = Math.random().toString(36).substr(2, 9);
    return new Promise((resolve, reject) => {
      this.worker?.postMessage({
        id,
        target: 'custom',
        cmd: cmd,
        args,
      });
      this.rpcPromises[id] = [resolve, reject];
      setTimeout(() => {
        delete this.rpcPromises[id];
        reject(cmd + ' timeout');
      }, 1500)
    });
  };

  private print(message: string) {
    console.log(message);
  }
  private printErr(message: string) {
    console.error(message);
  }
  private renderFrame() {

    const dst = this.imageData?.data;

    if (this.renderFrameData) {
      if (dst?.set) {
        this.texture.needsUpdate = true;
        dst.set(this.renderFrameData);
      } else {   
        for (var i = 0; i < this.renderFrameData.length; i++) { 
          // @ts-ignore
          dst[i] = this.renderFrameData[i];
        }
      }
    }

    if (this.imageData) {
      this.ctx?.putImageData(this.imageData, 0, 0);
    }

    this.renderFrameData = null;
  }

  private attachEvents() {
    // TODO: Move listeners to canvas
    ['keydown', 'keyup', 'keypress', 'blur', 'visibilitychange']
      .forEach((eventName) => {
        document.addEventListener(eventName, (event: Event) => {

          this.worker?.postMessage({ target: 'document', event: cloneObject(event) });

          if (shouldPreventDefault(<KeyboardEvent>event)) {
            event.preventDefault();
          }
        });
      });

    ['unload']
      .forEach((eventName) => {
        window.addEventListener(eventName, (event) => {
          this.worker?.postMessage({ target: 'window', event: cloneObject(event) });
        });
      });
    /*
    ['mousedown', 'mouseup', 'mousemove', 'DOMMouseScroll', 'mousewheel', 'mouseout']
      .forEach((eventName) => {
        this.canvas.addEventListener(eventName, (event: Event) => {
          this.worker?.postMessage({ target: 'canvas', event: cloneObject(event) });
          event.preventDefault();
        }, true);
      });
    */
  }


}


export default DosWorkerWrapper;
