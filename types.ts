
// Fix: Extend the global JSX namespace to include Three.js elements for React Three Fiber compatibility.
// This resolves "Property '...' does not exist on type 'JSX.IntrinsicElements'" errors across the project.
import { ThreeElements } from '@react-three/fiber'

declare global {
  /**
   * For React 18+ where JSX types are often under the React namespace
   */
  namespace React {
    namespace JSX {
      interface IntrinsicElements extends ThreeElements {}
    }
  }
  /**
   * For other environments that look into the global JSX namespace
   */
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

export enum TreeMode {
  CHAOS = 'CHAOS',
  FORMED = 'FORMED'
}

export interface Coordinates {
  x: number;
  y: number;
  z: number;
}

export interface ParticleData {
  chaosPos: [number, number, number];
  formedPos: [number, number, number];
  speed: number;
  color: string;
}
