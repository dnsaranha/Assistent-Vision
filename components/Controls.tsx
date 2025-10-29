import React, { useState } from 'react';
import { MicIcon, ScreenIcon, SendIcon, SettingsIcon, StopCircleIcon, DownloadIcon } from './Icons';

interface ControlsProps {
  onSendMessage: (message: string) => void;
  isListening: boolean;
  toggleListening: () => void;
  isSharing: boolean;
  toggleScreenSharing: () => void;
  isLoading: boolean;
  isSpeaking: boolean;
  micVolume: number;
  onOpenSettings: () => void;
  onGenerateSummary: () => void;
  hasConversation: boolean;
}

export const Controls: React.FC<ControlsProps> = ({
  onSendMessage,
  isListening,
  toggleListening,
  isSharing,
  toggleScreenSharing,
  isLoading,
  isSpeaking,
  micVolume,
  onOpenSettings,
  onGenerateSummary,
  hasConversation,
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue);
      setInputValue('');
    }
  };

  return (
    <div className="p-2 md:p-4 bg-gray-800/50 border-t border-gray-700">
      <div className="flex items-center space-x-1 sm:space-x-2">
        <button
          onClick={toggleScreenSharing}
          disabled={isLoading || isListening}
          className={`p-2 rounded-full transition-colors duration-200 ${
            isSharing
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-gray-600 hover:bg-gray-500'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          aria-label={isSharing ? 'Parar de compartilhar' : 'Compartilhar tela'}
        >
          {isSharing ? <StopCircleIcon /> : <ScreenIcon />}
        </button>
        <button
          onClick={toggleListening}
          disabled={isLoading}
          className={`p-2 rounded-full transition-all duration-100 ease-out ${
            isListening
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-cyan-500 hover:bg-cyan-600'
          } disabled:opacity-50 disabled:cursor-not-allowed relative`}
           style={{
               transform: `scale(${isListening ? 1 + micVolume * 0.2 : 1})`,
               boxShadow: isListening ? `0 0 0 ${micVolume * 15}px rgba(239, 68, 68, 0.4)` : 'none'
            }}
           aria-label={isListening ? 'Parar de ouvir' : 'Começar a ouvir'}
        >
          <MicIcon />
        </button>
        <form onSubmit={handleSubmit} className="flex-1 flex items-center">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={isListening ? "Ouvindo..." : "Digite sua pergunta..."}
            disabled={isLoading || isListening || isSpeaking}
            className="w-full bg-gray-700 border border-gray-600 rounded-l-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim() || isListening}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-r-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Enviar mensagem"
          >
            <SendIcon />
          </button>
        </form>
         <button
          onClick={onGenerateSummary}
          disabled={isLoading || isListening || !hasConversation}
          className="p-2 rounded-full bg-gray-600 hover:bg-gray-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Gerar e baixar resumo"
        >
          <DownloadIcon />
        </button>
         <button
          onClick={onOpenSettings}
          disabled={isLoading || isListening}
          className="p-2 rounded-full bg-gray-600 hover:bg-gray-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Abrir configurações"
        >
          <SettingsIcon />
        </button>
      </div>
    </div>
  );
};
