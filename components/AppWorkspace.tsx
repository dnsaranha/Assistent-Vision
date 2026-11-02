import React from 'react';
import type { User } from 'firebase/auth';
import { Message, Annotation, VisualGuide } from '../types';
import { CaptureType } from '../hooks/useScreenCapture';
import { ConversationView } from './ConversationView';
import { Controls } from './Controls';
import { ScreenPreview } from './ScreenPreview';
import { SettingsModal, Settings } from './SettingsModal';
import { Header } from './Header';
import { AdBanner } from './AdBanner';

interface AppWorkspaceProps {
  user: User;
  signOut: () => void;
  onOpenSettings: () => void;
  isSharing: boolean;
  isLive: boolean;
  splitRatio: number;
  onSetPresetRatio: (ratio: number) => void;
  mainContainerRef: React.RefObject<HTMLDivElement | null>;
  onSplitPointerMove: React.PointerEventHandler<HTMLElement>;
  onSplitPointerUp: React.PointerEventHandler<HTMLElement>;
  onSplitPointerDown: React.PointerEventHandler<HTMLDivElement>;
  isDraggingSplit: boolean;
  isDesktop: boolean;
  stream: MediaStream | null;
  annotations: Annotation[];
  visualGuides: VisualGuide[];
  onClearGuides: () => void;
  onToggleScreenSharing: (mode?: 'screen' | 'camera') => void;
  onUploadScreenshot: (file: File) => void;
  onPasteScreenshot: (dataUrl: string) => void;
  screenshotDataUrl: string | null;
  captureType: CaptureType;
  isMobile: boolean;
  messages: Message[];
  liveMessages: Message[];
  isLoading: boolean;
  onSendMessage: (prompt: string) => void;
  onToggleLiveSession: () => void;
  micVolume: number;
  onGenerateSummary: () => void;
  error: string | null;
  onClearError: () => void;
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  isSettingsOpen: boolean;
  onCloseSettings: () => void;
}

