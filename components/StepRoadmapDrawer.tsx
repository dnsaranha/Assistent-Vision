import React from 'react';

export interface RoadmapStep {
  number: number;
  label?: string;
}

interface StepRoadmapDrawerProps {
  isOpen: boolean;
  steps: RoadmapStep[];
  completedSteps: Record<number, boolean>;
  onToggleStep: (number: number) => void;
  onClose: () => void;
}

export const StepRoadmapDrawer: React.FC<StepRoadmapDrawerProps> = ({
  isOpen, steps, completedSteps, onToggleStep, onClose,
}) => {
  if (!isOpen || steps.length === 0) return null;

  return (
    <div className="absolute top-2 right-2 bottom-2 w-72 max-w-[85%] bg-gray-900/95 border border-gray-700 rounded-xl shadow-2xl backdrop-blur-xl p-3 z-30 flex flex-col animate-fade-in">
      <div className="flex items-center justify-between pb-2 border-b border-gray-800">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <h4 className="text-xs font-bold text-gray-100">Roteiro Passo a Passo</h4>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded" aria-label="Fechar roteiro">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2 space-y-2 pr-1">
        {steps.map((step) => {
          const isDone = completedSteps[step.number];
          return (
            <button
              type="button"
              key={`step-list-${step.number}`}
              onClick={() => onToggleStep(step.number)}
              aria-pressed={!!isDone}
              className={`w-full text-left p-2 rounded-lg border text-xs cursor-pointer transition flex items-start gap-2.5 ${
                isDone
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                  : 'bg-gray-800/60 border-gray-700 text-gray-200 hover:border-gray-600'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5 ${
                isDone ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
              }`}>
                {isDone ? '✓' : step.number}
              </span>
              <span className={`flex-1 min-w-0 font-medium ${isDone ? 'line-through opacity-75' : ''}`}>
                {step.label || `Etapa ${step.number}`}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-gray-500 pt-2 border-t border-gray-800 text-center">
        Clique em um passo para marcar como concluído
      </p>
    </div>
  );
};
