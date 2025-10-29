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
        // Ensure defaults are applied if saved settings are missing new keys
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

  const handleSettingsChange = (newSettings: Settings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('visualAssistantSettings', JSON.stringify(newSettings));
    } catch (e) {
      console.error("Failed to save settings to localStorage", e);
    }
  };


  const { stream, isSharing, startScreenCapture, stopScreenCapture, captureFrame } = useScreenCapture({ 
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
        setError('Could not capture screen frame.');
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
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to get response from Gemini: ${errorMessage}`);
      setMessages((prev) => [...prev, { role: Role.ASSISTANT, text: `Sorry, I encountered an error: ${errorMessage}` }]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isSharing, captureFrame, isLive, settings.systemInstruction, messages]);

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
        await startScreenCapture();
      } catch (err) {
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          setError("A permissão para compartilhar a tela foi negada. Clique no botão de tela e escolha 'Permitir' para continuar.");
        } else {
          const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
          setError(`Erro ao iniciar compartilhamento de tela: ${errorMessage}`);
          console.error(err);
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
        if(isSharing) {
            setTimeout(() => startConversation(), 250);
        } else {
            startConversation();
        }
    }
  }, [isLive, stopConversation, startConversation, liveMessages, isSharing]);
  
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
      setError(`Falha ao gerar o resumo: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isLive, messages, isSharing, captureFrame]);

  useEffect(() => {
    if (error) {
        const timer = setTimeout(() => setError(null), 5000);
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
              {error && <div className="p-4 text-red-400 bg-red-900/50 text-center text-sm">{error}</div>}
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
