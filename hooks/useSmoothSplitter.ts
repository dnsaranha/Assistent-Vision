import { useState, useEffect, useRef, useCallback } from 'react';

const PRESETS = [30, 50, 70, 85] as const;
const MIN_RATIO = 20;
const MAX_RATIO = 85;
const DEFAULT_RATIO = 60;
const STORAGE_KEY = 'visualAssistantSplitRatio';

export const useSmoothSplitter = () => {
  const [splitRatio, setSplitRatio] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= MIN_RATIO && parsed <= MAX_RATIO) {
          return parsed;
        }
      }
    } catch {}
    return DEFAULT_RATIO;
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  const containerRef = useRef<HTMLElement | null>(null);
  const lastRatioRef = useRef<number>(splitRatio);

  // Sync mobile layout state on resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Save to localStorage when splitRatio changes and not dragging
  useEffect(() => {
    if (!isDragging && !isMaximized) {
      try {
        localStorage.setItem(STORAGE_KEY, splitRatio.toString());
      } catch {}
    }
  }, [splitRatio, isDragging, isMaximized]);

  const startDragging = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    if (isMaximized) {
      setIsMaximized(false);
    }
  }, [isMaximized]);

  // Global pointer listeners for smooth, non-escaping drag
  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      let newRatio: number;

      if (isMobile) {
        const offsetY = e.clientY - rect.top;
        newRatio = (offsetY / rect.height) * 100;
      } else {
        const offsetX = e.clientX - rect.left;
        newRatio = (offsetX / rect.width) * 100;
      }

      const clamped = Math.max(MIN_RATIO, Math.min(MAX_RATIO, newRatio));
      setSplitRatio(clamped);
      lastRatioRef.current = clamped;
    };

    const onPointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [isDragging, isMobile]);

  const applyPreset = useCallback((preset: number) => {
    setSplitRatio(preset);
    lastRatioRef.current = preset;
    setIsMaximized(false);
  }, []);

  const toggleMaximize = useCallback(() => {
    setIsMaximized(prev => {
      if (!prev) {
        lastRatioRef.current = splitRatio;
        return true;
      } else {
        setSplitRatio(lastRatioRef.current || DEFAULT_RATIO);
        return false;
      }
    });
  }, [splitRatio]);

  return {
    containerRef,
    splitRatio: isMaximized ? 100 : splitRatio,
    rawSplitRatio: splitRatio,
    isDragging,
    isMaximized,
    isMobile,
    presets: PRESETS,
    startDragging,
    applyPreset,
    toggleMaximize,
  };
};
