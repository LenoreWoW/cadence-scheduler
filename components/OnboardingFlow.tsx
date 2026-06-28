
import React, { useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { Button } from './Button';
import { User, Language } from '../types';

// Floating calendar - more relevant to scheduling app
const FloatingCalendar = ({ step }: { step: number }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.3;
      groupRef.current.rotation.x = Math.cos(state.clock.elapsedTime * 0.2) * 0.15;
      const targetScale = 1 + (step * 0.15);
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.05);
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.3} floatIntensity={0.4}>
      <group ref={groupRef} position={[0, 0, 0]} scale={1}>
        {/* Main calendar card */}
        <mesh>
          <boxGeometry args={[3, 4, 0.15]} />
          <meshStandardMaterial color="#ffffff" roughness={0.2} />
        </mesh>

        {/* Header */}
        <mesh position={[0, 1.5, 0.1]}>
          <boxGeometry args={[3, 0.9, 0.05]} />
          <meshStandardMaterial color="#8A1538" roughness={0.2} metalness={0.3} />
        </mesh>

        {/* Day cells with highlighted current day */}
        {[...Array(4)].map((_, row) =>
          [...Array(7)].map((_, col) => {
            const isHighlighted = row === 1 && col === 3;
            return (
              <mesh
                key={`${row}-${col}`}
                position={[-1.1 + col * 0.36, 0.5 - row * 0.5, 0.1]}
              >
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

        {/* Binding rings */}
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

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete, currentUser, t }) => {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    workingDays: [0, 1, 2, 3, 4],
    startHour: 9,
    endHour: 17,
    slotDuration: 30,
    meetingPlatform: '',
    meetingLink: ''
  });

  const steps = [
    { id: 'welcome', title: t('onbWelcomeTitle'), subtitle: t('onbWelcomeSub') },
    { id: 'availability', title: t('onbAvailabilityTitle'), subtitle: t('onbAvailabilitySub') },
    { id: 'meetings', title: t('onlineMeetings'), subtitle: t('onbMeetingsSub') },
    { id: 'preferences', title: t('finalTouches'), subtitle: t('onbPreferencesSub') }
  ];

  const platformOptions = [
    { id: 'Zoom', label: 'Zoom', icon: '📹', color: 'bg-blue-500' },
    { id: 'Microsoft Teams', label: 'Microsoft Teams', icon: '🟣', color: 'bg-purple-600' },
    { id: 'Google Meet', label: 'Google Meet', icon: '🟢', color: 'bg-green-500' },
    { id: 'Webex', label: 'Webex', icon: '🔵', color: 'bg-blue-600' },
    { id: 'Other', label: t('custom') || 'Custom', icon: '🔗', color: 'bg-gray-500' }
  ];

  const canProceed = () => {
    // All steps are optional - users can configure later
    return true;
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(prev => prev + 1);
    } else {
      onComplete(formData);
    }
  };

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

      {/* 3D Background Element - Calendar instead of cube */}
      <div className="absolute top-0 right-0 w-1/2 h-full opacity-15 pointer-events-none">
         <Canvas>
            <ambientLight intensity={0.5} />
            <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
            <FloatingCalendar step={step} />
            <Environment preset="city" />
         </Canvas>
      </div>

      <div className="w-full max-w-2xl p-4 md:p-6 flex flex-col items-center relative z-10 max-h-[100vh] overflow-hidden">

        {/* Progress */}
        <div className="w-full max-w-md h-1 bg-gray-100 dark:bg-gray-800 rounded-full mb-6 overflow-hidden flex-shrink-0">
           <div
             className="h-full bg-al-adaam transition-all duration-500 ease-spring"
             style={{ width: `${((step + 1) / steps.length) * 100}%` }}
           ></div>
        </div>

        <div className="text-center mb-4 space-y-1 animate-fade-in-up flex-shrink-0">
           <div className="w-12 h-12 bg-al-adaam text-white rounded-full flex items-center justify-center text-lg font-serif font-bold mx-auto shadow-md shadow-al-adaam/20 mb-2">
              {step + 1}
           </div>
           <h1 className="text-2xl md:text-3xl font-display font-medium text-charcoal dark:text-white">{steps[step].title}</h1>
           <p className="text-dune dark:text-gray-400 text-sm">{steps[step].subtitle}</p>
        </div>

        <div className="w-full max-w-md bg-white/90 dark:bg-gray-800/90 border border-gray-100 dark:border-gray-700 shadow-lg rounded-2xl p-5 mb-20 animate-scale-in backdrop-blur-sm overflow-y-auto flex-1 min-h-0 max-h-[55vh]">
           {step === 0 && (
              <div className="text-center space-y-6">
                 <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    {t('onbIntro')}
                 </p>
                 <div className="grid grid-cols-2 gap-4 text-left">
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-700">
                       <div className="text-al-adaam mb-2 text-xl">📅</div>
                       <h4 className="font-semibold text-sm text-charcoal dark:text-white">{t('smartScheduling')}</h4>
                       <p className="text-xs text-gray-500 dark:text-gray-400">{t('autoConflictDetection')}</p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-700">
                       <div className="text-palm mb-2 text-xl">👥</div>
                       <h4 className="font-semibold text-sm text-charcoal dark:text-white">{t('teamSync')}</h4>
                       <p className="text-xs text-gray-500 dark:text-gray-400">{t('coordinateEffortlessly')}</p>
                    </div>
                 </div>
              </div>
           )}

           {step === 1 && (
              <div className="space-y-6">
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
              </div>
           )}

           {step === 2 && (
              <div className="space-y-3">
                 <div className="p-3 bg-sea/5 dark:bg-sea/10 rounded-lg border border-sea/20 flex items-start gap-2">
                    <div className="text-lg">📹</div>
                    <div>
                       <p className="text-xs text-charcoal dark:text-gray-200">
                          {t('onbMeetingsInfo')}
                       </p>
                       <p className="text-[10px] text-dune dark:text-gray-400 mt-0.5">
                          {t('onbOptionalStep')}
                       </p>
                    </div>
                 </div>

                 <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-dune mb-2">{t('selectPlatformOptional')}</label>
                    <div className="grid grid-cols-2 gap-1.5">
                       {platformOptions.map(platform => (
                          <button
                            key={platform.id}
                            onClick={() => setFormData({...formData, meetingPlatform: platform.id})}
                            className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all text-left ${
                              formData.meetingPlatform === platform.id
                                ? 'border-al-adaam bg-al-adaam/5 shadow-sm'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                          >
                             <span className="text-base">{platform.icon}</span>
                             <span className={`text-xs font-medium ${formData.meetingPlatform === platform.id ? 'text-al-adaam' : 'text-charcoal dark:text-gray-200'}`}>
                                {platform.label}
                             </span>
                          </button>
                       ))}
                    </div>
                 </div>

                 <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-dune mb-1">
                       {t('yourMeetingLink')}
                    </label>
                    <input
                      type="url"
                      value={formData.meetingLink}
                      onChange={e => setFormData({...formData, meetingLink: e.target.value})}
                      placeholder="https://zoom.us/j/your-meeting-id"
                      className="w-full bg-gray-50 dark:bg-gray-700 text-charcoal dark:text-white border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-al-adaam focus:border-transparent"
                    />
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                       {t('onbMeetingLinkHelp')}
                    </p>
                 </div>
              </div>
           )}

           {step === 3 && (
              <div className="space-y-6">
                 <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-dune mb-3">{t('defaultDuration')}</label>
                    <div className="grid grid-cols-3 gap-2">
                       {[15, 30, 60].map(m => (
                          <button
                            key={m}
                            onClick={() => setFormData({...formData, slotDuration: m})}
                            className={`py-2 rounded-lg text-xs font-semibold border transition-all ${formData.slotDuration === m ? 'border-al-adaam text-al-adaam bg-al-adaam/5' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'}`}
                          >
                             {m} {t('minShort')}
                          </button>
                       ))}
                    </div>
                 </div>
              </div>
           )}
        </div>

      </div>

      {/* Navigation buttons - fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#0a0a0a] border-t border-gray-100 dark:border-gray-800 p-4 z-[110]">
        <div className="max-w-md mx-auto flex justify-between items-center">
           <button
             onClick={() => onComplete(formData)}
             className="text-gray-400 hover:text-charcoal dark:hover:text-white text-sm font-medium transition-colors"
           >
              {t('skipSetup')}
           </button>

           <Button
             onClick={handleNext}
             disabled={!canProceed()}
           >
              {step === steps.length - 1 ? t('getStarted') : t('continue')}
           </Button>
        </div>
      </div>
    </div>
  );
};
