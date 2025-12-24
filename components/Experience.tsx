
import React, { useRef } from 'react';
import { Environment, OrbitControls, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useFrame } from '@react-three/fiber';
import { Foliage } from './Foliage';
import { Ornaments } from './Ornaments';
import { Polaroids } from './Polaroids';
import { TreeStar } from './TreeStar';
import { Snowfall } from './Snowfall';
import { TreeMode } from '../types';

interface ExperienceProps {
  mode: TreeMode;
  handPosition: { x: number; y: number; detected: boolean };
  uploadedPhotos: string[];
  twoHandsDetected: boolean;
  onClosestPhotoChange?: (photoUrl: string | null) => void;
}

export const Experience: React.FC<ExperienceProps> = ({ mode, handPosition, uploadedPhotos, twoHandsDetected, onClosestPhotoChange }) => {
  const controlsRef = useRef<any>(null);

  // Update camera rotation based on hand position
  useFrame((_, delta) => {
    if (controlsRef.current && handPosition.detected) {
      const controls = controlsRef.current;
      
      const targetAzimuth = (handPosition.x - 0.5) * Math.PI * 3;
      const adjustedY = (handPosition.y - 0.2) * 2.0;
      const clampedY = Math.max(0, Math.min(1, adjustedY));
      
      const minPolar = Math.PI / 4;
      const maxPolar = Math.PI / 1.8;
      const targetPolar = minPolar + clampedY * (maxPolar - minPolar);
      
      const currentAzimuth = controls.getAzimuthalAngle();
      const currentPolar = controls.getPolarAngle();
      
      let azimuthDiff = targetAzimuth - currentAzimuth;
      if (azimuthDiff > Math.PI) azimuthDiff -= Math.PI * 2;
      if (azimuthDiff < -Math.PI) azimuthDiff += Math.PI * 2;
      
      const lerpSpeed = 8;
      const newAzimuth = currentAzimuth + azimuthDiff * delta * lerpSpeed;
      const newPolar = currentPolar + (targetPolar - currentPolar) * delta * lerpSpeed;
      
      const radius = controls.getDistance();
      const targetY = 4;
      
      const x = radius * Math.sin(newPolar) * Math.sin(newAzimuth);
      const y = targetY + radius * Math.cos(newPolar);
      const z = radius * Math.sin(newPolar) * Math.cos(newAzimuth);
      
      controls.object.position.set(x, y, z);
      controls.target.set(0, targetY, 0);
      controls.update();
    }
  });

  return (
    <>
      <OrbitControls 
        ref={controlsRef}
        enablePan={false} 
        minPolarAngle={Math.PI / 4} 
        maxPolarAngle={Math.PI / 1.8}
        minDistance={10}
        maxDistance={30}
        enableDamping
        dampingFactor={0.05}
        enabled={true}
      />

      <Environment preset="lobby" background={false} blur={0.8} />
      
      <ambientLight intensity={0.2} color="#004422" />
      <spotLight 
        position={[10, 20, 10]} 
        angle={0.2} 
        penumbra={1} 
        intensity={2} 
        color="#fff5cc" 
        castShadow 
      />
      <pointLight position={[-10, 5, -10]} intensity={1} color="#D4AF37" />

      {/* Atmospheric Snowfall */}
      <Snowfall />

      <group position={[0, -5, 0]}>
        <Foliage mode={mode} count={12000} />
        <Ornaments mode={mode} count={600} />
        <Polaroids mode={mode} uploadedPhotos={uploadedPhotos} twoHandsDetected={twoHandsDetected} onClosestPhotoChange={onClosestPhotoChange} />
        <TreeStar mode={mode} />
        
        <ContactShadows 
          opacity={0.7} 
          scale={30} 
          blur={2} 
          far={4.5} 
          color="#000000" 
        />
      </group>

      <EffectComposer enableNormalPass={false}>
        <Bloom 
          luminanceThreshold={0.8} 
          mipmapBlur 
          intensity={1.5} 
          radius={0.6}
        />
        <Vignette eskil={false} offset={0.1} darkness={0.7} />
        <Noise opacity={0.02} blendFunction={BlendFunction.OVERLAY} />
      </EffectComposer>
    </>
  );
};
