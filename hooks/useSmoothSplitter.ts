import { useState, useEffect, useRef, useCallback } from 'react';

const PRESETS = [30, 45, 60, 75] as const;
const MIN_RATIO = 20;
const MAX_RATIO = 80;
const STORAGE_KEY = 'visualAssistantSplitRatio_v2';

export const useSmoothSplitter = () => {
  const containerRef = useRef<HTMLElement | null>(null);
  const handleElementRef = useRef<HTMLElement | null>(null);

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return true;
  });

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
    // Default to 45% on mobile (optimal for video + chat) or 55% on desktop
    return typeof window !== 'undefined' && window.innerWidth < 768 ? 45 : 55;
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const lastRatioRef = useRef<number>(splitRatio);
  const isDraggingRef = useRef(false);

  // Sync orientation with container dimensions
  useEffect(() => {
    const updateOrientation = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        setIsMobile(width < 768);
      } else if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth < 768);
      }
    };

    updateOrientation();
    window.addEventListener('resize', updateOrientation);

    let observer: ResizeObserver | null = null;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => updateOrientation());
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateOrientation);
      observer?.disconnect();
    };
  }, []);

  // Save to localStorage when splitRatio changes and not dragging
  useEffect(() => {
    if (!isDragging && !isMaximized) {
      try {
        localStorage.setItem(STORAGE_KEY, splitRatio.toString());
      } catch {}
    }
  }, [splitRatio, isDragging, isMaximized]);

  // Compute ratio from coordinates
  const updateRatio = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    let newRatio: number;
    // Determine orientation from live container aspect ratio
    const liveIsMobile = rect.width < 768;

    if (liveIsMobile) {
      const offsetY = clientY - rect.top;
      newRatio = (offsetY / rect.height) * 100;
    } else {
      const offsetX = clientX - rect.left;
      newRatio = (offsetX / rect.width) * 100;
    }

    const clamped = Math.max(MIN_RATIO, Math.min(MAX_RATIO, Math.round(newRatio * 10) / 10));
    setSplitRatio(clamped);
    lastRatioRef.current = clamped;
  }, []);

  // Setup direct native event listeners on the handle element to bypass React synthetic delays
  const registerHandleElement = useCallback((element: HTMLElement | null) => {
    handleElementRef.current = element;
  }, []);

  useEffect(() => {
    const handleEl = handleElementRef.current;
    if (!handleEl) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      // CRITICAL: prevents Android Chrome from taking over with a page scroll!
      e.preventDefault();
      e.stopPropagation();

      isDraggingRef.current = true;
      setIsDragging(true);
      setIsMaximized(false);

      const touch = e.touches[0];
      updateRatio(touch.clientX, touch.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || e.touches.length !== 1) return;
      e.preventDefault();
      e.stopPropagation();

      const touch = e.touches[0];
      updateRatio(touch.clientX, touch.clientY);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();
      isDraggingRef.current = false;
      setIsDragging(false);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      isDraggingRef.current = true;
      setIsDragging(true);
      setIsMaximized(false);

      updateRatio(e.clientX, e.clientY);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();
      updateRatio(e.clientX, e.clientY);
    };

    const onMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
    };

    handleEl.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: false });
    window.addEventListener('touchcancel', onTouchEnd, { passive: false });

    handleEl.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      handleEl.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);

      handleEl.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [updateRatio]);

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
        setSplitRatio(lastRatioRef.current || (isMobile ? 45 : 55));
        return false;
      }
    });
  }, [splitRatio, isMobile]);

  return {
    containerRef,
    registerHandleElement,
    splitRatio: isMaximized ? 100 : splitRatio,
    rawSplitRatio: splitRatio,
    isDragging,
    isMaximized,
    isMobile,
    presets: PRESETS,
    applyPreset,
    toggleMaximize,
    setSplitRatio,
  };
};
