import { useState, useRef, useCallback, useEffect } from 'react';
// Fix: Removed `LiveSession` as it is not an exported member of `@google/genai`.
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { Message, Role } from '../types';
import { decode, decodeAudioData } from '../utils/audioUtils';
import { useAudioCues } from './useAudioCues';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

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
}

export const useLiveConversation = ({ isSharing, captureFrame, onError, micSensitivity, audioOutputDeviceId, voiceModel, systemAudioTrack, systemInstruction }: UseLiveConversationProps) => {
  const [isLive, setIsLive] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [liveMessages, setLiveMessages] = useState<Message[]>([]);

  // Fix: Replaced `LiveSession` with `ReturnType<typeof ai.live.connect>` to infer the session promise type correctly.
  const sessionPromiseRef = useRef<ReturnType<typeof ai.live.connect> | null>(null);
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
    
    sessionPromiseRef.current?.then(session => session.close()).catch(console.error);

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
            analyser.getByteFrequencyData(dataArray);
            const sum = dataArray.reduce((a, b) => a + b, 0);
            const avg = sum / dataArray.length;
            setMicVolume(Math.min(1, (avg / 128) * micSensitivity));
            animationFrameRef.current = requestAnimationFrame(visualize);
        };
        visualize();

        setIsLive(true);
        sessionPromiseRef.current = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
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
                        sessionPromiseRef.current?.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                    };
                    if (isSharing) {
                        frameIntervalRef.current = window.setInterval(async () => {
                            try {
                                const base64Data = await captureFrame();
                                sessionPromiseRef.current?.then(session => session.sendRealtimeInput({
                                    media: { data: base64Data, mimeType: 'image/jpeg' }
                                }));
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
                        playingSourcesRef.current.forEach(source => source.stop());
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
                onclose: () => {
                    cleanup();
                },
                onerror: (e) => {
                    console.error("Live session error:", e);
                    onError("Live session error. Please try again.");
                    cleanup();
                }
            }
        });

    } catch (e) {
      console.error("Failed to start live conversation:", e);
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
          onError("A permissão para usar o microfone foi negada. Por favor, permita o acesso ao microfone para usar a conversa por voz.");
      } else {
          onError("Não foi possível acessar o microfone.");
      }
      cleanup();
    }
  }, [isLive, playStartSound, cleanup, isSharing, captureFrame, onError, audioOutputDeviceId, micSensitivity, voiceModel, systemAudioTrack, systemInstruction]);

  const stopConversation = useCallback(() => {
    if (!isLive) return;
    playStopSound();
    cleanup();
  }, [isLive, playStopSound, cleanup]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isLive, startConversation, stopConversation, micVolume, liveMessages };
};