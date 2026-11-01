import React, { useState, useEffect, useCallback } from 'react';
import { Message, Role, Annotation, VisualGuide } from './types';
import { askAboutScreen, generateSummary } from './services/geminiService';
import { useScreenCapture } from './hooks/useScreenCapture';
import { useLiveConversation } from './hooks/useLiveConversation';
import { ConversationView } from './components/ConversationView';
import { Controls } from './components/Controls';
import { ScreenPreview } from './components/ScreenPreview';
import { SettingsModal, Settings } from './components/SettingsModal';

const DEFAULT_SYSTEM_INSTRUCTION = "Você é um assistente de IA prestativo chamado Vision. Suas capacidades são: 1. Orientação Visual: Quando o usuário pedir ajuda para navegar na interface em sua tela compartilhada, seu principal objetivo é fornecer orientação visual. Forneça uma resposta curta em `response_text` e use o array `visual_guides` para desenhar na tela. Você pode usar 'arrow' para apontar para elementos, 'text' para adicionar rótulos e 'number_badge' para indicar uma sequência de etapas. Combine esses guias para fornecer instruções claras e passo a passo. 2. Código e Resolução de Problemas: Você é um programador especialista. Ajude os usuários com seus códigos, depure problemas e ofereça soluções. 3. Assistência Geral: Ajude com uma ampla gama de tarefas. Para tarefas não visuais, retorne um array `visual_guides` vazio. Importante: Adapte seu comportamento e siga as novas diretrizes se o usuário fornecer instruções para alterar sua função durante a conversa.";
const DEFAULT_LIVE_SYSTEM_INSTRUCTION = "Você é um assistente de IA prestativo chamado Vision. Você está em uma conversa de voz e pode ver a tela do usuário se ele a compartilhar. Suas capacidades são: 1. Guia Visual: Ajude os usuários a navegar em sua tela. 2. Programador e Solucionador de Problemas: Você é um programador especialista. Ajude com código, depuração e problemas complexos. 3. Identificador de Música: Se o usuário perguntar 'que música é essa?', analise o áudio do sistema para identificar o título da música e o artista. 4. Assistente Geral: Ajude com uma ampla gama de tarefas. 5. Adaptável e Interrompível: Você deve parar de falar imediatamente se o usuário começar a falar. Além disso, adapte seu comportamento e siga novas diretrizes se o usuário fornecer instruções para alterar sua função durante a conversa. Seja sempre conciso e prestativo.";


const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: Role.ASSISTANT,
      text: "Olá! Eu sou seu assistente visual. Compartilhe sua tela e me faça uma pergunta por texto ou voz.",
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
    screenMode,
    isNativeSupported,
    activeDemo,
    virtualCanvasRef,
    startScreenCapture, 
    stopScreenCapture, 
    setCustomImage,
    selectDemo,
    captureFrame 
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

  const handleUploadImage = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setCustomImage(e.target.result as string);
        setAnnotations([]);
        setVisualGuides([]);
      }
    };
    reader.readAsDataURL(file);
  }, [setCustomImage]);

  const handlePasteImage = useCallback((dataUrl: string) => {
    setCustomImage(dataUrl);
    setAnnotations([]);
    setVisualGuides([]);
  }, [setCustomImage]);

  const handleSelectDemo = useCallback((demoId: string) => {
    selectDemo(demoId);
    setAnnotations([]);
    setVisualGuides([]);
  }, [selectDemo]);

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
        await startScreenCapture();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '';
        if (errorMessage === "PERMISSION_DENIED") {
          setError("O compartilhamento de tela foi cancelado. Você pode tentar novamente ou enviar um print/imagem.");
        } else {
          // If native sharing fails for any reason, smoothly start virtual screen mode
          console.warn("Screen sharing failed, falling back to virtual screen:", err);
          await startScreenCapture('virtual');
        }
      }
    }
  }, [isSharing, isLive, startScreenCapture, stopScreenCapture, stopConversation]);

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
      <div className={`flex h-screen w-full bg-gray-900 text-gray-200 font-sans`}>
        <div className="flex flex-col flex-1 h-full">
          <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-3 md:p-4 flex items-center justify-center">
            <h1 className="text-lg md:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              Assistente Visual por Voz
            </h1>
          </header>
          
          <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
            <div className="w-full h-1/3 md:h-full md:w-3/5 flex flex-col p-2 md:p-4 border-b md:border-b-0 md:border-r border-gray-700">
              <ScreenPreview 
                stream={stream} 
                isSharing={isSharing} 
                annotations={annotations}
                visualGuides={visualGuides} 
                screenMode={screenMode}
                activeDemo={activeDemo}
                isNativeSupported={isNativeSupported}
                onSelectDemo={handleSelectDemo}
                onUploadImage={handleUploadImage}
                onPasteImage={handlePasteImage}
                onStartScreenShare={handleToggleScreenSharing}
                onStopScreenShare={handleToggleScreenSharing}
                virtualCanvasRef={virtualCanvasRef}
              />
            </div>
            <div className="w-full h-2/3 md:h-full md:w-2/5 flex flex-col">
              <ConversationView messages={currentMessages} isLoading={currentLoadingState} />
              <Controls
                onSendMessage={handleNewMessage}
                isListening={isLive}
                toggleListening={handleToggleLiveSession}
                isSharing={isSharing}
                toggleScreenSharing={handleToggleScreenSharing}
                isLoading={isLoading}
                isSpeaking={false}
                micVolume={micVolume}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onGenerateSummary={handleGenerateSummary}
                hasConversation={messages.length > 1}
              />
              {error && (
                <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-red-500/90 text-white text-sm shadow-xl backdrop-blur-sm border border-red-400 flex items-center gap-2 animate-bounce-short">
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                   {error}
                </div>
              )}
            </div>
          </main>
        </div>
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