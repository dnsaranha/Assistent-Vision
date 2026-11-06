import { useState, useRef, useCallback, useEffect } from 'react';
import { Message, Role, VisualGuide } from '../types';
import { decode, decodeAudioData } from '../utils/audioUtils';
import { useAudioCues } from './useAudioCues';

function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createPcmBase64(data: Float32Array): string {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return encode(new Uint8Array(int16.buffer));
}

const FRAME_RATE = 1; // 1 frame per second for Live API video

interface UseLiveConversationProps {
  isSharing: boolean;
  captureFrame: () => Promise<string>;
  onError: (error: string) => void;
  micSensitivity: number;
  audioOutputDeviceId: string;
  voiceModel: string;
  systemAudioTrack?: MediaStreamTrack;
  systemInstruction: string;
  onApiKeyError: () => void;
  onVisualGuides?: (guides: VisualGuide[]) => void;
}

export const useLiveConversation = ({
  isSharing,
  captureFrame,
  onError,
  micSensitivity,
  audioOutputDeviceId,
  voiceModel,
  systemAudioTrack,
  systemInstruction,
  onApiKeyError,
  onVisualGuides,
}: UseLiveConversationProps) => {
  const [isLive, setIsLive] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [liveMessages, setLiveMessages] = useState<Message[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const playingSourcesRef = useRef(new Set<AudioBufferSourceNode>());

  const currentInputRef = useRef('');
  const currentOutputRef = useRef('');
  const nextAudioStartTime = useRef(0);

  const { playStartSound, playStopSound } = useAudioCues();

  useEffect(() => {
    // Re-create output audio context if the device ID changes
    if (isLive) {
      if (outputAudioContextRef.current) {
        outputAudioContextRef.current.close().catch(() => {});
      }
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const newCtx = new AudioCtx({
          sampleRate: 24000,
        });
        if (audioOutputDeviceId && audioOutputDeviceId !== 'default' && (newCtx as any).setSinkId) {
          (newCtx as any).setSinkId(audioOutputDeviceId).catch(() => {});
        }
        outputAudioContextRef.current = newCtx;
        nextAudioStartTime.current = 0;
      } catch (err) {
        console.warn("Could not reconfigure audio output device:", err);
      }
    }
  }, [audioOutputDeviceId, isLive]);

  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    try {
      scriptProcessorRef.current?.disconnect();
      sourceNodeRef.current?.disconnect();
      analyserRef.current?.disconnect();
    } catch {}

    mediaStreamRef.current?.getTracks().forEach(track => {
      try { track.stop(); } catch {}
    });

    playingSourcesRef.current.forEach(source => {
      try { source.stop(); } catch {}
    });
    playingSourcesRef.current.clear();

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
      outputAudioContextRef.current.close().catch(() => {});
    }

    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close();
        }
      } catch {}
      wsRef.current = null;
    }

    setIsLive(false);
    setMicVolume(0);
    audioContextRef.current = null;
    outputAudioContextRef.current = null;
    mediaStreamRef.current = null;
  }, []);

  const startConversation = useCallback(async () => {
    if (isLive) return;
    playStartSound();
    setLiveMessages([]);
    currentInputRef.current = '';
    currentOutputRef.current = '';
    nextAudioStartTime.current = 0;

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = micStream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioCtx({ sampleRate: 16000 });
      outputAudioContextRef.current = new AudioCtx({ sampleRate: 24000 });

      if (audioOutputDeviceId && audioOutputDeviceId !== 'default' && (outputAudioContextRef.current as any).setSinkId) {
        (outputAudioContextRef.current as any).setSinkId(audioOutputDeviceId).catch(() => {});
      }

      let inputStream: MediaStream = micStream;

      // If system audio is available, mix it with microphone audio
      if (systemAudioTrack && systemAudioTrack.readyState === 'live') {
        const micSource = audioContextRef.current.createMediaStreamSource(micStream);
        const systemAudioStream = new MediaStream([systemAudioTrack]);
        const systemAudioSource = audioContextRef.current.createMediaStreamSource(systemAudioStream);
        const destination = audioContextRef.current.createMediaStreamDestination();

        micSource.connect(destination);
        systemAudioSource.connect(destination);

        inputStream = destination.stream;
      }

      const source = audioContextRef.current.createMediaStreamSource(inputStream);
      sourceNodeRef.current = source;
      const scriptProcessor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = scriptProcessor;

      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 512;
      analyserRef.current = analyser;

      // Mute local microphone input in speakers to prevent feedback loop
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.setValueAtTime(0, audioContextRef.current.currentTime);
      gainNode.connect(audioContextRef.current.destination);

      source.connect(analyser);
      analyser.connect(scriptProcessor);
      scriptProcessor.connect(gainNode);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const visualize = () => {
        if (!analyserRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const avg = sum / dataArray.length;
        setMicVolume(Math.min(1, (avg / 128) * micSensitivity));
        animationFrameRef.current = requestAnimationFrame(visualize);
      };
      visualize();

      setIsLive(true);

      // Connect to server-side Live API WebSocket endpoint
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live?voice=${encodeURIComponent(voiceModel)}&systemInstruction=${encodeURIComponent(systemInstruction)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Stream audio from mic to server
        scriptProcessor.onaudioprocess = (event) => {
          const inputData = event.inputBuffer.getChannelData(0);
          const pcmBase64 = createPcmBase64(inputData);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ audio: pcmBase64 }));
          }
        };

        // Stream screen video frames to server if sharing
        if (isSharing) {
          frameIntervalRef.current = window.setInterval(async () => {
            try {
              const base64Data = await captureFrame();
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ video: base64Data }));
              }
            } catch (error) {
              console.debug("Could not capture or send frame:", error);
            }
          }, 1000 / FRAME_RATE);
        }
      };

      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.error) {
            console.error("Live session server error:", message.error);
            const errorMessage = message.error;
            if (errorMessage.includes("API key") || errorMessage.includes("Requested entity was not found")) {
              onApiKeyError();
            } else {
              onError(`Erro na sessão ao vivo: ${errorMessage}`);
            }
            cleanup();
            return;
          }

          if (message.inputTranscript) {
            currentInputRef.current += message.inputTranscript;
            setLiveMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === Role.USER) {
                const next = [...prev];
                next[next.length - 1] = { ...last, text: currentInputRef.current };
                return next;
              }
              return [...prev, { role: Role.USER, text: currentInputRef.current }];
            });
          }

          if (message.outputTranscript) {
            currentOutputRef.current += message.outputTranscript;
            setLiveMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === Role.ASSISTANT) {
                const next = [...prev];
                next[next.length - 1] = { ...last, text: currentOutputRef.current };
                return next;
              }
              return [...prev, { role: Role.ASSISTANT, text: currentOutputRef.current }];
            });
          }

          if (message.interrupted) {
            playingSourcesRef.current.forEach(src => {
              try { src.stop(); } catch {}
            });
            playingSourcesRef.current.clear();
            nextAudioStartTime.current = 0;
          }

          if (message.audio && outputAudioContextRef.current) {
            if (outputAudioContextRef.current.state === 'suspended') {
              await outputAudioContextRef.current.resume();
            }
            const audioBuffer = await decodeAudioData(
              decode(message.audio),
              outputAudioContextRef.current,
              24000,
              1
            );

            const startTime = Math.max(
              nextAudioStartTime.current,
              outputAudioContextRef.current.currentTime
            );

            const sourceNode = outputAudioContextRef.current.createBufferSource();
            sourceNode.buffer = audioBuffer;
            sourceNode.connect(outputAudioContextRef.current.destination);

            sourceNode.addEventListener('ended', () => {
              playingSourcesRef.current.delete(sourceNode);
            });
            playingSourcesRef.current.add(sourceNode);

            sourceNode.start(startTime);
            nextAudioStartTime.current = startTime + audioBuffer.duration;
          }

          if (message.turnComplete) {
            currentInputRef.current = '';
            currentOutputRef.current = '';
          }

          if (message.visualGuides) {
            onVisualGuides?.(message.visualGuides);
          }
        } catch (err) {
          console.error("Error handling Live message:", err);
        }
      };

      ws.onerror = (e) => {
        console.error("WebSocket error in live session:", e);
        onError("Erro de conexão na sessão ao vivo.");
        cleanup();
      };

      ws.onclose = () => {
        console.debug("Live WebSocket closed");
        cleanup();
      };

    } catch (e) {
      console.error("Failed to start live conversation:", e);
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        onError("A permissão para usar o microfone foi negada. Por favor, permita o acesso ao microfone para usar a conversa por voz.");
      } else {
        onError("Não foi possível acessar o microfone ou configurar o áudio.");
      }
      cleanup();
    }
  }, [
    isLive,
    playStartSound,
    cleanup,
    isSharing,
    captureFrame,
    onError,
    audioOutputDeviceId,
    micSensitivity,
    voiceModel,
    systemAudioTrack,
    systemInstruction,
    onApiKeyError,
    onVisualGuides,
  ]);

  const stopConversation = useCallback(() => {
    if (!isLive) return;
    playStopSound();
    cleanup();
  }, [isLive, playStopSound, cleanup]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return { isLive, startConversation, stopConversation, micVolume, liveMessages };
};