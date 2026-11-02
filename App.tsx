import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Message, Role, Annotation, VisualGuide } from './types';
import { askAboutScreen, generateSummary } from './services/geminiService';
import { useScreenCapture } from './hooks/useScreenCapture';
import { useLiveConversation } from './hooks/useLiveConversation';
import { useAuth } from './hooks/useAuth';
import { ConversationView } from './components/ConversationView';
import { Controls } from './components/Controls';
import { ScreenPreview } from './components/ScreenPreview';
import { SettingsModal, Settings } from './components/SettingsModal';
import { LoginGate } from './components/LoginGate';
import { Header } from './components/Header';
import { AdBanner } from './components/AdBanner';
import { MicPermissionModal } from './components/MicPermissionModal';

const DEFAULT_SYSTEM_INSTRUCTION =
  "Você é o Vision, um assistente de IA especialista em produtividade e orientação visual interativa na tela. Suas capacidades principais são:\n1. Orientação Visual na Tela com Desenhos: Quando o usuário pedir ajuda para encontrar botões, campos, opções ou realizar uma tarefa, responda em `response_text` e utilize o array `visual_guides` para desenhar na tela:\n- 'number_badge': Desenhe círculos numerados (1, 2, 3...) nas posições x, y e use o campo `label` para descrever a ação (ex: 'Passo 1: Clicar em Arquivo').\n- 'arrow': Aponte setas (startX, startY até endX, endY) indicando o local exato com `label` explicativo.\n- 'circle': Desenhe círculos com raio e cor destacando botões ou ícones.\n- 'rect': Desenhe retângulos delimitando caixas, menus ou tabelas (x, y, width, height e label).\n- 'text': Escreva notas ou anotações flutuantes explicativas na tela.\n2. Roteiro Passo a Passo: Ordene os number_badges sequencialmente para formar um guia passo a passo completo.\n3. Código e Solução de Erros: Analise erros, depure telas e mostre onde corrigir.\nSe não for uma pergunta visual ou não precisar de desenho, retorne `visual_guides` vazio.";

const DEFAULT_LIVE_SYSTEM_INSTRUCTION =
  "Você é o Vision, assistente de IA de visão de tela e voz em tempo real. Responda em português de forma concisa, direta e prestativa. Aponte e explique o que está na tela com precisão. Interrompa sua fala imediatamente quando o usuário falar.";

