import { useState, useRef, useCallback } from 'react';
import { VisualGuide } from '../types';
import { drawGuidesOnCanvas } from '../utils/canvasGuideRenderer';

export type CaptureType = 'screen' | 'camera' | 'screenshot' | null;

interface UseScreenCaptureProps {
  shareSystemAudio: boolean;
}

export const useScreenCapture = ({ shareSystemAudio }: UseScreenCaptureProps) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [captureType, setCaptureType] = useState<CaptureType>(null);
  const customCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const isSharing = !!stream || !!screenshotDataUrl;

  const isMobile =
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

  const isNativeDisplaySupported =
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === 'function';

  // Screen capture (works on both Computer and modern Android Chrome)
  const startScreenCapture = useCallback(
    async (mode: 'screen' | 'camera' = 'screen') => {
      // Clear any prior stream/screenshot
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
      setScreenshotDataUrl(null);

      if (mode === 'camera') {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Câmera não suportada neste navegador.");
        }

        let cameraStream: MediaStream;
        try {
          // Try rear/environment camera first
          cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false,
          });
        } catch (err1) {
          try {
            // Fallback to any available camera
            cameraStream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          } catch (err2: any) {
            if (err2?.name === 'NotAllowedError' || (err2?.message || '').includes('Permission denied')) {
              throw new Error("Acesso à câmera negado. Clique no ícone de permissão na barra do navegador para permitir.");
            }
            throw new Error(`Não foi possível acessar a câmera: ${err2?.message || 'Erro de hardware ou permissão'}`);
          }
        }

        setStream(cameraStream);
        setCaptureType('camera');

        cameraStream.getVideoTracks()[0]?.addEventListener('ended', () => {
          stopScreenCapture();
        });

        return cameraStream;
      }

      // Default: Screen / Display capture - identical to Google Meet and Zoom Web
      const getDisplayMedia =
        navigator.mediaDevices?.getDisplayMedia?.bind(navigator.mediaDevices) ||
        (navigator as any).getDisplayMedia?.bind(navigator);

      if (!getDisplayMedia) {
        throw new Error(
          "API getDisplayMedia não disponível no navegador. Atualize o navegador ou use o Google Chrome."
        );
      }

      let mediaStream: MediaStream;
      try {
        // Exactly like Google Meet / Zoom: on mobile, request pure video: true without audio constraints
        if (isMobile) {
          mediaStream = await getDisplayMedia({
            video: true,
          });
        } else {
          // On desktop, try with system audio if requested
          try {
            mediaStream = await getDisplayMedia({
              video: true,
              audio: shareSystemAudio,
            });
          } catch (audioErr: any) {
            if (audioErr?.name !== 'NotAllowedError') {
              console.warn("Retrying with video only (Google Meet standard)...", audioErr);
              mediaStream = await getDisplayMedia({
                video: true,
                audio: false,
              });
            } else {
              throw audioErr;
            }
          }
        }
      } catch (err: any) {
        const msg = (err?.message || '').toLowerCase();
        const inIframe = typeof window !== 'undefined' && window.self !== window.top;

        if (
          msg.includes('permissions policy') ||
          msg.includes('disallowed') ||
          (inIframe && err?.name === 'NotAllowedError')
        ) {
          throw new Error("IFRAME_PERMISSION_DENIED");
        }

        if (err?.name === 'NotAllowedError') {
          throw new Error("PERMISSION_DENIED");
        }

        if (err?.name === 'NotSupportedError') {
          throw new Error(
            "Captura de tela restrita neste navegador. Toque em 'Abrir em Nova Aba' para transmitir a tela inteira como no Google Meet."
          );
        }

        throw err;
      }

      setStream(mediaStream);
      setCaptureType('screen');

      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopScreenCapture();
        };
      }

      return mediaStream;
    },
    [isMobile, isNativeDisplaySupported, shareSystemAudio, stream]
  );

  const stopScreenCapture = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setScreenshotDataUrl(null);
    setCaptureType(null);
  }, [stream]);

  // Set real user screenshot (e.g. taken on mobile phone or computer)
  const setScreenshot = useCallback(
    (dataUrl: string) => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
      setScreenshotDataUrl(dataUrl);
      setCaptureType('screenshot');

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width || 1280;
        canvas.height = img.height || 720;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          customCanvasRef.current = canvas;
          try {
            if (typeof (canvas as any).captureStream === 'function') {
              const canvasStream = (canvas as any).captureStream(10);
              setStream(canvasStream);
            }
          } catch (e) {
            console.debug("Could not capture stream from canvas:", e);
          }
        }
      };
      img.src = dataUrl;
    },
    [stream]
  );

  const captureFrame = useCallback(async (overlayGuides?: VisualGuide[]): Promise<string> => {
    if (screenshotDataUrl) {
      if (!overlayGuides || overlayGuides.length === 0) {
        // Uploaded screenshots may be PNG or WebP. Normalize every frame to JPEG
        // because the backend sends imageBase64 to Gemini as image/jpeg.
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width || 1280;
            canvas.height = img.naturalHeight || img.height || 720;
            const context = canvas.getContext('2d');
            if (!context) return reject(new Error('Erro ao preparar a imagem.'));
            context.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
          };
          img.onerror = () => reject(new Error('Não foi possível ler a imagem enviada.'));
          img.src = screenshotDataUrl;
        });
      }
      // If there are overlay guides on a static screenshot, composite them
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width || 1280;
          canvas.height = img.height || 720;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            drawGuidesOnCanvas(ctx, overlayGuides, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            resolve(dataUrl.split(',')[1]);
          } else {
            resolve(screenshotDataUrl.split(',')[1]);
          }
        };
        img.onerror = () => resolve(screenshotDataUrl.split(',')[1]);
        img.src = screenshotDataUrl;
      });
    }

    if (!stream) {
      throw new Error("A tela ou câmera não está ativa.");
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack || videoTrack.readyState === 'ended') {
      throw new Error("O compartilhamento foi encerrado.");
    }

    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;

      const timeout = setTimeout(() => {
        video.srcObject = null;
        video.remove();
        reject(new Error("Tempo esgotado ao capturar imagem."));
      }, 3500);

      video.onloadedmetadata = () => {
        video.play().catch((e) => {
          clearTimeout(timeout);
          video.srcObject = null;
          video.remove();
          reject(new Error(`Erro ao reproduzir fluxo: ${e}`));
        });
      };

      video.onplay = () => {
        clearTimeout(timeout);
        const canvas = document.createElement('canvas');
        const settings = videoTrack.getSettings();
        canvas.width = video.videoWidth || settings.width || 1280;
        canvas.height = video.videoHeight || settings.height || 720;
        const context = canvas.getContext('2d');

        if (!context) {
          video.srcObject = null;
          video.remove();
          return reject(new Error('Erro ao obter contexto do canvas.'));
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Composite active visual guides if provided
        if (overlayGuides && overlayGuides.length > 0) {
          drawGuidesOnCanvas(context, overlayGuides, canvas.width, canvas.height);
        }

        video.pause();
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

        video.srcObject = null;
        video.remove();
        resolve(dataUrl.split(',')[1]);
      };

      video.onerror = (e) => {
        clearTimeout(timeout);
        video.srcObject = null;
        video.remove();
        reject(new Error(`Erro no elemento de vídeo: ${e}`));
      };
    });
  }, [screenshotDataUrl, stream]);

  return {
    stream,
    isSharing,
    isMobile,
    isNativeDisplaySupported,
    screenshotDataUrl,
    captureType,
    startScreenCapture,
    stopScreenCapture,
    setScreenshot,
    captureFrame,
  };
};