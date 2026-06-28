
import React, { useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { Button } from './Button';
import { User } from '../types';

// Floating calendar - a small brand moment behind the single setup step.
const FloatingCalendar = () => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.3;
      groupRef.current.rotation.x = Math.cos(state.clock.elapsedTime * 0.2) * 0.15;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.3} floatIntensity={0.4}>
      <group ref={groupRef} position={[0, 0, 0]} scale={1}>
        <mesh>
          <boxGeometry args={[3, 4, 0.15]} />
          <meshStandardMaterial color="#ffffff" roughness={0.2} />
        </mesh>
        <mesh position={[0, 1.5, 0.1]}>
          <boxGeometry args={[3, 0.9, 0.05]} />
          <meshStandardMaterial color="#8A1538" roughness={0.2} metalness={0.3} />
        </mesh>
        {[...Array(4)].map((_, row) =>
          [...Array(7)].map((_, col) => {
            const isHighlighted = row === 1 && col === 3;
            return (
              <mesh key={`${row}-${col}`} position={[-1.1 + col * 0.36, 0.5 - row * 0.5, 0.1]}>
                <boxGeometry args={[0.28, 0.36, 0.03]} />
                <meshStandardMaterial
                  color={isHighlighted ? '#8A1538' : '#f5f5f5'}
                  roughness={0.4}
                  emissive={isHighlighted ? '#8A1538' : '#000000'}
                  emissiveIntensity={isHighlighted ? 0.3 : 0}
                />
              </mesh>
            );
          })
        )}
        {[-0.8, 0, 0.8].map((x, i) => (
          <mesh key={i} position={[x, 2.05, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.15, 0.04, 8, 24]} />
            <meshStandardMaterial color="#A29475" metalness={0.8} roughness={0.2} />
          </mesh>
        ))}
      </group>
    </Float>
  );
};

interface OnboardingFlowProps {
  onComplete: (data: any) => void;
  currentUser: User;
  t: (key: string) => string;
}

/**
 * OnboardingFlow — single lightweight setup step.
 *
 * With portal SSO the account already exists, so first-run setup is reduced to
 * the one thing only the user can answer: their availability (working days +
 * hours). Everything else (meeting platform/link, slot duration, buffers, time
 * off, etc.) is configured later in Settings, so it's intentionally omitted here.
 */
export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete, currentUser, t }) => {
  const [formData, setFormData] = useState({
    workingDays: currentUser.availability?.days ?? [0, 1, 2, 3, 4],
    startHour: currentUser.availability?.startHour ?? 9,
    endHour: currentUser.availability?.endHour ?? 17,
    // Sensible defaults — fine-tuned later in Settings, not asked up front.
    slotDuration: currentUser.availability?.slotDuration ?? 30,
    meetingPlatform: '',
    meetingLink: ''
  });

  const daysOfWeek = [
    { id: 0, label: 'S' }, { id: 1, label: 'M' }, { id: 2, label: 'T' },
    { id: 3, label: 'W' }, { id: 4, label: 'T' }, { id: 5, label: 'F' }, { id: 6, label: 'S' },
  ];

  const toggleDay = (id: number) => {
    setFormData(prev => ({
      ...prev,
      workingDays: prev.workingDays.includes(id) ? prev.workingDays.filter(d => d !== id) : [...prev.workingDays, id]
    }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white dark:bg-[#0a0a0a]">

      {/* 3D brand moment */}
      <div className="absolute top-0 right-0 w-1/2 h-full opacity-15 pointer-events-none">
         <Canvas>
            <ambientLight intensity={0.5} />
            <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
            <FloatingCalendar />
            <Environment preset="city" />
         </Canvas>
      </div>

      <div className="w-full max-w-md p-4 md:p-6 flex flex-col items-center relative z-10">

        <div className="text-center mb-6 space-y-2 animate-fade-in-up">
           <div className="w-12 h-12 bg-al-adaam text-white rounded-2xl flex items-center justify-center mx-auto shadow-md shadow-al-adaam/20 mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
           </div>
           <h1 className="text-2xl md:text-3xl font-display font-medium text-charcoal dark:text-white">{t('onbAvailabilityTitle')}</h1>
           <p className="text-dune dark:text-gray-400 text-sm">{t('onbAvailabilitySub')}</p>
        </div>

        <div className="w-full bg-white/90 dark:bg-gray-800/90 border border-gray-100 dark:border-gray-700 shadow-lg rounded-2xl p-6 animate-scale-in backdrop-blur-sm space-y-6">
           <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-dune mb-3">{t('workingDays')}</label>
              <div className="flex justify-between gap-2">
                 {daysOfWeek.map(day => (
                    <button
                      key={day.id}
                      onClick={() => toggleDay(day.id)}
                      className={`w-10 h-10 rounded-full font-semibold text-sm transition-all transform hover:scale-105 ${formData.workingDays.includes(day.id) ? 'bg-charcoal dark:bg-white text-white dark:text-charcoal shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                    >
                       {day.label}
                    </button>
                 ))}
              </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div>
                 <label className="block text-xs font-semibold uppercase tracking-widest text-dune mb-2">{t('startTime')}</label>
                 <select
                   value={formData.startHour}
                   onChange={e => setFormData({...formData, startHour: Number(e.target.value)})}
                   className="w-full bg-gray-50 dark:bg-gray-700 text-charcoal dark:text-white border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-al-adaam cursor-pointer"
                 >
                    {Array.from({length: 24}, (_, i) => i).map(h => <option key={h} value={h}>{h}:00</option>)}
                 </select>
              </div>
              <div>
                 <label className="block text-xs font-semibold uppercase tracking-widest text-dune mb-2">{t('endTime')}</label>
                 <select
                   value={formData.endHour}
                   onChange={e => setFormData({...formData, endHour: Number(e.target.value)})}
                   className="w-full bg-gray-50 dark:bg-gray-700 text-charcoal dark:text-white border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-al-adaam cursor-pointer"
                 >
                    {Array.from({length: 24}, (_, i) => i).map(h => <option key={h} value={h}>{h}:00</option>)}
                 </select>
              </div>
           </div>

           <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">{t('onbChangeLater')}</p>

           <div className="flex items-center justify-between gap-3 pt-1">
              <button
                onClick={() => onComplete(formData)}
                className="text-gray-400 hover:text-charcoal dark:hover:text-white text-sm font-medium transition-colors"
              >
                 {t('skipSetup')}
              </button>
              <Button onClick={() => onComplete(formData)}>
                 {t('saveAndContinue')}
              </Button>
           </div>
        </div>
      </div>
    </div>
  );
};
