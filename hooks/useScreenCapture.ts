import { useState, useCallback, useRef } from 'react';

export type VisualSourceType = 'screen' | 'camera' | 'image' | null;

interface UseScreenCaptureProps {
  shareSystemAudio: boolean;
}

export const useScreenCapture = ({ shareSystemAudio }: UseScreenCaptureProps) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [sourceType, setSourceType] = useState<VisualSourceType>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [customImage, setCustomImage] = useState<string | null>(null);

  const isSharing = !!stream || !!customImage;

  const isScreenSupported = typeof navigator !== 'undefined' && 
    !!navigator.mediaDevices && 
    typeof navigator.mediaDevices.getDisplayMedia === 'function';

  const isCameraSupported = typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function';

  const stopScreenCapture = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => {
        try { track.stop(); } catch {}
      });
      setStream(null);
    }
    setCustomImage(null);
    setSourceType(null);
  }, [stream]);

  // Screen Sharing (Desktop & supported Android browsers)
  const startScreenCapture = useCallback(async () => {
    if (!isScreenSupported) {
      const errorMessage = "Compartilhamento de tela não é suportado pelo seu navegador neste dispositivo (no iOS e em navegadores mobile use a Câmera como no Google Meet).";
      console.warn(errorMessage);
      throw new Error(errorMessage);
    }

    // Stop existing stream if any
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }

    let mediaStream: MediaStream | null = null;

    try {
      const displayMediaOptions: DisplayMediaStreamOptions = {
        video: true,
        ...(shareSystemAudio ? { audio: true } : { audio: false }),
      };
      mediaStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
    } catch (err: any) {
      if (err instanceof DOMException && (err.name === 'NotSupportedError' || err.name === 'TypeError') && shareSystemAudio) {
        console.warn("Retrying getDisplayMedia without system audio...");
        try {
          mediaStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        } catch (retryErr) {
          throw retryErr;
        }
      } else {
        if (err instanceof DOMException) {
          if (err.name === 'NotAllowedError') {
            if (err.message && err.message.toLowerCase().includes('permissions policy')) {
              throw new Error("A permissão para captura de tela está restrita pelo navegador neste contexto.");
            }
            throw new Error("PERMISSION_DENIED");
          } else if (err.name === 'NotFoundError') {
            throw new Error("Nenhuma tela encontrada para compartilhar.");
          } else if (err.name === 'AbortError') {
            throw new Error("PERMISSION_DENIED");
          }
        }
        throw err;
      }
    }

    if (mediaStream) {
      setStream(mediaStream);
      setCustomImage(null);
      setSourceType('screen');

      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          mediaStream?.getTracks().forEach(track => {
            try { track.stop(); } catch {}
          });
          setStream(null);
          setSourceType(null);
        };
      }
    }
  }, [isScreenSupported, shareSystemAudio, stream]);

  // Camera Capture (Works universally on all Mobile Phones & Desktops, just like Google Meet)
  const startCameraCapture = useCallback(async (desiredFacing: 'environment' | 'user' = facingMode) => {
    if (!isCameraSupported) {
      throw new Error("Acesso à câmera não é suportado pelo navegador neste ambiente.");
    }

    // Stop existing stream if any
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: desiredFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const camStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(camStream);
      setCustomImage(null);
      setSourceType('camera');
      setFacingMode(desiredFacing);

      const videoTrack = camStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          camStream?.getTracks().forEach(track => {
            try { track.stop(); } catch {}
          });
          setStream(null);
          setSourceType(null);
        };
      }
    } catch (err: any) {
      console.error("Camera access failed:", err);
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        throw new Error("Permissão para câmera foi negada. Permita o acesso à câmera para usar no celular.");
      }
      throw new Error("Não foi possível acessar a câmera do dispositivo.");
    }
  }, [facingMode, isCameraSupported, stream]);

  // Toggle front and back camera (for mobile users)
  const toggleCameraFacing = useCallback(async () => {
    if (sourceType !== 'camera') return;
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    await startCameraCapture(nextFacing);
  }, [facingMode, sourceType, startCameraCapture]);

  // Upload an image or photo directly
  const uploadImage = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        return reject(new Error("Selecione um arquivo de imagem válido."));
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        if (stream) {
          stream.getTracks().forEach(t => t.stop());
          setStream(null);
        }
        setCustomImage(result);
        setSourceType('image');
        resolve(base64);
      };
      reader.onerror = () => reject(new Error("Falha ao ler o arquivo de imagem."));
      reader.readAsDataURL(file);
    });
  }, [stream]);

  const captureFrame = useCallback(async (): Promise<string> => {
    if (customImage) {
      return customImage.split(',')[1];
    }

    return new Promise((resolve, reject) => {
      if (!stream) {
        return reject(new Error("Nenhum vídeo ou tela ativa."));
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState === 'ended') {
        return reject(new Error("A transmissão foi encerrada."));
      }

      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;

      const cleanup = () => {
        video.srcObject = null;
        video.remove();
      };

      video.onloadedmetadata = () => {
        video.play().catch(e => {
          cleanup();
          reject(new Error(`Erro ao reproduzir vídeo: ${e}`));
        });
      };

      video.onplay = () => {
        try {
          const canvas = document.createElement('canvas');
          const settings = videoTrack.getSettings();
          canvas.width = settings.width || video.videoWidth || 1280;
          canvas.height = settings.height || video.videoHeight || 720;
          const context = canvas.getContext('2d');
          if (!context) {
            cleanup();
            return reject(new Error('Erro ao obter contexto do canvas.'));
          }
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          video.pause();

          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          cleanup();
          resolve(dataUrl.split(',')[1]);
        } catch (canvasErr) {
          cleanup();
          reject(canvasErr);
        }
      };

      video.onerror = (e) => {
        cleanup();
        reject(new Error(`Erro no elemento de vídeo: ${e}`));
      };
    });
  }, [customImage, stream]);

  return {
    stream,
    isSharing,
    sourceType,
    facingMode,
    customImage,
    isScreenSupported,
    isCameraSupported,
    startScreenCapture,
    startCameraCapture,
    toggleCameraFacing,
    stopScreenCapture,
    uploadImage,
    captureFrame,
  };
};