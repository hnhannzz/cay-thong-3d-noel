import { ThreeElements } from '@react-three/fiber';

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

declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}