export const AppWorkspace: React.FC<AppWorkspaceProps> = (props) => {
  const {
    user, signOut, onOpenSettings, isSharing, isLive, splitRatio, onSetPresetRatio,
    mainContainerRef, onSplitPointerMove, onSplitPointerUp, onSplitPointerDown,
    isDraggingSplit, isDesktop, stream, annotations, visualGuides, onClearGuides,
    onToggleScreenSharing, onUploadScreenshot, onPasteScreenshot, screenshotDataUrl,
    captureType, isMobile, messages, liveMessages, isLoading, onSendMessage,
    onToggleLiveSession, micVolume, onGenerateSummary, error, onClearError,
    settings, onSettingsChange, isSettingsOpen, onCloseSettings,
  } = props;
  const currentMessages = isLive ? liveMessages : messages;
  const currentLoadingState = isLoading || (isLive && liveMessages.length === 0);
  const screenPercentage = Math.round(splitRatio * 100);
  const chatPercentage = 100 - screenPercentage;

    return (
    <>
      <div className="flex flex-col h-screen w-full bg-gray-950 text-gray-100 font-sans overflow-hidden">
        
        {/* App Header with Vision Logo, PWA Install Button and Google User Profile */}
        <Header
          user={user}
          onSignOut={signOut}
          onOpenSettings={() => onOpenSettings()}
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
              onClick={() => onSetPresetRatio(0.35)}
              className={`px-2 py-0.5 rounded text-[10px] transition cursor-pointer ${
                screenPercentage === 35 ? 'bg-cyan-600 text-white font-bold' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              }`}
              title="Tela compacta (35%)"
            >
              35%
            </button>
            <button
              onClick={() => onSetPresetRatio(0.58)}
              className={`px-2 py-0.5 rounded text-[10px] transition cursor-pointer ${
                screenPercentage === 58 ? 'bg-cyan-600 text-white font-bold' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              }`}
              title="Equilibrado (58%)"
            >
              58%
            </button>
            <button
              onClick={() => onSetPresetRatio(0.75)}
              className={`px-2 py-0.5 rounded text-[10px] transition cursor-pointer ${
                screenPercentage === 75 ? 'bg-cyan-600 text-white font-bold' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              }`}
              title="Visão ampla (75%)"
            >
              75%
            </button>
            <button
              onClick={() => onSetPresetRatio(0.85)}
              className={`px-2 py-0.5 rounded text-[10px] transition cursor-pointer ${
                screenPercentage === 85 ? 'bg-cyan-600 text-white font-bold' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              }`}
              title="Visão máxima (85%)"
            >
              85%
            </button>
          </div>
        </div>

        {/* Main Work Area with Draggable Resizable Split Pane */}
        <main
          ref={mainContainerRef}
          onPointerMove={onSplitPointerMove}
          onPointerUp={onSplitPointerUp}
          className={`flex-1 flex flex-col md:flex-row overflow-hidden relative ${
            isDraggingSplit ? 'select-none cursor-col-resize md:cursor-col-resize' : ''
          }`}
        >
          {/* Pane 1: Screen & Vision Monitor */}
          <div
            style={
              isDesktop
                ? {
                    width: `${screenPercentage}%`,
                    flexBasis: `${screenPercentage}%`,
                    minWidth: '280px',
                    maxWidth: '85%',
                  }
                : {
                    height: `${screenPercentage}%`,
                    flexBasis: `${screenPercentage}%`,
                    minHeight: '190px',
                    maxHeight: '78%',
                  }
            }
            className={`w-full max-w-full flex flex-col overflow-hidden transition-all duration-75 ${
              isDesktop ? 'h-full p-2 md:p-3' : 'p-1.5 sm:p-2 shrink-0'
            }`}
          >
            <ScreenPreview
              stream={stream}
              isSharing={isSharing}
              annotations={annotations}
              visualGuides={visualGuides}
              onClearGuides={() => onClearGuides()}
              onStartScreenShare={onToggleScreenSharing}
              onStopScreenShare={onToggleScreenSharing}
              onUploadScreenshot={onUploadScreenshot}
              onPasteScreenshot={onPasteScreenshot}
              screenshotDataUrl={screenshotDataUrl}
              captureType={captureType}
              isMobile={isMobile}
            />
          </div>

          {/* Draggable Divider Handle */}
          <div
            onPointerDown={onSplitPointerDown}
            className={`group relative flex items-center justify-center shrink-0 z-20 transition-colors duration-150 ${
              isDesktop ? 'cursor-col-resize h-full w-2.5' : 'cursor-row-resize w-full h-3'
            } ${
              isDraggingSplit
                ? 'bg-cyan-500 shadow-lg shadow-cyan-500/50'
                : 'bg-gray-800/90 hover:bg-cyan-500/80 active:bg-cyan-500'
            }`}
            title={
              isDesktop
                ? 'Arraste para redimensionar largura da tela'
                : 'Arraste para redimensionar altura da tela'
            }
          >
            {/* Grip Handle Indicator */}
            <div className="flex items-center justify-center">
              <div
                className={`rounded-full transition-all duration-150 ${
                  isDraggingSplit ? 'bg-white scale-110' : 'bg-gray-400 group-hover:bg-white'
                } ${isDesktop ? 'w-1 h-8' : 'w-12 h-1'}`}
              />
            </div>
          </div>

          {/* Pane 2: Conversation View & Controls */}
          <div
            style={
              isDesktop
                ? {
                    width: `${chatPercentage}%`,
                    flexBasis: `${chatPercentage}%`,
                    minWidth: '280px',
                  }
                : {
                    height: `${chatPercentage}%`,
                    flexBasis: `${chatPercentage}%`,
                    minHeight: '180px',
                  }
            }
            className={`w-full max-w-full flex flex-col flex-1 min-w-0 bg-gray-900/40 overflow-hidden ${
              isDesktop ? 'h-full' : ''
            }`}
          >
            <ConversationView messages={currentMessages} isLoading={currentLoadingState} />
            <Controls
              onSendMessage={onSendMessage}
              isListening={isLive}
              toggleListening={onToggleLiveSession}
              isSharing={isSharing}
              toggleScreenSharing={onToggleScreenSharing}
              isLoading={isLoading}
              isSpeaking={false}
              micVolume={micVolume}
              onOpenSettings={() => onOpenSettings()}
              onGenerateSummary={onGenerateSummary}
              hasConversation={messages.length > 1}
            />
          </div>

          {/* Floating error notification */}
          {error && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-red-600/95 text-white text-xs font-semibold shadow-2xl backdrop-blur-md border border-red-400 flex items-center gap-2 animate-bounce-short">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
              <button onClick={() => onClearError()} className="ml-2 hover:opacity-75">✕</button>
            </div>
          )}
        </main>

        {/* AdMob Bottom Advertising Bar */}
        <AdBanner
          publisherId={settings.adMobPublisherId}
          slotId={settings.adMobSlotId}
          onConfigure={() => onOpenSettings()}
        />
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={onCloseSettings}
        settings={settings}
        onSettingsChange={onSettingsChange}
      />
    </>
  );
};

export default AppWorkspace;
