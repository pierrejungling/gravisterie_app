declare module 'three/examples/jsm/controls/OrbitControls.js' {
  import type { Camera, EventDispatcher } from 'three';
  export class OrbitControls extends EventDispatcher {
    constructor(object: Camera, domElement?: HTMLElement);
    enabled: boolean;
    target: any;
    enableDamping: boolean;
    dampingFactor: number;
    update(): void;
    dispose(): void;
  }
}

declare module 'three/examples/jsm/loaders/STLLoader.js' {
  import type { BufferGeometry, Loader } from 'three';
  export class STLLoader extends Loader {
    parse(data: ArrayBuffer | string): BufferGeometry;
  }
}

declare module 'three/examples/jsm/loaders/3MFLoader.js' {
  import type { Group, Loader } from 'three';
  export class ThreeMFLoader extends Loader {
    parse(data: ArrayBuffer): Group;
  }
}

