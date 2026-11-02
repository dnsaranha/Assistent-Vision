import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Message, Role, Annotation, VisualGuide } from './types';
import { askAboutScreen, generateSummary } from './services/geminiService';
import { useScreenCapture } from './hooks/useScreenCapture';
import { useLiveConversation } from './hooks/useLiveConversation';
import { useAuth } from './hooks/useAuth';
import { LoginGate } from './components/LoginGate';
import { AppWorkspace } from './components/AppWorkspace';
import type { Settings } from './components/SettingsModal';

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

  // Screen width detection for responsive split (desktop: side-by-side, mobile: top-bottom)
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth >= 768 : true;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Resizable split state: screen preview ratio (between 0.20 and 0.85)
  const [splitRatio, setSplitRatio] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('visionSplitRatio');
      if (saved) return parseFloat(saved);
    } catch (e) {}
    return 0.55; // default 55% screen preview
  });
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const mainContainerRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState<Settings>({
    micSensitivity: 1.0,
    audioOutputDeviceId: 'default',
    voiceModel: 'Zephyr',
    shareSystemAudio: false,
    systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
    liveSystemInstruction: DEFAULT_LIVE_SYSTEM_INSTRUCTION,
    adMobPublisherId: '',
    adMobSlotId: '',
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
          adMobPublisherId: loaded.adMobPublisherId || '',
          adMobSlotId: loaded.adMobSlotId || '',
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
    startConversation,
    stopConversation,
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

  // Drag and drop resizable splitter logic
  const handleSplitPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDraggingSplit(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleSplitPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingSplit || !mainContainerRef.current) return;

    const rect = mainContainerRef.current.getBoundingClientRect();

    let newRatio: number;
    if (isDesktop) {
      const clientX = e.clientX - rect.left;
      newRatio = clientX / rect.width;
    } else {
      const clientY = e.clientY - rect.top;
      newRatio = clientY / rect.height;
    }

    // Clamp between 20% and 80%
    const clamped = Math.max(0.2, Math.min(0.8, newRatio));
    setSplitRatio(clamped);
  };

  const handleSplitPointerUp = (e: React.PointerEvent) => {
    if (isDraggingSplit) {
      setIsDraggingSplit(false);
      try {
        localStorage.setItem('visionSplitRatio', splitRatio.toString());
      } catch (err) {}
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
  };

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

  return (
    <AppWorkspace
      user={user}
      signOut={signOut}
      onOpenSettings={() => setIsSettingsOpen(true)}
      isSharing={isSharing}
      isLive={isLive}
      splitRatio={splitRatio}
      onSetPresetRatio={handleSetPresetRatio}
      mainContainerRef={mainContainerRef}
      onSplitPointerMove={handleSplitPointerMove}
      onSplitPointerUp={handleSplitPointerUp}
      onSplitPointerDown={handleSplitPointerDown}
      isDraggingSplit={isDraggingSplit}
      isDesktop={isDesktop}
      stream={stream}
      annotations={annotations}
      visualGuides={visualGuides}
      onClearGuides={() => setVisualGuides([])}
      onToggleScreenSharing={handleToggleScreenSharing}
      onUploadScreenshot={handleUploadScreenshot}
      onPasteScreenshot={handlePasteScreenshot}
      screenshotDataUrl={screenshotDataUrl}
      captureType={captureType}
      isMobile={isMobile}
      messages={messages}
      liveMessages={liveMessages}
      isLoading={isLoading}
      onSendMessage={handleNewMessage}
      onToggleLiveSession={handleToggleLiveSession}
      micVolume={micVolume}
      onGenerateSummary={handleGenerateSummary}
      error={error}
      onClearError={() => setError(null)}
      settings={settings}
      onSettingsChange={handleSettingsChange}
      isSettingsOpen={isSettingsOpen}
      onCloseSettings={() => setIsSettingsOpen(false)}
    />
  );
};

export default App;
