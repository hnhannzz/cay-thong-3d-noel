
// Fix: Extend the global JSX namespace to include Three.js elements for React Three Fiber compatibility.
// We use React.JSX to merge with existing React definitions and avoid shadowing standard HTML elements.
import { ThreeElements } from '@react-three/fiber'

declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements extends ThreeElements {}
    }
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
