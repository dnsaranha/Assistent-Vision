import { useState, useRef, useCallback, useEffect } from 'react';
import { Message, Role } from '../types';
import { decode, decodeAudioData } from '../utils/audioUtils';
import { mergeTranscript, removeStuttersAndDuplicates } from '../utils/transcriptUtils';
import { useAudioCues } from './useAudioCues';

function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): { data: string; mimeType: string } {
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
}: UseLiveConversationProps) => {
  const [isLive, setIsLive] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [liveMessages, setLiveMessages] = useState<Message[]>([]);

  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const playingSourcesRef = useRef(new Set<AudioBufferSourceNode>());

  const micVolumeRef = useRef(0);
  const currentInputRef = useRef('');
  const currentOutputRef = useRef('');
  const activeTurnRoleRef = useRef<Role | null>(null);
  const nextAudioStartTime = useRef(0);

  const { playStartSound, playStopSound } = useAudioCues();

  useEffect(() => {
    if (isLive) {
      if (outputAudioContextRef.current) {
        outputAudioContextRef.current.close();
      }
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
        sinkId: audioOutputDeviceId,
      });
      nextAudioStartTime.current = 0;
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

    scriptProcessorRef.current?.disconnect();
    sourceNodeRef.current?.disconnect();
    analyserRef.current?.disconnect();

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());

    playingSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch (e) {}
    });
    playingSourcesRef.current.clear();

    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close();
    }
    if (outputAudioContextRef.current?.state !== 'closed') {
      outputAudioContextRef.current?.close();
    }

    if (socketRef.current) {
      if (socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'stop' }));
        socketRef.current.close();
      }
      socketRef.current = null;
    }

    setIsLive(false);
    setMicVolume(0);
    micVolumeRef.current = 0;
    activeTurnRoleRef.current = null;
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
    activeTurnRoleRef.current = null;
    nextAudioStartTime.current = 0;

    try {
      // Use full acoustic echo cancellation, noise suppression, and auto gain
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000,
        },
      });
      mediaStreamRef.current = micStream;

      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
        sinkId: audioOutputDeviceId,
      });

      let inputStream: MediaStream = micStream;

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
        const vol = Math.min(1, (avg / 128) * micSensitivity);
        micVolumeRef.current = vol;
        setMicVolume(vol);
        animationFrameRef.current = requestAnimationFrame(visualize);
      };
      visualize();

      setIsLive(true);

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live-ws`;
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = async () => {
        try {
          const user = (await import('../firebase')).auth.currentUser;
          if (!user) throw new Error('Entre na sua conta para iniciar a conversa ao vivo.');
          socket.send(JSON.stringify({ type: 'authenticate', token: await user.getIdToken() }));
        } catch (error: any) {
          onError(error?.message || 'Falha na autenticação da sessão ao vivo.');
          cleanup();
        }
      };

      socket.onmessage = async (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'authenticated') {
            socket.send(
              JSON.stringify({
                type: 'start',
            systemInstruction,
            voiceModel,
            model: 'gemini-2.5-flash-native-audio-preview-12-2025',
          })
        );
      };

          } else if (payload.type === 'session_open') {
            // Audio streaming from microphone to server
            scriptProcessor.onaudioprocess = (audioEvt) => {
              if (socket.readyState === WebSocket.OPEN) {
                // If model is speaking through speakers, prevent microphone loopback
                // unless user speaks loudly (interruption threshold >= 0.22)
                const isModelSpeaking = playingSourcesRef.current.size > 0;
                if (isModelSpeaking && micVolumeRef.current < 0.22) {
                  return; // Don't stream phone/computer speaker audio back to Gemini
                }

                // If user speaks loud enough while model is speaking, stop playback locally for barge-in
                if (isModelSpeaking && micVolumeRef.current >= 0.22) {
                  playingSourcesRef.current.forEach((src) => {
                    try { src.stop(); } catch (e) {}
                  });
                  playingSourcesRef.current.clear();
                  nextAudioStartTime.current = 0;
                }

                const inputData = audioEvt.inputBuffer.getChannelData(0);
                const pcmBlob = createBlob(inputData);
                socket.send(
                  JSON.stringify({
                    type: 'realtime_input',
                    input: { media: pcmBlob },
                  })
                );
              }
            };

            // Screen/Camera frame streaming to server
            if (isSharing) {
              frameIntervalRef.current = window.setInterval(async () => {
                if (socket.readyState === WebSocket.OPEN) {
                  try {
                    const base64Data = await captureFrame();
                    socket.send(
                      JSON.stringify({
                        type: 'realtime_input',
                        input: {
                          media: { data: base64Data, mimeType: 'image/jpeg' },
                        },
                      })
                    );
                  } catch (err) {
                    console.debug("Frame capture skipped:", err);
                  }
                }
              }, 1000 / FRAME_RATE);
            }
          } else if (payload.type === 'server_message') {
            const message = payload.message;

            // Handle User speech transcription
            if (message.serverContent?.inputTranscription) {
              const rawText = message.serverContent.inputTranscription.text;

              // If previous active turn was ASSISTANT, this is a BRAND NEW user turn:
              if (activeTurnRoleRef.current === Role.ASSISTANT) {
                currentInputRef.current = '';
                currentOutputRef.current = '';
              }
              activeTurnRoleRef.current = Role.USER;

              currentInputRef.current = mergeTranscript(currentInputRef.current, rawText);
              const finalText = removeStuttersAndDuplicates(currentInputRef.current);

              if (finalText) {
                setLiveMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === Role.USER) {
                    const next = [...prev];
                    next[next.length - 1] = { ...last, text: finalText };
                    return next;
                  }
                  return [...prev, { role: Role.USER, text: finalText }];
                });
              }
            }

            // Handle Assistant speech transcription
            if (message.serverContent?.outputTranscription) {
              const rawText = message.serverContent.outputTranscription.text;

              // If previous active turn was USER, this is a BRAND NEW assistant turn:
              if (activeTurnRoleRef.current === Role.USER) {
                currentOutputRef.current = '';
              }
              activeTurnRoleRef.current = Role.ASSISTANT;

              currentOutputRef.current = mergeTranscript(currentOutputRef.current, rawText);
              const finalText = removeStuttersAndDuplicates(currentOutputRef.current);

              if (finalText) {
                setLiveMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === Role.ASSISTANT) {
                    const next = [...prev];
                    next[next.length - 1] = { ...last, text: finalText };
                    return next;
                  }
                  return [...prev, { role: Role.ASSISTANT, text: finalText }];
                });
              }
            }

            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
              playingSourcesRef.current.forEach((src) => {
                try { src.stop(); } catch (e) {}
              });
              playingSourcesRef.current.clear();
              nextAudioStartTime.current = 0;
            }

            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              if (outputAudioContextRef.current.state === 'suspended') {
                await outputAudioContextRef.current.resume();
              }
              const audioBuffer = await decodeAudioData(
                decode(base64Audio),
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

            if (message.serverContent?.turnComplete) {
              currentInputRef.current = '';
              currentOutputRef.current = '';
            }
          } else if (payload.type === 'session_error') {
            if (payload.error === 'API_KEY_NOT_FOUND') {
              onApiKeyError();
            } else {
              onError(`Erro na sessão ao vivo: ${payload.error || 'Erro no servidor'}`);
            }
            cleanup();
          } else if (payload.type === 'session_close') {
            cleanup();
          }
        } catch (e) {
          console.error("Error processing server message:", e);
        }
      };

      socket.onerror = (e) => {
        console.error("WebSocket connection error:", e);
        onError("Não foi possível conectar ao servidor para a conversa em tempo real.");
        cleanup();
      };

      socket.onclose = () => {
        cleanup();
      };
    } catch (err: any) {
      console.error("Error starting live conversation:", err);
      if (err?.name === 'NotAllowedError' || (err?.message || '').toLowerCase().includes('permission')) {
        onError("Permissão de microfone negada. Permita o acesso ao microfone no navegador para conversar com o Vision.");
      } else {
        onError(err?.message || "Erro ao iniciar microfone para a conversa ao vivo.");
      }
      cleanup();
    }
  }, [
    isLive,
    playStartSound,
    audioOutputDeviceId,
    systemAudioTrack,
    micSensitivity,
    systemInstruction,
    voiceModel,
    isSharing,
    captureFrame,
    cleanup,
    onApiKeyError,
    onError,
  ]);

  const stopConversation = useCallback(() => {
    playStopSound();
    cleanup();
  }, [playStopSound, cleanup]);

  return {
    isLive,
    startConversation,
    stopConversation,
    liveMessages,
    micVolume,
  };
};