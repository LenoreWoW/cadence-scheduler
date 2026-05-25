
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
    soundEnabled: true,
    meetingPlatform: '',
    meetingLink: ''
  });

  const steps = [
    { id: 'welcome', title: "Welcome to Cadence", subtitle: "Let's set up your scheduling environment." },
    { id: 'availability', title: "Set Your Availability", subtitle: "When can people book time with you?" },
    { id: 'meetings', title: "Online Meetings", subtitle: "Set up your video conferencing preferences." },
    { id: 'preferences', title: "Final Touches", subtitle: "Customize your experience." }
  ];

  const platformOptions = [
    { id: 'Zoom', label: 'Zoom', icon: '📹', color: 'bg-blue-500' },
    { id: 'Microsoft Teams', label: 'Microsoft Teams', icon: '🟣', color: 'bg-purple-600' },
    { id: 'Google Meet', label: 'Google Meet', icon: '🟢', color: 'bg-green-500' },
    { id: 'Webex', label: 'Webex', icon: '🔵', color: 'bg-blue-600' },
    { id: 'Other', label: 'Custom', icon: '🔗', color: 'bg-gray-500' }
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white">
      
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
        <div className="w-full max-w-md h-1 bg-gray-100 rounded-full mb-6 overflow-hidden flex-shrink-0">
           <div 
             className="h-full bg-al-adaam transition-all duration-500 ease-spring"
             style={{ width: `${((step + 1) / steps.length) * 100}%` }}
           ></div>
        </div>

        <div className="text-center mb-4 space-y-1 animate-fade-in-up flex-shrink-0">
           <div className="w-12 h-12 bg-al-adaam text-white rounded-full flex items-center justify-center text-lg font-serif font-bold mx-auto shadow-lg shadow-al-adaam/30 mb-2">
              {step + 1}
           </div>
           <h1 className="text-2xl md:text-3xl font-display font-medium text-charcoal">{steps[step].title}</h1>
           <p className="text-dune text-sm">{steps[step].subtitle}</p>
        </div>

        <div className="w-full max-w-md bg-white border border-gray-100 shadow-xl rounded-2xl p-5 mb-20 animate-scale-in backdrop-blur-sm bg-white/90 overflow-y-auto flex-1 min-h-0 max-h-[55vh]">
           {step === 0 && (
              <div className="text-center space-y-6">
                 <p className="text-gray-600 leading-relaxed">
                    Cadence helps you manage your time effectively across your team. 
                    We'll guide you through a quick setup to ensure your calendar is ready for bookings.
                 </p>
                 <div className="grid grid-cols-2 gap-4 text-left">
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                       <div className="text-al-adaam mb-2 text-xl">📅</div>
                       <h4 className="font-bold text-sm text-charcoal">Smart Scheduling</h4>
                       <p className="text-xs text-gray-500">Auto-conflict detection</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                       <div className="text-palm mb-2 text-xl">👥</div>
                       <h4 className="font-bold text-sm text-charcoal">Team Sync</h4>
                       <p className="text-xs text-gray-500">Coordinate effortlessly</p>
                    </div>
                 </div>
              </div>
           )}

           {step === 1 && (
              <div className="space-y-6">
                 <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-3">Working Days</label>
                    <div className="flex justify-between gap-2">
                       {daysOfWeek.map(day => (
                          <button
                            key={day.id}
                            onClick={() => toggleDay(day.id)}
                            className={`w-10 h-10 rounded-full font-bold text-sm transition-all transform hover:scale-105 ${formData.workingDays.includes(day.id) ? 'bg-charcoal text-white shadow-md' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                          >
                             {day.label}
                          </button>
                       ))}
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-2">Start Time</label>
                       <select 
                         value={formData.startHour}
                         onChange={e => setFormData({...formData, startHour: Number(e.target.value)})}
                         className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-al-adaam cursor-pointer"
                       >
                          {Array.from({length: 24}, (_, i) => i).map(h => <option key={h} value={h}>{h}:00</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-2">End Time</label>
                       <select 
                         value={formData.endHour}
                         onChange={e => setFormData({...formData, endHour: Number(e.target.value)})}
                         className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-al-adaam cursor-pointer"
                       >
                          {Array.from({length: 24}, (_, i) => i).map(h => <option key={h} value={h}>{h}:00</option>)}
                       </select>
                    </div>
                 </div>
              </div>
           )}

           {step === 2 && (
              <div className="space-y-3">
                 <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-start gap-2">
                    <div className="text-lg">📹</div>
                    <div>
                       <p className="text-xs text-blue-800">
                          Set your preferred video platform so attendees can easily join your online meetings.
                       </p>
                       <p className="text-[10px] text-blue-600 mt-0.5">
                          This step is optional — you can skip and configure it later.
                       </p>
                    </div>
                 </div>

                 <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-dune mb-2">Select Platform (Optional)</label>
                    <div className="grid grid-cols-2 gap-1.5">
                       {platformOptions.map(platform => (
                          <button
                            key={platform.id}
                            onClick={() => setFormData({...formData, meetingPlatform: platform.id})}
                            className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all text-left ${
                              formData.meetingPlatform === platform.id 
                                ? 'border-al-adaam bg-al-adaam/5 shadow-sm' 
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                             <span className="text-base">{platform.icon}</span>
                             <span className={`text-xs font-medium ${formData.meetingPlatform === platform.id ? 'text-al-adaam' : 'text-charcoal'}`}>
                                {platform.label}
                             </span>
                          </button>
                       ))}
                    </div>
                 </div>
                 
                 <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-dune mb-1">
                       Your Meeting Link
                    </label>
                    <input 
                      type="url"
                      value={formData.meetingLink}
                      onChange={e => setFormData({...formData, meetingLink: e.target.value})}
                      placeholder="https://zoom.us/j/your-meeting-id"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-al-adaam focus:border-transparent"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                       This link will be shared with attendees for online meetings.
                    </p>
                 </div>
              </div>
           )}

           {step === 3 && (
              <div className="space-y-6">
                 <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div>
                       <h4 className="font-bold text-charcoal text-sm">Enable Sound Effects</h4>
                       <p className="text-xs text-gray-500">Audio feedback for interactions</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={formData.soundEnabled} onChange={e => setFormData({...formData, soundEnabled: e.target.checked})} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-al-adaam"></div>
                    </label>
                 </div>
                 
                 <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-3">Default Duration</label>
                    <div className="grid grid-cols-3 gap-2">
                       {[15, 30, 60].map(m => (
                          <button
                            key={m}
                            onClick={() => setFormData({...formData, slotDuration: m})}
                            className={`py-2 rounded-lg text-xs font-bold border transition-all ${formData.slotDuration === m ? 'border-al-adaam text-al-adaam bg-al-adaam/5' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                          >
                             {m} min
                          </button>
                       ))}
                    </div>
                 </div>
              </div>
           )}
        </div>

      </div>

      {/* Navigation buttons - fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 z-[110]">
        <div className="max-w-md mx-auto flex justify-between items-center">
           <button 
             onClick={() => onComplete(formData)} 
             className="text-gray-400 hover:text-charcoal text-sm font-medium transition-colors"
           >
              Skip Setup
           </button>
           
           <Button 
             onClick={handleNext} 
             className="shadow-xl shadow-al-adaam/20"
             disabled={!canProceed()}
           >
              {step === steps.length - 1 ? 'Get Started' : 'Continue'}
           </Button>
        </div>
      </div>
    </div>
  );
};
