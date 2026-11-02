
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
  onInterrupt?: () => void;
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
  onInterrupt,
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
    <div className="p-2 sm:p-3 md:p-4 bg-gray-900/90 border-t border-gray-800">
      {/* Speaking status and interrupt button */}
      {isSpeaking && (
        <div className="mb-2 flex items-center justify-between px-2.5 py-1 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-xs text-cyan-300 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span className="font-medium">Vision falando...</span>
          </div>
          {onInterrupt && (
            <button
              onClick={onInterrupt}
              className="px-2 py-0.5 rounded bg-cyan-800/80 hover:bg-cyan-700 text-cyan-100 text-[11px] font-semibold transition cursor-pointer"
            >
              Interromper
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          onClick={toggleScreenSharing}
          disabled={isLoading || isListening}
          className={`shrink-0 p-2 sm:p-2.5 rounded-full transition-colors duration-200 ${
            isSharing
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-gray-700 hover:bg-gray-600'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          aria-label={isSharing ? 'Parar de compartilhar' : 'Compartilhar tela'}
          title={isSharing ? 'Parar de compartilhar' : 'Compartilhar tela'}
        >
          {isSharing ? <StopCircleIcon /> : <ScreenIcon />}
        </button>
        <button
          onClick={toggleListening}
          disabled={isLoading}
          className={`shrink-0 p-2 sm:p-2.5 rounded-full transition-all duration-100 ease-out ${
            isListening
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-cyan-500 hover:bg-cyan-600'
          } disabled:opacity-50 disabled:cursor-not-allowed relative`}
          style={{
            transform: `scale(${isListening ? 1 + micVolume * 0.2 : 1})`,
            boxShadow: isListening ? `0 0 0 ${micVolume * 15}px rgba(239, 68, 68, 0.4)` : 'none'
          }}
          aria-label={isListening ? 'Parar de ouvir' : 'Começar a ouvir'}
          title={isListening ? 'Parar voz' : 'Iniciar voz em tempo real'}
        >
          <MicIcon />
        </button>
        <form onSubmit={handleSubmit} className="flex-1 min-w-0 flex items-center">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={isListening ? "Ouvindo você..." : "Pergunte ao Vision..."}
            disabled={isLoading || isListening || isSpeaking}
            className="w-full min-w-0 bg-gray-800 border border-gray-700 rounded-l-lg px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim() || isListening}
            className="shrink-0 bg-cyan-600 hover:bg-cyan-500 text-white px-2.5 sm:px-3 py-2 rounded-r-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Enviar mensagem"
            title="Enviar mensagem"
          >
            <SendIcon />
          </button>
        </form>
        <button
          onClick={onGenerateSummary}
          disabled={isLoading || isListening || !hasConversation}
          className="shrink-0 p-2 sm:p-2.5 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed hidden xs:inline-flex"
          aria-label="Gerar e baixar resumo"
          title="Baixar resumo da conversa"
        >
          <DownloadIcon />
        </button>
        <button
          onClick={onOpenSettings}
          disabled={isLoading || isListening}
          className="shrink-0 p-2 sm:p-2.5 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Abrir configurações"
          title="Configurações do Vision"
        >
          <SettingsIcon />
        </button>
      </div>
    </div>
  );
};
