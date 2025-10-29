import { useCallback, useRef } from 'react';

// Create a single, reusable AudioContext to avoid performance issues.
const audioContext = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

/**
 * A custom hook to provide audio feedback cues.
 */
export const useAudioCues = () => {
  const playSound = useCallback((type: 'start' | 'stop') => {
    if (!audioContext || audioContext.state === 'suspended') {
      audioContext?.resume();
    }
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Configure sound properties based on the type
    if (type === 'start') {
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5 note
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    } else { // 'stop'
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5 note
      gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
    }
    
    oscillator.type = 'sine';

    const duration = 0.1;
    oscillator.start(audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + duration);
    oscillator.stop(audioContext.currentTime + duration);
  }, []);

  const playStartSound = useCallback(() => playSound('start'), [playSound]);
  const playStopSound = useCallback(() => playSound('stop'), [playSound]);

  return { playStartSound, playStopSound };
};
