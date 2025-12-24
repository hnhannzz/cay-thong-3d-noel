
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TreeMode } from '../types';

interface SnowfallProps {
  mode: TreeMode;
}

const vertexShader = `
  uniform float uTime;
  uniform float uRadius;
  uniform float uHeight;
  
  attribute float aSpeed;
  attribute float aOffset;
  attribute float aSize;

  varying float vAlpha;

  void main() {
    vec3 pos = position;
    
    float verticalCycle = mod(uTime * aSpeed + aOffset, uHeight);
    pos.y = uHeight - verticalCycle;
    
    pos.x += sin(uTime * 0.4 + aOffset) * 1.5;
    pos.z += cos(uTime * 0.2 + aOffset) * 1.5;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    
    gl_PointSize = aSize * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
    
    float edgeFade = smoothstep(0.0, 3.0, pos.y) * smoothstep(uHeight, uHeight - 3.0, pos.y);
    vAlpha = edgeFade;
  }
`;

const fragmentShader = `
  uniform float uOpacity;
  varying float vAlpha;

  void main() {
    float r = distance(gl_PointCoord, vec2(0.5));
    if (r > 0.5) discard;
    
    float mask = 1.0 - smoothstep(0.0, 0.5, r);
    // Multiply by uOpacity to control visibility dynamically
    gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha * mask * 0.4 * uOpacity);
  }
`;

export const Snowfall: React.FC<SnowfallProps> = ({ mode }) => {
  const count = 1200;
  const meshRef = useRef<THREE.Points>(null);
  const opacityRef = useRef(1); // Track internal opacity for smooth lerping
  
  const height = 35;
  const radius = 25;

  const { positions, speeds, offsets, sizes } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    const off = new Float32Array(count);
    const sza = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius;
      pos[i * 3] = r * Math.cos(angle);
      pos[i * 3 + 1] = Math.random() * height;
      pos[i * 3 + 2] = r * Math.sin(angle);

      spd[i] = 0.8 + Math.random() * 1.5;
      off[i] = Math.random() * 100.0;
      sza[i] = 0.8 + Math.random() * 2.2;
    }

    return { positions: pos, speeds: spd, offsets: off, sizes: sza };
  }, []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uHeight: { value: height },
    uRadius: { value: radius },
    uOpacity: { value: 1.0 }, // New uniform to control overall snow visibility
  }), []);

  useFrame((state, delta) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = state.clock.elapsedTime;
      
      // Target opacity is 1 when formed, 0 when chaos
      const targetOpacity = mode === TreeMode.FORMED ? 1.0 : 0.0;
      
      // Smoothly interpolate opacity
      opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, targetOpacity, delta * 2.0);
      material.uniforms.uOpacity.value = opacityRef.current;
      
      // Toggle visibility property for optimization when completely hidden
      meshRef.current.visible = opacityRef.current > 0.001;
    }
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aSpeed"
          count={count}
          array={speeds}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aOffset"
          count={count}
          array={offsets}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aSize"
          count={count}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};
