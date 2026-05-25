import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Meeting, TimeSlot } from '../types';
import { findNextAvailableSlot, QuickBookResult } from '../services/schedulerService';
import { smartDefaults } from '../services/smartDefaults';
import { Button } from './Button';
import { FloatingLabelInput } from './FloatingLabelInput';

interface QuickBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { hostId: string; date: Date; slot: TimeSlot; title: string }) => void;
  hosts: User[];
  meetings: Meeting[];
  currentUser: User | null;
}

export const QuickBookModal: React.FC<QuickBookModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  hosts,
  meetings,
  currentUser
}) => {
  const [step, setStep] = useState<'host' | 'confirm'>('host');
  const [selectedHostId, setSelectedHostId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [result, setResult] = useState<QuickBookResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize with last used host or recent host
  useEffect(() => {
    if (isOpen) {
      const patterns = smartDefaults.getPatterns();
      if (patterns.lastHostId && hosts.find(h => h.id === patterns.lastHostId)) {
        setSelectedHostId(patterns.lastHostId);
      } else if (hosts.length > 0) {
        setSelectedHostId(hosts[0].id);
      }
      setStep('host');
      setResult(null);
      setError(null);
      setTitle('Quick Meeting');
    }
  }, [isOpen, hosts]);

  const handleFindSlot = async () => {
    if (!selectedHostId) return;
    
    setSearching(true);
    setError(null);
    
    // Simulate slight network delay for better UX
    await new Promise(resolve => setTimeout(resolve, 600));
    
    const host = hosts.find(h => h.id === selectedHostId);
    if (!host) {
      setSearching(false);
      return;
    }
    
    const nextSlot = findNextAvailableSlot(host, meetings);
    
    if (nextSlot) {
      setResult(nextSlot);
      setStep('confirm');
    } else {
      setError('No available slots found in the next 14 days.');
    }
    setSearching(false);
  };

  const handleConfirm = () => {
    if (result && selectedHostId) {
      onConfirm({
        hostId: selectedHostId,
        date: result.date,
        slot: result.slot,
        title
      });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-charcoal dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-al-adaam" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Quick Book
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {step === 'host' ? (
              <motion.div
                key="host"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Host</label>
                  <select
                    value={selectedHostId}
                    onChange={(e) => setSelectedHostId(e.target.value)}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-charcoal dark:text-white focus:ring-2 focus:ring-al-adaam focus:border-transparent"
                  >
                    {hosts.map(host => (
                      <option key={host.id} value={host.id}>
                        {host.name}{host.department ? ` (${host.department})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <FloatingLabelInput
                  label="Meeting Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />

                {error && (
                  <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </div>
                )}

                <Button 
                  fullWidth 
                  onClick={handleFindSlot} 
                  loading={searching}
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  }
                >
                  Find Next Available Slot
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {result && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6 text-center border border-gray-100 dark:border-gray-600">
                    <div className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold mb-2">Next Available Slot</div>
                    <div className="text-3xl font-bold text-al-adaam mb-1">
                      {result.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </div>
                    <div className="text-2xl font-bold text-charcoal dark:text-white mb-4">
                      {result.slot.label}
                    </div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white dark:bg-gray-600 rounded-full shadow-sm text-sm text-gray-600 dark:text-gray-300">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      {hosts.find(h => h.id === selectedHostId)?.name}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="ghost" fullWidth onClick={() => setStep('host')}>Back</Button>
                  <Button variant="primary" fullWidth onClick={handleConfirm}>Confirm Booking</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

