import { useState, useRef, useCallback } from 'react';

interface UseScreenCaptureProps {
  shareSystemAudio: boolean;
}

export const useScreenCapture = ({ shareSystemAudio }: UseScreenCaptureProps) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const isSharing = !!stream;

  const startScreenCapture = useCallback(async () => {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
      const errorMessage = "A funcionalidade de captura de tela não é suportada neste navegador ou o aplicativo não está sendo executado em um contexto seguro (HTTPS).";
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as MediaTrackConstraints,
        audio: shareSystemAudio,
      });
      setStream(mediaStream);

      // Listen for the 'ended' event on the video track to stop sharing
      mediaStream.getVideoTracks()[0].onended = () => {
        // Ensure all tracks are stopped
        mediaStream.getTracks().forEach(track => track.stop());
        setStream(null);
      };

    } catch (err) {
      console.error("Error starting screen capture:", err);
      setStream(null);
      // Re-throw the error so the caller component can handle it
      throw err;
    }
  }, [shareSystemAudio]);

  const stopScreenCapture = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const captureFrame = useCallback(async (): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!stream) {
            return reject(new Error("Screen is not being shared."));
        }
    
        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack) {
            return reject(new Error("No video track found in the stream."));
        }

        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;

        video.onloadedmetadata = () => {
            video.play().catch(e => reject(new Error(`Video play error: ${e}`)));
        };

        video.onplay = () => {
            const canvas = document.createElement('canvas');
            const settings = videoTrack.getSettings();
            canvas.width = settings.width || 1280;
            canvas.height = settings.height || 720;
            const context = canvas.getContext('2d');
            if (!context) {
                return reject(new Error('Failed to get canvas context.'));
            }
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            video.pause();
            
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            resolve(dataUrl.split(',')[1]); // Return only the base64 part
        };

        video.onerror = (e) => {
            reject(new Error(`Video element error: ${e}`));
        };
    });
  }, [stream]);


  return { stream, isSharing, startScreenCapture, stopScreenCapture, captureFrame };
};