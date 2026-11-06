import React from 'react';

interface SplitterHandleProps {
  registerRef?: (element: HTMLDivElement | null) => void;
  isDragging: boolean;
  isMobile: boolean;
  onDoubleClick?: () => void;
  onStepChange?: () => void;
}

export const SplitterHandle: React.FC<SplitterHandleProps> = ({
  registerRef,
  isDragging,
  isMobile,
  onDoubleClick,
}) => {
  return (
    <div
      ref={registerRef}
      onDoubleClick={onDoubleClick}
      role="separator"
      aria-orientation={isMobile ? 'horizontal' : 'vertical'}
      tabIndex={0}
      title="Arraste para ajustar o tamanho da tela e do chat."
      className={`group relative flex-shrink-0 select-none z-30 transition-colors ${
        isMobile
          ? 'w-full h-4 cursor-row-resize flex flex-row items-center justify-center bg-gray-800/90 hover:bg-cyan-500/20 border-y border-gray-700/80'
          : 'h-full w-4 cursor-col-resize flex flex-col items-center justify-center bg-gray-800/90 hover:bg-cyan-500/20 border-x border-gray-700/80'
      } ${
        isDragging
          ? '!bg-cyan-500/40 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.7)]'
          : ''
      }`}
      style={{ touchAction: 'none' }}
    >
      {/* Invisible expanded touch hit area (extends 12px beyond border) so thumbs never miss on mobile */}
      <div
        aria-hidden="true"
        className="absolute -inset-3 pointer-events-auto"
        style={{ touchAction: 'none' }}
      />

      {/* Central Tactile Grip Indicator Bar */}
      <div
        className={`rounded-full transition-all duration-150 pointer-events-none flex items-center justify-center ${
          isMobile
            ? 'w-16 h-2 bg-gray-500 group-hover:bg-cyan-400 group-hover:w-24'
            : 'h-16 w-2 bg-gray-500 group-hover:bg-cyan-400 group-hover:h-24'
        } ${isDragging ? '!bg-cyan-300 scale-110 shadow-[0_0_10px_rgba(34,211,238,0.9)]' : ''}`}
      >
        {/* Direction Indicator Dots */}
        <div className={`flex gap-1 ${isMobile ? 'flex-row' : 'flex-col'}`}>
          <span className="w-1 h-1 rounded-full bg-gray-900/80"></span>
          <span className="w-1 h-1 rounded-full bg-gray-900/80"></span>
          <span className="w-1 h-1 rounded-full bg-gray-900/80"></span>
        </div>
      </div>
    </div>
  );
};
