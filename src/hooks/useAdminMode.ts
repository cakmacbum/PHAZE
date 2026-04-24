import { useState, useEffect } from 'react';
import { PatternCategory } from '../game/patternSystem';

export interface DebugState {
  enabled: boolean;
  auraLevel: number | null;
  selectedTheme: string | null;
  speedMultiplier: number;
  invincible: boolean;
  showHitboxes: boolean;
  showPatternName: boolean;
  forcedPattern: PatternCategory | null;
  isAdminRun: boolean;
}

export function useAdminMode() {
  const [debugState, setDebugState] = useState<DebugState>({
    enabled: false,
    auraLevel: null,
    selectedTheme: null,
    speedMultiplier: 1,
    invincible: false,
    showHitboxes: false,
    showPatternName: false,
    forcedPattern: null,
    isAdminRun: false,
  });

  // Handle keyboard Shift + A + D
  useEffect(() => {
    const keys = new Set<string>();
    
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.add(e.key.toLowerCase());
      if (e.shiftKey && keys.has('a') && keys.has('d')) {
        setDebugState(prev => ({ ...prev, enabled: !prev.enabled }));
        keys.clear(); // Prevent repeated firing
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Handle mobile 5 taps setting
  useEffect(() => {
    let tapCount = 0;
    let tapTimer: ReturnType<typeof setTimeout>;

    const handleTouch = (e: PointerEvent) => {
      const { clientX, clientY } = e;
      if (clientX > window.innerWidth - 100 && clientY < 100) {
        tapCount++;
        if (tapCount === 1) {
          tapTimer = setTimeout(() => { tapCount = 0; }, 2000);
        }
        if (tapCount >= 5) {
          setDebugState(prev => ({ ...prev, enabled: !prev.enabled }));
          tapCount = 0;
          clearTimeout(tapTimer);
        }
      }
    };

    window.addEventListener('pointerdown', handleTouch);
    return () => window.removeEventListener('pointerdown', handleTouch);
  }, []);

  const updateDebugState = (updates: Partial<DebugState>) => {
    setDebugState(prev => ({
      ...prev,
      ...updates,
      isAdminRun: true // Modifying debug state marks it as an admin run
    }));
  };

  return { debugState, updateDebugState };
}
