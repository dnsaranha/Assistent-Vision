import React, { useState, useRef } from 'react';
import { MicIcon, ScreenIcon, CameraIcon, SendIcon, SettingsIcon, StopCircleIcon, DownloadIcon, ImageIcon } from './Icons';
import { VisualSourceType } from '../hooks/useScreenCapture';

interface ControlsProps {
  onSendMessage: (message: string) => void;
  isListening: boolean;
  toggleListening: () => void;
  isSharing: boolean;
  sourceType: VisualSourceType;
  toggleScreenSharing: () => void;
  toggleCamera: () => void;
  onUploadImage: (file: File) => void;
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
  sourceType,
  toggleScreenSharing,
  toggleCamera,
  onUploadImage,
  isLoading,
  isSpeaking,
  micVolume,
  onOpenSettings,
  onGenerateSummary,
  hasConversation,
}) => {
  const [inputValue, setInputValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue);
      setInputValue('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadImage(file);
    }
  };

  return (
    <div className="p-2 md:p-3 bg-gray-800/60 border-t border-gray-700/80">
      <div className="flex items-center space-x-1 sm:space-x-2">
        {/* Camera Toggle Button (Google Meet style for Mobile & Webcam) */}
        <button
          onClick={toggleCamera}
          disabled={isLoading || isListening}
          className={`p-2 rounded-full transition-all duration-200 ${
            sourceType === 'camera'
              ? 'bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-900/50 scale-105'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={sourceType === 'camera' ? 'Desativar Câmera' : 'Ativar Câmera (Ideal para Celular)'}
          aria-label="Câmera"
        >
          {sourceType === 'camera' ? <StopCircleIcon /> : <CameraIcon className="w-5 h-5 text-white" />}
        </button>

        {/* Screen Share Button */}
        <button
          onClick={toggleScreenSharing}
          disabled={isLoading || isListening}
          className={`p-2 rounded-full transition-all duration-200 ${
            sourceType === 'screen'
              ? 'bg-red-500 hover:bg-red-600 shadow-md shadow-red-900/50 scale-105'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={sourceType === 'screen' ? 'Parar Compartilhamento de Tela' : 'Compartilhar Tela (Desktop/Android)'}
          aria-label="Compartilhar tela"
        >
          {sourceType === 'screen' ? <StopCircleIcon /> : <ScreenIcon />}
        </button>

        {/* Live Audio Conversation Button */}
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
          title={isListening ? 'Parar conversa por voz' : 'Iniciar conversa por voz em tempo real'}
          aria-label="Microfone"
        >
          <MicIcon />
        </button>

        {/* Text Input Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex items-center">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={isListening ? "Ouvindo sua voz..." : "Digite sua pergunta..."}
            disabled={isLoading || isListening || isSpeaking}
            className="w-full bg-gray-700/80 border border-gray-600/80 rounded-l-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 text-gray-100 placeholder-gray-400"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim() || isListening}
            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-r-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Enviar mensagem"
          >
            <SendIcon />
          </button>
        </form>

        {/* Image / Gallery Upload Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading || isListening}
          className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors duration-200 disabled:opacity-50 text-gray-300 hover:text-white"
          title="Carregar imagem ou foto da galeria"
          aria-label="Carregar imagem"
        >
          <ImageIcon className="w-5 h-5 text-gray-200" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Download Summary Button */}
        <button
          onClick={onGenerateSummary}
          disabled={isLoading || isListening || !hasConversation}
          className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-gray-200"
          title="Gerar e baixar resumo"
          aria-label="Gerar e baixar resumo"
        >
          <DownloadIcon />
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          disabled={isLoading || isListening}
          className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-gray-200"
          title="Abrir configurações"
          aria-label="Abrir configurações"
        >
          <SettingsIcon />
        </button>
      </div>
    </div>
  );
};
