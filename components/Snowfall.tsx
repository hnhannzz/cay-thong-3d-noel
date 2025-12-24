
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
  uniform float uTime;
  uniform float uRadius;
  uniform float uHeight;
  
  attribute float aSpeed;
  attribute float aOffset;
  attribute float aSize;

  varying float vAlpha;

  void main() {
    // Current position calculation
    vec3 pos = position;
    
    // Vertical movement: reset to top when reaching bottom
    float verticalCycle = mod(uTime * aSpeed + aOffset, uHeight);
    pos.y = uHeight - verticalCycle;
    
    // Horizontal sway (wind simulation)
    pos.x += sin(uTime * 0.4 + aOffset) * 1.5;
    pos.z += cos(uTime * 0.2 + aOffset) * 1.5;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    
    // Size attenuation (smaller when further)
    gl_PointSize = aSize * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
    
    // Fade out near the top and bottom edges for smooth appearance
    float edgeFade = smoothstep(0.0, 3.0, pos.y) * smoothstep(uHeight, uHeight - 3.0, pos.y);
    vAlpha = edgeFade;
  }
`;

const fragmentShader = `
  varying float vAlpha;

  void main() {
    // Round snowflake with soft, blurred edges
    float r = distance(gl_PointCoord, vec2(0.5));
    if (r > 0.5) discard;
    
    // Soft radial gradient for a bokeh/soft snow look
    float mask = 1.0 - smoothstep(0.0, 0.5, r);
    // Reduced global opacity (0.4 instead of 0.8) to prevent "burning" or glare
    gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha * mask * 0.4);
  }
`;

export const Snowfall: React.FC = () => {
  // Reduced count for a cleaner look (1200 instead of 2500)
  const count = 1200;
  const meshRef = useRef<THREE.Points>(null);
  
  const height = 35;
  const radius = 25;

  const { positions, speeds, offsets, sizes } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    const off = new Float32Array(count);
    const sza = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Random position in a cylinder
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius;
      pos[i * 3] = r * Math.cos(angle);
      pos[i * 3 + 1] = Math.random() * height;
      pos[i * 3 + 2] = r * Math.sin(angle);

      spd[i] = 0.8 + Math.random() * 1.5; // Slightly slower falling speed
      off[i] = Math.random() * 100.0;     // Time offset
      sza[i] = 0.8 + Math.random() * 2.2; // Smaller particle sizes (0.8-3.0 instead of 1.0-4.0)
    }

    return { positions: pos, speeds: spd, offsets: off, sizes: sza };
  }, []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uHeight: { value: height },
    uRadius: { value: radius },
  }), []);

  useFrame((state) => {
    if (meshRef.current) {
      (meshRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = state.clock.elapsedTime;
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
