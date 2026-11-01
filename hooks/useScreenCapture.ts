import { useState, useRef, useCallback, useEffect } from 'react';
import { renderDemoScreen, DEMO_SCREENS } from '../utils/demoScreens';

export type ScreenMode = 'native' | 'virtual' | null;

interface UseScreenCaptureProps {
  shareSystemAudio: boolean;
}

export const useScreenCapture = ({ shareSystemAudio }: UseScreenCaptureProps) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [screenMode, setScreenMode] = useState<ScreenMode>(null);
  const [activeDemo, setActiveDemo] = useState<string>('code-editor');
  const [customImageDataUrl, setCustomImageDataUrl] = useState<string | null>(null);

  // References to keep virtual screen canvas alive and rendering
  const virtualCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animIntervalRef = useRef<number | null>(null);
  const customImgElementRef = useRef<HTMLImageElement | null>(null);

  const isSharing = !!stream || screenMode !== null;

  // Check if browser environment supports native getDisplayMedia
  const isNativeSupported = 
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === 'function';

  // Helper to get or create virtual canvas
  const getVirtualCanvas = useCallback(() => {
    if (!virtualCanvasRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      virtualCanvasRef.current = canvas;
    }
    return virtualCanvasRef.current;
  }, []);

  // Redraw current virtual screen (either custom image or demo screen)
  const redrawVirtualScreen = useCallback(() => {
    const canvas = getVirtualCanvas();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (customImgElementRef.current && customImgElementRef.current.complete) {
      const img = customImgElementRef.current;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Fit image with letterboxing
      const hRatio = canvas.width / img.width;
      const vRatio = canvas.height / img.height;
      const ratio = Math.min(hRatio, vRatio);
      const centerShiftX = (canvas.width - img.width * ratio) / 2;
      const centerShiftY = (canvas.height - img.height * ratio) / 2;

      ctx.drawImage(
        img,
        0,
        0,
        img.width,
        img.height,
        centerShiftX,
        centerShiftY,
        img.width * ratio,
        img.height * ratio
      );
    } else {
      renderDemoScreen(canvas, activeDemo);
    }
  }, [activeDemo, getVirtualCanvas]);

  // Start virtual screen stream
  const startVirtualScreen = useCallback((demoId?: string): MediaStream => {
    const targetDemo = demoId || activeDemo;
    setActiveDemo(targetDemo);

    const canvas = getVirtualCanvas();
    renderDemoScreen(canvas, targetDemo);

    let virtualStream: MediaStream | null = null;
    try {
      if (typeof (canvas as any).captureStream === 'function') {
        virtualStream = (canvas as any).captureStream(30);
      }
    } catch (e) {
      console.warn("Could not create captureStream from canvas, using canvas direct fallback:", e);
    }

    if (!virtualStream) {
      // In rare environments where captureStream is absent, create a silent/dummy stream
      // or track so downstream components (video element) stay safe
      try {
        const dummyCanvas = document.createElement('canvas');
        dummyCanvas.width = 1;
        dummyCanvas.height = 1;
        virtualStream = (dummyCanvas as any).captureStream ? (dummyCanvas as any).captureStream(1) : null;
      } catch (e) {
        virtualStream = null;
      }
    }

    setStream(virtualStream);
    setScreenMode('virtual');

    // Keep virtual screen alive with periodic tick for video element
    if (animIntervalRef.current) clearInterval(animIntervalRef.current);
    animIntervalRef.current = window.setInterval(() => {
      // Light redraw to keep track active if needed
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // minimal invisible pixel touch to trigger captureStream frame update
        ctx.fillStyle = 'rgba(0,0,0,0.001)';
        ctx.fillRect(0, 0, 1, 1);
      }
    }, 1000);

    return virtualStream as MediaStream;
  }, [activeDemo, getVirtualCanvas]);

  const startScreenCapture = useCallback(async (preferredMode?: 'native' | 'virtual') => {
    // If user explicitly asks for virtual mode, or native is not supported at all:
    if (preferredMode === 'virtual' || !isNativeSupported) {
      startVirtualScreen();
      return;
    }

    try {
      // Attempt native getDisplayMedia
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
        } as any,
        audio: shareSystemAudio,
      });

      setStream(mediaStream);
      setScreenMode('native');

      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          mediaStream.getTracks().forEach(track => track.stop());
          setStream(null);
          setScreenMode(null);
        };
      }
    } catch (err: any) {
      console.warn("Native screen capture failed or was disallowed:", err);

      // Check if error is due to permissions policy / iframe sandbox / lack of support
      const errorMsg = (err?.message || '').toLowerCase();
      const isPolicyDisallowed = 
        errorMsg.includes('permissions policy') || 
        errorMsg.includes('disallowed') || 
        errorMsg.includes('permission denied by system') ||
        err?.name === 'SecurityError';

      if (isPolicyDisallowed || !isNativeSupported) {
        // Automatically fallback to virtual screen mode without throwing
        console.info("Falling back to Virtual Screen Mode due to environment restrictions.");
        startVirtualScreen();
        return;
      }

      // If user deliberately cancelled the prompt in native mode
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        throw new Error("PERMISSION_DENIED");
      }

      // If any other unexpected error occurs, fall back to virtual screen rather than breaking
      console.info("Falling back to Virtual Screen Mode on error:", err);
      startVirtualScreen();
    }
  }, [isNativeSupported, shareSystemAudio, startVirtualScreen]);

  const stopScreenCapture = useCallback(() => {
    if (animIntervalRef.current) {
      clearInterval(animIntervalRef.current);
      animIntervalRef.current = null;
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    setScreenMode(null);
  }, [stream]);

  // Set a custom screenshot image from file or clipboard paste
  const setCustomImage = useCallback((dataUrl: string) => {
    setCustomImageDataUrl(dataUrl);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      customImgElementRef.current = img;
      redrawVirtualScreen();
    };
    img.src = dataUrl;

    if (screenMode !== 'virtual') {
      startVirtualScreen();
    }
  }, [redrawVirtualScreen, screenMode, startVirtualScreen]);

  // Switch demo screen
  const selectDemo = useCallback((demoId: string) => {
    setActiveDemo(demoId);
    customImgElementRef.current = null;
    setCustomImageDataUrl(null);

    const canvas = getVirtualCanvas();
    renderDemoScreen(canvas, demoId);

    if (screenMode !== 'virtual') {
      startVirtualScreen(demoId);
    }
  }, [getVirtualCanvas, screenMode, startVirtualScreen]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (animIntervalRef.current) {
        clearInterval(animIntervalRef.current);
      }
    };
  }, []);

  const captureFrame = useCallback(async (): Promise<string> => {
    // 1. If in virtual mode, capture directly from the virtual canvas (100% reliable, fast, zero async delay)
    if (screenMode === 'virtual' && virtualCanvasRef.current) {
      const dataUrl = virtualCanvasRef.current.toDataURL('image/jpeg', 0.85);
      return dataUrl.split(',')[1];
    }

    // 2. If in native mode with a stream, capture from video track
    return new Promise((resolve, reject) => {
      if (!stream) {
        // Fallback: If virtual canvas exists, return it
        if (virtualCanvasRef.current) {
          const dataUrl = virtualCanvasRef.current.toDataURL('image/jpeg', 0.85);
          return resolve(dataUrl.split(',')[1]);
        }
        return reject(new Error("A tela não está sendo compartilhada."));
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState === 'ended') {
        if (virtualCanvasRef.current) {
          const dataUrl = virtualCanvasRef.current.toDataURL('image/jpeg', 0.85);
          return resolve(dataUrl.split(',')[1]);
        }
        return reject(new Error("O compartilhamento de tela foi encerrado."));
      }

      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;

      const timeout = setTimeout(() => {
        video.srcObject = null;
        video.remove();
        if (virtualCanvasRef.current) {
          const dataUrl = virtualCanvasRef.current.toDataURL('image/jpeg', 0.85);
          resolve(dataUrl.split(',')[1]);
        } else {
          reject(new Error("Tempo esgotado ao capturar imagem da tela."));
        }
      }, 3000);

      video.onloadedmetadata = () => {
        video.play().catch(e => {
          clearTimeout(timeout);
          if (virtualCanvasRef.current) {
            const dataUrl = virtualCanvasRef.current.toDataURL('image/jpeg', 0.85);
            return resolve(dataUrl.split(',')[1]);
          }
          reject(new Error(`Erro ao reproduzir vídeo: ${e}`));
        });
      };

      video.onplay = () => {
        clearTimeout(timeout);
        const canvas = document.createElement('canvas');
        const settings = videoTrack.getSettings();
        canvas.width = settings.width || 1280;
        canvas.height = settings.height || 720;
        const context = canvas.getContext('2d');
        if (!context) {
          video.srcObject = null;
          video.remove();
          return reject(new Error('Erro ao obter contexto do canvas.'));
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        video.pause();
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        video.srcObject = null;
        video.remove();
        resolve(dataUrl.split(',')[1]);
      };

      video.onerror = (e) => {
        clearTimeout(timeout);
        if (virtualCanvasRef.current) {
          const dataUrl = virtualCanvasRef.current.toDataURL('image/jpeg', 0.85);
          return resolve(dataUrl.split(',')[1]);
        }
        reject(new Error(`Erro no elemento de vídeo: ${e}`));
      };
    });
  }, [screenMode, stream]);

  return {
    stream,
    isSharing,
    screenMode,
    isNativeSupported,
    activeDemo,
    customImageDataUrl,
    virtualCanvasRef,
    startScreenCapture,
    stopScreenCapture,
    setCustomImage,
    selectDemo,
    captureFrame,
  };
};