const App: React.FC = () => {
  // Authentication state
  const { user, loading: authLoading, error: authError, signInWithGoogle, signOut, clearError: clearAuthError } = useAuth();

  const [messages, setMessages] = useState<Message[]>([
    {
      role: Role.ASSISTANT,
      text: "Olá! Eu sou o Vision, seu assistente inteligente com visão de tela. Compartilhe sua tela, conecte sua câmera ou envie uma captura para começarmos!",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [visualGuides, setVisualGuides] = useState<VisualGuide[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMicModalOpen, setIsMicModalOpen] = useState(false);

  // Screen aspect & width detection for responsive split (desktop/landscape: side-by-side, mobile/portrait: top-bottom)
  const [isRowLayout, setIsRowLayout] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 768 && window.innerWidth >= window.innerHeight;
  });

  useEffect(() => {
    const handleResize = () => {
      const isWide = window.innerWidth >= 768 && window.innerWidth >= window.innerHeight;
      setIsRowLayout(isWide);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Resizable split state: screen preview ratio (between 0.18 and 0.82)
  const [splitRatio, setSplitRatio] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('visionSplitRatio');
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0.18 && parsed <= 0.82) return parsed;
      }
    } catch (e) {}
    return 0.50; // default 50/50 clean balanced layout
  });
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const [settings, setSettings] = useState<Settings>({
    micSensitivity: 1.0,
    audioOutputDeviceId: 'default',
    voiceModel: 'Zephyr',
    shareSystemAudio: false,
    systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
    liveSystemInstruction: DEFAULT_LIVE_SYSTEM_INSTRUCTION,
  });

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('visualAssistantSettings');
      if (savedSettings) {
        const loaded = JSON.parse(savedSettings);
        setSettings((prev) => ({
          ...prev,
          ...loaded,
          systemInstruction: loaded.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION,
          liveSystemInstruction: loaded.liveSystemInstruction || DEFAULT_LIVE_SYSTEM_INSTRUCTION,
        }));
      }
    } catch (e) {
      console.error('Failed to load settings from localStorage', e);
    }
  }, []);

  const handleApiKeyError = useCallback(() => {
    setError('Sua chave de API do Gemini parece ser inválida ou não está configurada no servidor.');
  }, []);

  const handleSettingsChange = (newSettings: Settings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('visualAssistantSettings', JSON.stringify(newSettings));
    } catch (e) {
      console.error('Failed to save settings to localStorage', e);
    }
  };

  const {
    stream,
    isSharing,
    isMobile,
    screenshotDataUrl,
    captureType,
    startScreenCapture,
    stopScreenCapture,
    setScreenshot,
    captureFrame,
  } = useScreenCapture({
    shareSystemAudio: settings.shareSystemAudio,
  });

  const systemAudioTrack = stream?.getAudioTracks()[0];

  const {
    isLive,
    isSpeaking,
    startConversation,
    stopConversation,
    interruptSpeech,
    liveMessages,
    micVolume,
  } = useLiveConversation({
    isSharing,
    captureFrame,
    onError: (e) => setError(e),
    micSensitivity: settings.micSensitivity,
    audioOutputDeviceId: settings.audioOutputDeviceId,
    voiceModel: settings.voiceModel,
    systemAudioTrack,
    systemInstruction: settings.liveSystemInstruction,
    onApiKeyError: handleApiKeyError,
  });

  // Rock-solid drag and drop resizable splitter logic with Pointer Capture
  const handleSplitPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setIsDraggingSplit(true);
    isDraggingRef.current = true;
  };

  const updateSplitFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!mainContainerRef.current) return;
      const rect = mainContainerRef.current.getBoundingClientRect();
      let newRatio: number;

      if (isRowLayout) {
        newRatio = (clientX - rect.left) / rect.width;
      } else {
        newRatio = (clientY - rect.top) / rect.height;
      }

      // Smoothly clamp between 18% and 82%
      const clamped = Math.max(0.18, Math.min(0.82, newRatio));
      setSplitRatio(clamped);
    },
    [isRowLayout]
  );

  const handleSplitPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    updateSplitFromPointer(e.clientX, e.clientY);
  };

  const handleSplitPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    isDraggingRef.current = false;
    setIsDraggingSplit(false);
    try {
      localStorage.setItem('visionSplitRatio', splitRatio.toString());
    } catch {}
  };

  useEffect(() => {
    if (!isDraggingSplit) return;

    const handleWindowPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      updateSplitFromPointer(e.clientX, e.clientY);
    };

    const handleWindowPointerUp = () => {
      isDraggingRef.current = false;
      setIsDraggingSplit(false);
      try {
        localStorage.setItem('visionSplitRatio', splitRatio.toString());
      } catch {}
    };

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };
  }, [isDraggingSplit, updateSplitFromPointer, splitRatio]);

  const handleSetPresetRatio = (ratio: number) => {
    setSplitRatio(ratio);
    try {
      localStorage.setItem('visionSplitRatio', ratio.toString());
    } catch (err) {}
  };

  const handleUploadScreenshot = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setScreenshot(e.target.result as string);
          setAnnotations([]);
          setVisualGuides([]);
        }
      };
      reader.readAsDataURL(file);
    },
    [setScreenshot]
  );

  const handlePasteScreenshot = useCallback(
    (dataUrl: string) => {
      setScreenshot(dataUrl);
      setAnnotations([]);
      setVisualGuides([]);
    },
    [setScreenshot]
  );

  const handleNewMessage = useCallback(
    async (prompt: string) => {
      if (!prompt || isLoading || isLive) return;

      setIsLoading(true);
      setError(null);

      const newMessages: Message[] = [...messages, { role: Role.USER, text: prompt }];
      setMessages(newMessages);

      let imageBase64: string | null = null;
      if (isSharing || screenshotDataUrl) {
        try {
          imageBase64 = await captureFrame(visualGuides);
        } catch (err) {
          setError('Não foi possível capturar o quadro da tela.');
          setIsLoading(false);
          return;
        }
      }

      try {
        const response = await askAboutScreen(newMessages, imageBase64, settings.systemInstruction);
        setMessages((prev) => [...prev, { role: Role.ASSISTANT, text: response.text }]);
        if (response.annotations) {
          setAnnotations(response.annotations);
        }
        if (response.visualGuides && response.visualGuides.length > 0) {
          setVisualGuides(response.visualGuides);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Um erro desconhecido ocorreu.';
        if (errorMessage.includes('Requested entity was not found.') || errorMessage.includes('API key not valid')) {
          handleApiKeyError();
        } else {
          setError(`Falha ao obter resposta do Vision: ${errorMessage}`);
          setMessages((prev) => [
            ...prev,
            { role: Role.ASSISTANT, text: `Desculpe, encontrei um erro ao processar: ${errorMessage}` },
          ]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, isSharing, screenshotDataUrl, captureFrame, isLive, settings.systemInstruction, messages, handleApiKeyError, visualGuides]
  );

  const handleToggleScreenSharing = useCallback(
    async (mode: 'screen' | 'camera' = 'screen') => {
      if (isSharing) {
        stopScreenCapture();
        setAnnotations([]);
        setVisualGuides([]);
      } else {
        if (isLive) {
          stopConversation();
        }
        try {
          setError(null);
          await startScreenCapture(mode);
        } catch (err: any) {
          const errorMessage = err instanceof Error ? err.message : '';
          if (errorMessage === 'PERMISSION_DENIED') {
            setError('O compartilhamento de tela foi cancelado no navegador.');
          } else if (errorMessage === 'IFRAME_PERMISSION_DENIED') {
            setError(
              "Permissão restrita pelo iframe. Use o botão 'Nova Aba' no topo da tela para compartilhar sem restrições."
            );
          } else {
            setError(errorMessage || 'Erro ao iniciar compartilhamento.');
          }
        }
      }
    },
    [isSharing, isLive, startScreenCapture, stopScreenCapture, stopConversation]
  );

  const handleToggleLiveSession = useCallback(() => {
    if (isLive) {
      stopConversation();
      if (liveMessages.length > 0) {
        setMessages((prev) => [...prev, ...liveMessages]);
      }
    } else {
      setError(null);
      startConversation();
    }
  }, [isLive, stopConversation, startConversation, liveMessages]);

  const downloadTextFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleGenerateSummary = useCallback(async () => {
    if (isLoading || isLive || messages.length <= 1) return;
    setIsLoading(true);
    setError(null);
    try {
      let imageBase64: string | null = null;
      if (isSharing || screenshotDataUrl) {
        try {
          imageBase64 = await captureFrame();
        } catch (err) {
          console.debug('Could not capture frame for summary, proceeding without it.', err);
        }
      }
      const summary = await generateSummary(messages, imageBase64);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadTextFile(summary, `resumo-vision-${timestamp}.md`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      if (errorMessage.includes('Requested entity was not found.') || errorMessage.includes('API key not valid')) {
        handleApiKeyError();
      } else {
        setError(`Falha ao gerar o resumo: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isLive, messages, isSharing, screenshotDataUrl, captureFrame, handleApiKeyError]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Loading state while checking Firebase auth session
  if (authLoading) {
    return (
      <div className="min-h-screen w-full bg-gray-950 flex flex-col items-center justify-center p-4">
        <div className="relative">
          <img src="/logo.png" alt="Vision Logo" className="w-16 h-16 rounded-2xl shadow-xl shadow-cyan-500/20 mb-4 animate-pulse" />
          <div className="absolute inset-0 rounded-2xl border-2 border-cyan-400 border-t-transparent animate-spin" />
        </div>
        <p className="text-sm font-semibold text-gray-300">Iniciando Vision...</p>
        <span className="text-xs text-gray-500 mt-1">Carregando autenticação segura</span>
      </div>
    );
  }

  // Login Gate: Only logged-in users with Google/Gmail are granted access
  if (!user) {
    return (
      <LoginGate
        onSignIn={signInWithGoogle}
        isLoading={authLoading}
        error={authError}
        onClearError={clearAuthError}
      />
    );
  }

  const currentMessages = isLive ? liveMessages : messages;
  const currentLoadingState = isLoading || (isLive && liveMessages.length === 0);

  // Compute CSS dimension strings for resizable split
  const screenPercentage = Math.round(splitRatio * 100);
  const chatPercentage = 100 - screenPercentage;

  return (
    <>
      <div className="flex flex-col h-screen w-full bg-gray-950 text-gray-100 font-sans overflow-hidden">
        
        {/* App Header with Vision Logo, PWA Install Button and Google User Profile */}
        <Header
          user={user}
          onSignOut={signOut}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isSharing={isSharing}
          isLive={isLive}
        />

        {/* Quick Split Ratio Presets Bar */}
        <div className="bg-gray-900/60 border-b border-gray-800/80 px-3 py-1 flex items-center justify-between text-[11px] text-gray-400 select-none">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 hidden sm:inline">Tamanho da Visão:</span>
            <span className="font-semibold text-cyan-400">{screenPercentage}%</span>
            <span className="text-gray-600">/</span>
            <span className="text-gray-400">{chatPercentage}% Chat</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleSetPresetRatio(0.30)}
              className={`px-2 py-0.5 rounded text-[10px] transition cursor-pointer ${
                screenPercentage === 30 ? 'bg-cyan-600 text-white font-bold' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              }`}
              title="Tela compacta (30%)"
            >
              30%
            </button>
            <button
              onClick={() => handleSetPresetRatio(0.50)}
              className={`px-2 py-0.5 rounded text-[10px] transition cursor-pointer ${
                screenPercentage === 50 ? 'bg-cyan-600 text-white font-bold' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              }`}
              title="Equilibrado (50%)"
            >
              50%
            </button>
            <button
              onClick={() => handleSetPresetRatio(0.70)}
              className={`px-2 py-0.5 rounded text-[10px] transition cursor-pointer ${
                screenPercentage === 70 ? 'bg-cyan-600 text-white font-bold' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              }`}
              title="Visão ampla (70%)"
            >
              70%
            </button>
            <button
              onClick={() => handleSetPresetRatio(0.85)}
              className={`px-2 py-0.5 rounded text-[10px] transition cursor-pointer ${
                screenPercentage === 85 ? 'bg-cyan-600 text-white font-bold' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              }`}
              title="Foco total (85%)"
            >
              85%
            </button>
            <button
              onClick={() => handleSetPresetRatio(screenPercentage > 80 ? 0.50 : 0.85)}
              className="px-2 py-0.5 rounded text-[10px] bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/30 transition cursor-pointer font-medium ml-1"
              title={screenPercentage > 80 ? "Restaurar layout equilibrado" : "Expandir visão"}
            >
              {screenPercentage > 80 ? "Restaurar" : "Expandir"}
            </button>
          </div>
        </div>

        {/* Main Work Area with Draggable Resizable Split Pane */}
        <main
          ref={mainContainerRef}
          style={{ flexDirection: isRowLayout ? 'row' : 'column' }}
          className={`flex-1 flex w-full overflow-hidden relative select-none ${
            isDraggingSplit ? (isRowLayout ? 'cursor-col-resize' : 'cursor-row-resize') : ''
          }`}
        >
          {/* Transparent Overlay during dragging to prevent iframes/videos from stealing pointer events */}
          {isDraggingSplit && (
            <div
              className={`fixed inset-0 z-50 ${isRowLayout ? 'cursor-col-resize' : 'cursor-row-resize'}`}
              style={{ userSelect: 'none', pointerEvents: 'auto' }}
            />
          )}

          {/* Pane 1: Screen & Vision Monitor */}
          <div
            style={
              isRowLayout
                ? {
                    flex: `0 0 ${screenPercentage}%`,
                    width: `${screenPercentage}%`,
                    maxWidth: '82%',
                    minWidth: '18%',
                  }
                : {
                    flex: `0 0 ${screenPercentage}%`,
                    height: `${screenPercentage}%`,
                    maxHeight: '82%',
                    minHeight: '18%',
                  }
            }
            className={`flex flex-col min-w-0 min-h-0 overflow-hidden shrink-0 ${
              isRowLayout ? 'h-full p-2 md:p-3' : 'w-full p-1.5 sm:p-2'
            }`}
          >
            <ScreenPreview
              stream={stream}
              isSharing={isSharing}
              annotations={annotations}
              visualGuides={visualGuides}
              onClearGuides={() => setVisualGuides([])}
              onStartScreenShare={handleToggleScreenSharing}
              onStopScreenShare={handleToggleScreenSharing}
              onUploadScreenshot={handleUploadScreenshot}
              onPasteScreenshot={handlePasteScreenshot}
              screenshotDataUrl={screenshotDataUrl}
              captureType={captureType}
              isMobile={isMobile}
            />
          </div>

          {/* Draggable Divider Handle (Rock-solid with Pointer Capture - NEVER escapes) */}
          <div
            onPointerDown={handleSplitPointerDown}
            onPointerMove={handleSplitPointerMove}
            onPointerUp={handleSplitPointerUp}
            className={`group relative flex items-center justify-center shrink-0 z-20 touch-none select-none transition-colors ${
              isRowLayout
                ? 'cursor-col-resize h-full w-4 py-2 hover:bg-cyan-500/20 active:bg-cyan-500/40'
                : 'cursor-row-resize w-full h-5 px-2 hover:bg-cyan-500/20 active:bg-cyan-500/40'
            } ${isDraggingSplit ? 'bg-cyan-500/30' : 'bg-gray-900 border-gray-800'}`}
            title="Arraste para redimensionar a divisão da tela"
          >
            {/* Grip Handle Indicator */}
            <div className="flex items-center justify-center pointer-events-none">
              <div
                className={`rounded-full transition-all duration-150 ${
                  isDraggingSplit
                    ? 'bg-cyan-400 scale-125 shadow-lg shadow-cyan-500/60'
                    : 'bg-gray-500 group-hover:bg-cyan-400'
                } ${isRowLayout ? 'w-1.5 h-12' : 'w-16 h-1.5'}`}
              />
            </div>
          </div>

          {/* Pane 2: Conversation View & Controls (Fills 100% of remaining space - never clips) */}
          <div
            className={`flex-1 flex flex-col min-w-0 min-h-0 bg-gray-900/40 overflow-hidden ${
              isRowLayout ? 'h-full' : 'w-full'
            }`}
          >
            <ConversationView messages={currentMessages} isLoading={currentLoadingState} />
            <Controls
              onSendMessage={handleNewMessage}
              isListening={isLive}
              toggleListening={handleToggleLiveSession}
              isSharing={isSharing}
              toggleScreenSharing={handleToggleScreenSharing}
              isLoading={isLoading}
              isSpeaking={isSpeaking}
              onInterrupt={interruptSpeech}
              micVolume={micVolume}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onGenerateSummary={handleGenerateSummary}
              hasConversation={messages.length > 1}
            />
          </div>

          {/* Floating error notification with retry button for mic permission */}
          {error && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-[92vw] sm:max-w-lg px-4 py-3 rounded-xl bg-red-900/95 text-white text-xs font-medium shadow-2xl backdrop-blur-md border border-red-500 flex items-start sm:items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                <svg className="w-5 h-5 text-red-300 shrink-0 mt-0.5 sm:mt-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-red-100 leading-tight">Aviso do Sistema</p>
                  <p className="text-red-200 mt-0.5 text-[11px] leading-relaxed break-words">{error}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap justify-end">
                {error.includes('Nova Aba') && (
                  <a
                    href={typeof window !== 'undefined' ? window.location.href : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-[11px] transition inline-flex items-center gap-1 shadow"
                  >
                    <span>Abrir Nova Aba</span>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
                {(error.toLowerCase().includes('microfone') || error.toLowerCase().includes('permissão')) && (
                  <>
                    <button
                      onClick={() => setIsMicModalOpen(true)}
                      className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-[11px] transition cursor-pointer shadow flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Como Liberar</span>
                    </button>
                    <button
                      onClick={() => {
                        setError(null);
                        handleToggleLiveSession();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white font-semibold text-[11px] transition cursor-pointer"
                    >
                      Tentar Novamente
                    </button>
                  </>
                )}
                <button
                  onClick={() => setError(null)}
                  className="p-1 rounded text-red-300 hover:text-white hover:bg-red-800/60 transition cursor-pointer"
                  title="Fechar aviso"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </main>

        {/* AdMob Bottom Advertising Bar (Configured via project secret environment variables) */}
        <AdBanner />
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSettingsChange={handleSettingsChange}
      />

      {/* Microphone Permission Guide & Real-Time Test Modal */}
      <MicPermissionModal
        isOpen={isMicModalOpen}
        onClose={() => setIsMicModalOpen(false)}
        onRetryStart={() => {
          setError(null);
          handleToggleLiveSession();
        }}
      />
    </>
  );
};

export default App;