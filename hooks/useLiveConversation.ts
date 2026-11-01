import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { Message, Role } from '../types';
import { decode, decodeAudioData } from '../utils/audioUtils';
import { useAudioCues } from './useAudioCues';

const getApiKey = () => process.env.API_KEY || process.env.GEMINI_API_KEY || '';

function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const FRAME_RATE = 1; // 1 frame per second
const JPEG_QUALITY = 0.8;

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
}

export const useLiveConversation = ({ isSharing, captureFrame, onError, micSensitivity, audioOutputDeviceId, voiceModel, systemAudioTrack, systemInstruction, onApiKeyError }: UseLiveConversationProps) => {
  const [isLive, setIsLive] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [liveMessages, setLiveMessages] = useState<Message[]>([]);

  const sessionPromiseRef = useRef<Promise<any> | null>(null);
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
        outputAudioContextRef.current.close();
      }
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ 
        sampleRate: 24000,
        sinkId: audioOutputDeviceId,
      });
      nextAudioStartTime.current = 0; // Reset start time on device change
    }
  }, [audioOutputDeviceId, isLive]);

  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
    }
    
    scriptProcessorRef.current?.disconnect();
    sourceNodeRef.current?.disconnect();
    analyserRef.current?.disconnect();

    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    
    playingSourcesRef.current.forEach(source => source.stop());
    playingSourcesRef.current.clear();
    
    if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close();
    }
    if (outputAudioContextRef.current?.state !== 'closed') {
        outputAudioContextRef.current?.close();
    }
    
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(session => {
        try {
          session.close();
        } catch (e) {
          console.debug('Session already closed or error closing:', e);
        }
      }).catch(() => {});
    }

    setIsLive(false);
    setMicVolume(0);
    sessionPromiseRef.current = null;
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

        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ 
            sampleRate: 24000,
            sinkId: audioOutputDeviceId 
        });
        
        let inputStream: MediaStream = micStream;

        // If system audio is available, mix it with the microphone audio
        if (systemAudioTrack) {
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

        // Mute the microphone input to prevent feedback
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

        const apiKey = getApiKey();
        if (!apiKey) {
            onApiKeyError();
            cleanup();
            return;
        }

        const ai = new GoogleGenAI({ apiKey });

        const sessionPromise = ai.live.connect({
            // Updated to the latest stable preview version to fix backend cancellation issues
            model: 'gemini-2.5-flash-native-audio-preview-12-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                systemInstruction: systemInstruction,
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceModel } },
                },
            },
            callbacks: {
                onopen: () => {
                    scriptProcessor.onaudioprocess = (event) => {
                        const inputData = event.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        sessionPromise.then(session => {
                          if (session) session.sendRealtimeInput({ media: pcmBlob });
                        }).catch(() => {});
                    };
                    if (isSharing) {
                        frameIntervalRef.current = window.setInterval(async () => {
                            try {
                                const base64Data = await captureFrame();
                                sessionPromise.then(session => {
                                  if (session) session.sendRealtimeInput({
                                    media: { data: base64Data, mimeType: 'image/jpeg' }
                                  });
                                }).catch(() => {});
                            } catch (error) {
                                console.error("Could not send frame:", error);
                            }
                        }, 1000 / FRAME_RATE);
                    }
                },
                onmessage: async (message: LiveServerMessage) => {
                    if (message.serverContent?.inputTranscription) {
                        const text = message.serverContent.inputTranscription.text;
                        currentInputRef.current += text;
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
                    if (message.serverContent?.outputTranscription) {
                        const text = message.serverContent.outputTranscription.text;
                        currentOutputRef.current += text;
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
                    
                    const interrupted = message.serverContent?.interrupted;
                    if (interrupted) {
                        playingSourcesRef.current.forEach(source => {
                          try { source.stop(); } catch(e) {}
                        });
                        playingSourcesRef.current.clear();
                        nextAudioStartTime.current = 0;
                    }

                    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (base64Audio && outputAudioContextRef.current) {
                         if (outputAudioContextRef.current.state === 'suspended') {
                            await outputAudioContextRef.current.resume();
                        }
                        const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
                        
                        const startTime = Math.max(nextAudioStartTime.current, outputAudioContextRef.current.currentTime);
                        
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

                    if (message.serverContent?.turnComplete) {
                        currentInputRef.current = '';
                        currentOutputRef.current = '';
                    }
                },
                onclose: (e) => {
                    console.debug('Live session closed:', e);
                    cleanup();
                },
                onerror: (e) => {
                    console.error("Live session error event:", e);
                    const error = (e as any).error || e;
                    const errorMessage = error.message || 'An unknown network error occurred.';
                    
                    if (errorMessage.includes("Requested entity was not found.") || errorMessage.includes("API key not valid")) {
                        onApiKeyError();
                    } else if (errorMessage.includes("Thread was cancelled")) {
                        onError("Conexão interrompida pelo servidor. Tente novamente em instantes.");
                    } else {
                        onError(`Erro na sessão ao vivo: ${errorMessage}`);
                    }
                    cleanup();
                }
            }
        });

        sessionPromiseRef.current = sessionPromise;

        sessionPromise.catch((e: Error) => {
            const errorMessage = e.message || 'An unknown connection error occurred.';
            console.error("Live session connection failed:", e);
            if (errorMessage.includes("Requested entity was not found.") || errorMessage.includes("API key not valid")) {
                onApiKeyError();
            } else {
                onError(`Falha ao conectar à sessão ao vivo: ${errorMessage}`);
            }
            cleanup();
        });

    } catch (e) {
      console.error("Failed to start live conversation:", e);
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
          onError("A permissão para usar o microfone foi negada. Por favor, permita o acesso ao microfone para usar a conversa por voz.");
      } else {
          onError("Não foi possível acessar o microfone ou configurar o áudio.");
      }
      cleanup();
    }
  }, [isLive, playStartSound, cleanup, isSharing, captureFrame, onError, audioOutputDeviceId, micSensitivity, voiceModel, systemAudioTrack, systemInstruction, onApiKeyError]);

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