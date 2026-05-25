import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, ContactShadows, Environment, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// --- Reusable Low-Poly Models ---

const FloatingCalendar = ({ color = "#8A1538" }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.2;
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.1;
    }
  });

  return (
    <group ref={ref}>
      {/* Calendar Page */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1.8, 2.2, 0.1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} />
      </mesh>
      {/* Header */}
      <mesh position={[0, 0.8, 0.06]}>
        <boxGeometry args={[1.8, 0.6, 0.05]} />
        <meshStandardMaterial color={color} roughness={0.2} />
      </mesh>
      {/* Ring Binder Holes */}
      {[-0.5, 0, 0.5].map((x, i) => (
        <mesh key={i} position={[x, 1.05, 0]}>
          <torusGeometry args={[0.1, 0.03, 16, 32]} />
          <meshStandardMaterial color="#555" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      {/* Lines */}
      {[0.2, 0, -0.2, -0.4, -0.6].map((y, i) => (
        <mesh key={i} position={[0, y, 0.06]}>
          <boxGeometry args={[1.2, 0.05, 0.01]} />
          <meshStandardMaterial color="#eee" />
        </mesh>
      ))}
    </group>
  );
};

const FloatingClock = ({ color = "#A29475" }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.2;
      ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
  });

  return (
    <group ref={ref}>
      {/* Frame */}
      <mesh>
        <cylinderGeometry args={[1.2, 1.2, 0.2, 32]} rotation={[Math.PI / 2, 0, 0]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.2} />
      </mesh>
      {/* Face */}
      <mesh position={[0, 0, 0.11]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1, 32]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {/* Hands */}
      <mesh position={[0, 0.3, 0.12]} rotation={[0, 0, -0.5]}>
        <boxGeometry args={[0.1, 0.6, 0.02]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[0.2, 0, 0.12]} rotation={[0, 0, 1.2]}>
        <boxGeometry args={[0.4, 0.08, 0.02]} />
        <meshStandardMaterial color="#333" />
      </mesh>
    </group>
  );
};

const FloatingBell = ({ color = "#129b82" }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 2) * 0.1; // Ringing
    }
  });

  return (
    <group ref={ref}>
      {/* Dome */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.8, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.3} />
      </mesh>
      {/* Base Rim */}
      <mesh position={[0, -0.1, 0]}>
        <torusGeometry args={[0.8, 0.1, 16, 32]} rotation={[Math.PI / 2, 0, 0]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.3} />
      </mesh>
      {/* Clapper */}
      <mesh position={[0, -0.6, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#ffd700" metalness={0.8} />
      </mesh>
    </group>
  );
};

// --- Main Component ---

interface EmptyState3DProps {
  type: 'calendar' | 'clock' | 'bell';
  className?: string;
}

export const EmptyState3D: React.FC<EmptyState3DProps> = ({ type, className = "h-48 w-full" }) => {
  return (
    <div className={className}>
      <Canvas dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={45} />
        <ambientLight intensity={0.6} />
        <spotLight position={[5, 5, 5]} angle={0.3} penumbra={1} intensity={1} castShadow />
        <pointLight position={[-5, -5, -5]} intensity={0.5} />
        
        <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
          {type === 'calendar' && <FloatingCalendar />}
          {type === 'clock' && <FloatingClock />}
          {type === 'bell' && <FloatingBell />}
        </Float>

        <ContactShadows position={[0, -2, 0]} opacity={0.4} scale={10} blur={2.5} far={4} />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
};

