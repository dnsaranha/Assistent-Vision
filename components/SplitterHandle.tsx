import React from 'react';

interface SplitterHandleProps {
  onPointerDown: (e: React.PointerEvent) => void;
  isDragging: boolean;
  isMobile: boolean;
  onDoubleClick?: () => void;
}

export const SplitterHandle: React.FC<SplitterHandleProps> = ({
  onPointerDown,
  isDragging,
  isMobile,
  onDoubleClick,
}) => {
  return (
    <div
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      role="separator"
      aria-orientation={isMobile ? 'horizontal' : 'vertical'}
      tabIndex={0}
      title="Arraste para redimensionar a tela e o chat. Clique duas vezes para alternar."
      className={`group relative flex-shrink-0 transition-all select-none z-30 ${
        isMobile
          ? 'w-full h-3 cursor-row-resize flex flex-row items-center justify-center bg-gray-800/80 hover:bg-cyan-500/30 border-y border-gray-700/60'
          : 'h-full w-3 cursor-col-resize flex flex-col items-center justify-center bg-gray-800/80 hover:bg-cyan-500/30 border-x border-gray-700/60'
      } ${
        isDragging
          ? 'bg-cyan-500/40 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.5)]'
          : ''
      }`}
      style={{ touchAction: 'none' }}
    >
      {/* Central Grip Indicator */}
      <div
        className={`rounded-full transition-all duration-200 ${
          isMobile
            ? 'w-12 h-1.5 bg-gray-500 group-hover:bg-cyan-400 group-hover:w-16'
            : 'h-12 w-1.5 bg-gray-500 group-hover:bg-cyan-400 group-hover:h-16'
        } ${isDragging ? 'bg-cyan-300 scale-110 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : ''}`}
      />

      {/* Subtle Dots for tactile feel */}
      <div
        className={`absolute pointer-events-none flex opacity-0 group-hover:opacity-100 transition-opacity ${
          isMobile ? 'flex-row gap-1' : 'flex-col gap-1'
        }`}
      >
        <span className="w-1 h-1 rounded-full bg-cyan-200"></span>
        <span className="w-1 h-1 rounded-full bg-cyan-200"></span>
        <span className="w-1 h-1 rounded-full bg-cyan-200"></span>
      </div>
    </div>
  );
};
