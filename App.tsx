import React, { useState, useEffect, useCallback } from 'react';
import { Message, Role, Annotation, VisualGuide } from './types';
import { askAboutScreen, generateSummary } from './services/geminiService';
import { useScreenCapture } from './hooks/useScreenCapture';
import { useLiveConversation } from './hooks/useLiveConversation';
import { useSmoothSplitter } from './hooks/useSmoothSplitter';
import { ConversationView } from './components/ConversationView';
import { Controls } from './components/Controls';
import { ScreenPreview } from './components/ScreenPreview';
import { SettingsModal, Settings } from './components/SettingsModal';
import { SplitterHandle } from './components/SplitterHandle';
import { SplitPresetsBar } from './components/SplitPresetsBar';
import { AdBanner } from './components/AdBanner';

const DEFAULT_SYSTEM_INSTRUCTION = "Você é um assistente de IA prestativo chamado Vision. Suas capacidades são: 1. Orientação Visual: Quando o usuário pedir ajuda para navegar na interface em sua tela compartilhada ou através da câmera do celular/computador, seu principal objetivo é fornecer orientação visual. Forneça uma resposta curta em `response_text` e use o array `visual_guides` para desenhar na tela. Você pode usar 'arrow' para apontar para elementos, 'text' para adicionar rótulos e 'number_badge' para indicar uma sequência de etapas. Combine esses guias para fornecer instruções claras e passo a passo. 2. Código e Resolução de Problemas: Você é um programador especialista. Ajude os usuários com seus códigos, depure problemas e ofereça soluções. 3. Assistência Geral: Ajude com uma ampla gama de tarefas. Para tarefas não visuais, retorne um array `visual_guides` vazio. Importante: Adapte seu comportamento e siga as novas diretrizes se o usuário fornecer instruções para alterar sua função durante a conversa.";
const DEFAULT_LIVE_SYSTEM_INSTRUCTION = "Você é um assistente de IA prestativo chamado Vision. Você está em uma conversa de voz e pode ver a tela ou o que a câmera do usuário transmite em tempo real. Suas capacidades são: 1. Guia Visual: Ajude os usuários a navegar em sua tela ou no que estiverem mostrando com a câmera. 2. Programador e Solucionador de Problemas: Você é um programador especialista. Ajude com código, depuração e problemas complexos. 3. Identificador de Música: Se o usuário perguntar 'que música é essa?', analise o áudio do sistema para identificar o título da música e o artista. 4. Assistente Geral: Ajude com uma ampla gama de tarefas. 5. Adaptável e Interrompível: Você deve parar de falar imediatamente se o usuário começar a falar. Além disso, adapte seu comportamento e siga novas diretrizes se o usuário fornecer instruções para alterar sua função durante a conversa. Seja sempre conciso e prestativo.";

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: Role.ASSISTANT,
      text: "Olá! Eu sou seu assistente visual. Ative a câmera, compartilhe sua tela ou envie uma foto e me faça uma pergunta por texto ou voz.",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [visualGuides, setVisualGuides] = useState<VisualGuide[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    micSensitivity: 1.0,
    audioOutputDeviceId: 'default',
    voiceModel: 'Zephyr',
    shareSystemAudio: false,
    systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
    liveSystemInstruction: DEFAULT_LIVE_SYSTEM_INSTRUCTION,
  });

  const {
    containerRef,
    splitRatio,
    rawSplitRatio,
    isDragging,
    isMaximized,
    isMobile,
    presets,
    startDragging,
    applyPreset,
    toggleMaximize,
  } = useSmoothSplitter();

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('visualAssistantSettings');
      if (savedSettings) {
        const loaded = JSON.parse(savedSettings);
        setSettings(prev => ({
          ...prev, 
          ...loaded,
          systemInstruction: loaded.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION,
          liveSystemInstruction: loaded.liveSystemInstruction || DEFAULT_LIVE_SYSTEM_INSTRUCTION,
        }));
      }
    } catch (e) {
      console.error("Failed to load settings from localStorage", e);
    }
  }, []);
  
  const handleApiKeyError = useCallback(() => {
    setError("Sua chave de API parece ser inválida ou não está configurada.");
  }, []);

  const handleSettingsChange = (newSettings: Settings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('visualAssistantSettings', JSON.stringify(newSettings));
    } catch (e) {
      console.error("Failed to save settings to localStorage", e);
    }
  };

  const {
    stream,
    isSharing,
    sourceType,
    facingMode,
    customImage,
    startScreenCapture,
    startCameraCapture,
    toggleCameraFacing,
    stopScreenCapture,
    uploadImage,
    captureFrame,
  } = useScreenCapture({ 
    shareSystemAudio: settings.shareSystemAudio 
  });
  
  const systemAudioTrack = stream?.getAudioTracks()[0];

  const { 
    isLive, 
    startConversation, 
    stopConversation, 
    liveMessages, 
    micVolume 
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

  const handleNewMessage = useCallback(async (prompt: string) => {
    if (!prompt || isLoading || isLive) return;

    setIsLoading(true);
    setError(null);
    setAnnotations([]);
    setVisualGuides([]);
    
    const newMessages: Message[] = [...messages, { role: Role.USER, text: prompt }];
    setMessages(newMessages);

    let imageBase64: string | null = null;
    if (isSharing) {
      try {
        imageBase64 = await captureFrame();
      } catch (err) {
        setError('Não foi possível capturar o quadro visual.');
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
      if (response.visualGuides) {
        setVisualGuides(response.visualGuides);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Um erro desconhecido ocorreu.';
      if (errorMessage.includes("Requested entity was not found.") || errorMessage.includes("API key not valid")) {
        handleApiKeyError();
      } else {
        setError(`Falha ao obter resposta do Gemini: ${errorMessage}`);
        setMessages((prev) => [...prev, { role: Role.ASSISTANT, text: `Desculpe, encontrei um erro: ${errorMessage}` }]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isSharing, captureFrame, isLive, settings.systemInstruction, messages, handleApiKeyError]);

  const handleToggleScreenSharing = useCallback(async () => {
    if (sourceType === 'screen') {
      stopScreenCapture();
      setAnnotations([]);
      setVisualGuides([]);
    } else {
      try {
        setError(null);
        await startScreenCapture();
        setAnnotations([]);
        setVisualGuides([]);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '';
        if (errorMessage === "PERMISSION_DENIED") {
          setError("O compartilhamento de tela foi cancelado. Para que eu possa ver sua tela, clique no ícone novamente e escolha 'Permitir'.");
        } else {
          setError(errorMessage || 'Falha ao iniciar compartilhamento de tela.');
        }
      }
    }
  }, [sourceType, startScreenCapture, stopScreenCapture]);

  const handleToggleCamera = useCallback(async () => {
    if (sourceType === 'camera') {
      stopScreenCapture();
      setAnnotations([]);
      setVisualGuides([]);
    } else {
      try {
        setError(null);
        await startCameraCapture();
        setAnnotations([]);
        setVisualGuides([]);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Falha ao acessar a câmera.';
        setError(errorMessage);
      }
    }
  }, [sourceType, startCameraCapture, stopScreenCapture]);

  const handleUploadImage = useCallback(async (file: File) => {
    try {
      setError(null);
      await uploadImage(file);
      setAnnotations([]);
      setVisualGuides([]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Falha ao carregar a imagem.';
      setError(errorMessage);
    }
  }, [uploadImage]);

  const handleToggleLiveSession = useCallback(() => {
    if (isLive) {
      stopConversation();
      if (liveMessages.length > 0) {
        setMessages(prev => [...prev, ...liveMessages]);
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
      if (isSharing) {
        try {
          imageBase64 = await captureFrame();
        } catch (err) {
          console.error("Could not capture frame for summary, proceeding without it.", err);
        }
      }
      const summary = await generateSummary(messages, imageBase64);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadTextFile(summary, `resumo-reuniao-${timestamp}.md`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      if (errorMessage.includes("Requested entity was not found.") || errorMessage.includes("API key not valid")) {
         handleApiKeyError();
      } else {
        setError(`Falha ao gerar o resumo: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isLive, messages, isSharing, captureFrame, handleApiKeyError]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const currentMessages = isLive ? liveMessages : messages;
  const currentLoadingState = isLoading || (isLive && liveMessages.length === 0);

  return (
    <>
      <div className="flex h-screen w-full bg-gray-900 text-gray-200 font-sans flex-col overflow-hidden">
        {/* Header with Title and Presets + 1-Click Maximize/Restore */}
        <header className="bg-gray-800/60 backdrop-blur-sm border-b border-gray-700/80 px-3 py-2 md:px-4 flex flex-wrap items-center justify-between gap-2 z-10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-950/60">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-base sm:text-lg md:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 truncate">
              Assistente Visual por Voz
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Presets & 1-Click Expand/Restore */}
            <SplitPresetsBar
              presets={presets}
              currentRatio={rawSplitRatio}
              isMaximized={isMaximized}
              onSelectPreset={applyPreset}
              onToggleMaximize={toggleMaximize}
            />

            <button
              onClick={() => setIsSettingsOpen(true)}
              disabled={isLoading || isLive}
              className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 transition-colors"
              title="Configurações"
              aria-label="Abrir configurações"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </header>
        
        {/* Main Resizable Workspace */}
        <main
          ref={containerRef as any}
          className="flex-1 flex flex-col md:flex-row overflow-hidden relative"
        >
          {/* Transparent Overlay during dragging to prevent video or canvas from stealing pointer events */}
          {isDragging && (
            <div
              className={`fixed inset-0 z-50 select-none bg-transparent ${
                isMobile ? 'cursor-row-resize' : 'cursor-col-resize'
              }`}
              style={{ touchAction: 'none' }}
            />
          )}

          {/* Screen / Camera Preview Section */}
          <div
            className="flex flex-col p-2 md:p-3 overflow-hidden"
            style={
              isMobile
                ? {
                    height: isMaximized ? '100%' : `${splitRatio}%`,
                    width: '100%',
                  }
                : {
                    width: isMaximized ? '100%' : `${splitRatio}%`,
                    height: '100%',
                  }
            }
          >
            <ScreenPreview 
              stream={stream} 
              isSharing={isSharing} 
              sourceType={sourceType}
              facingMode={facingMode}
              customImage={customImage}
              annotations={annotations}
              visualGuides={visualGuides} 
              onStartScreen={handleToggleScreenSharing}
              onStartCamera={handleToggleCamera}
              onToggleCamera={toggleCameraFacing}
              onUploadImage={handleUploadImage}
            />
          </div>

          {/* Draggable Divider with touch-action: none */}
          {!isMaximized && (
            <SplitterHandle
              onPointerDown={startDragging}
              isDragging={isDragging}
              isMobile={isMobile}
              onDoubleClick={toggleMaximize}
            />
          )}

          {/* Conversation and Controls Section */}
          {!isMaximized && (
            <div
              className="flex flex-col overflow-hidden"
              style={
                isMobile
                  ? {
                      height: `${100 - splitRatio}%`,
                      width: '100%',
                    }
                  : {
                      width: `${100 - splitRatio}%`,
                      height: '100%',
                    }
              }
            >
              <ConversationView messages={currentMessages} isLoading={currentLoadingState} />
              <Controls
                onSendMessage={handleNewMessage}
                isListening={isLive}
                toggleListening={handleToggleLiveSession}
                isSharing={isSharing}
                sourceType={sourceType}
                toggleScreenSharing={handleToggleScreenSharing}
                toggleCamera={handleToggleCamera}
                onUploadImage={handleUploadImage}
                isLoading={isLoading}
                isSpeaking={false}
                micVolume={micVolume}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onGenerateSummary={handleGenerateSummary}
                hasConversation={messages.length > 1}
              />
            </div>
          )}

          {error && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-red-500/90 text-white text-sm shadow-xl backdrop-blur-sm border border-red-400 flex items-center gap-2 animate-bounce-short">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {error}
            </div>
          )}
        </main>

        {/* Commercial & ADS Banner at the bottom */}
        <AdBanner />
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSettingsChange={handleSettingsChange}
      />
    </>
  );
};

export default App;