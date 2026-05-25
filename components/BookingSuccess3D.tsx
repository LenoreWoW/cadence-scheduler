import React, { useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const ConfettiParticle = ({ position, color, speed }: any) => {
  const mesh = React.useRef<THREE.Mesh>(null);
  
  useFrame(() => {
    if (mesh.current) {
      mesh.current.position.y -= speed * 0.05;
      mesh.current.rotation.x += speed * 0.02;
      mesh.current.rotation.y += speed * 0.02;
      
      // Reset if out of view
      if (mesh.current.position.y < -5) {
        mesh.current.position.y = 5;
        mesh.current.position.x = (Math.random() - 0.5) * 10;
      }
    }
  });

  return (
    <mesh ref={mesh} position={position}>
      <planeGeometry args={[0.1, 0.1]} />
      <meshBasicMaterial color={color} side={THREE.DoubleSide} />
    </mesh>
  );
};

export const BookingSuccess3D = () => {
  const particles = useMemo(() => {
    const temp = [];
    const colors = ['#8A1538', '#A29475', '#129b82', '#fdf39d', '#ffffff'];
    for (let i = 0; i < 100; i++) {
      temp.push({
        position: [(Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 5],
        color: colors[Math.floor(Math.random() * colors.length)],
        speed: Math.random() + 0.5
      });
    }
    return temp;
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
      <Canvas camera={{ position: [0, 0, 5] }}>
        {particles.map((p, i) => (
          <ConfettiParticle key={i} {...p} />
        ))}
      </Canvas>
    </div>
  );
};

