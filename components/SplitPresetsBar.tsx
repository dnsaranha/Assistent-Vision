import React from 'react';

interface SplitPresetsBarProps {
  presets: readonly [30, 50, 70, 85];
  currentRatio: number;
  isMaximized: boolean;
  onSelectPreset: (ratio: number) => void;
  onToggleMaximize: () => void;
}

export const SplitPresetsBar: React.FC<SplitPresetsBarProps> = ({
  presets,
  currentRatio,
  isMaximized,
  onSelectPreset,
  onToggleMaximize,
}) => {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* Ratio presets */}
      <div className="flex items-center bg-gray-900/90 rounded-lg p-0.5 border border-gray-700/70 shadow-inner">
        {presets.map((preset) => {
          const isActive = !isMaximized && Math.abs(currentRatio - preset) < 2;
          return (
            <button
              key={preset}
              onClick={() => onSelectPreset(preset)}
              className={`px-2 py-1 text-xs font-semibold rounded-md transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm shadow-cyan-900/50 scale-105'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/80'
              }`}
              title={`Definir tela compartilhada em ${preset}%`}
            >
              {preset}%
            </button>
          );
        })}
      </div>

      {/* 1-Click Expand / Restore Button */}
      <button
        onClick={onToggleMaximize}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
          isMaximized
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30 shadow-sm shadow-amber-950/50'
            : 'bg-gray-800/90 hover:bg-gray-700 text-gray-200 border-gray-700 hover:border-cyan-500/50'
        }`}
        title={isMaximized ? 'Restaurar layout dividido (1 clique)' : 'Expandir tela compartilhada (1 clique)'}
      >
        {isMaximized ? (
          <>
            <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            <span className="hidden sm:inline">Restaurar</span>
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            <span className="hidden sm:inline">Expandir</span>
          </>
        )}
      </button>
    </div>
  );
};
