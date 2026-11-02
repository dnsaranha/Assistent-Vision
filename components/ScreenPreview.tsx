import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ScreenIcon } from './Icons';
import { Annotation, VisualGuide, GuideType } from '../types';
import { CaptureType } from '../hooks/useScreenCapture';

interface ScreenPreviewProps {
  stream: MediaStream | null;
  isSharing: boolean;
  annotations: Annotation[];
  visualGuides: VisualGuide[];
  onClearGuides?: () => void;
  onStartScreenShare: (mode?: 'screen' | 'camera') => void;
  onStopScreenShare: () => void;
  onUploadScreenshot?: (file: File) => void;
  onPasteScreenshot?: (dataUrl: string) => void;
  screenshotDataUrl?: string | null;
  captureType?: CaptureType;
  isMobile?: boolean;
}

export const ScreenPreview: React.FC<ScreenPreviewProps> = ({
  stream,
  isSharing,
  annotations,
  visualGuides,
  onClearGuides,
  onStartScreenShare,
  onStopScreenShare,
  onUploadScreenshot,
  onPasteScreenshot,
  screenshotDataUrl,
  captureType,
  isMobile = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraSnapInputRef = useRef<HTMLInputElement>(null);

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isShowingGuides, setIsShowingGuides] = useState<boolean>(true);
  const [showStepsDrawer, setShowStepsDrawer] = useState<boolean>(false);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  // Sync stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch((err) => {
          console.debug('Video play error (handled):', err);
        });
      };
    }
  }, [stream]);

  // Track container dimensions for SVG scaling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      setContainerSize({
        width: container.offsetWidth,
        height: container.offsetHeight,
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // Filter number badge guides to generate the assistant step-by-step roadmap
  const stepGuides = visualGuides
    .filter((g) => g.type === GuideType.NUMBER_BADGE)
    .sort((a: any, b: any) => (a.number ?? 0) - (b.number ?? 0));

  const toggleStepCompleted = (stepNumber: number) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [stepNumber]: !prev[stepNumber],
    }));
  };

  // Drag and drop screenshot upload
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/') && onUploadScreenshot) {
        onUploadScreenshot(file);
      }
    }
  };

  // Paste screenshot from clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!onPasteScreenshot) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                onPasteScreenshot(event.target.result as string);
              }
            };
            reader.readAsDataURL(blob);
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onPasteScreenshot]);

  const hasContent = isSharing || !!screenshotDataUrl;
  const guideCount = visualGuides.length;

  return (
    <div className="relative flex flex-col w-full h-full bg-gray-950 rounded-xl overflow-hidden border border-gray-800 shadow-xl select-none">
      
      {/* Top Bar inside Screen Preview */}
      <div className="bg-gray-900/90 backdrop-blur-md px-3 py-2 border-b border-gray-800 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span
              className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0 ${
                hasContent ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'
              }`}
            />
            <span className="text-xs font-semibold text-gray-200 truncate" title="Monitor de Visão">
              {isSharing
                ? captureType === 'camera'
                  ? 'Câmera ao Vivo'
                  : 'Tela Compartilhada'
                : screenshotDataUrl
                ? 'Captura de Imagem'
                : 'Visão do Assistente'}
            </span>
          </div>

          {guideCount > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              {guideCount} {guideCount === 1 ? 'guia desenhado' : 'guias da IA'}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {guideCount > 0 && (
            <>
              <button
                onClick={() => setIsShowingGuides(!isShowingGuides)}
                className={`px-2 py-1 rounded text-xs font-medium transition ${
                  isShowingGuides
                    ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-600/40'
                    : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-200'
                }`}
                title="Ocultar ou exibir os desenhos do assistente"
              >
                {isShowingGuides ? 'Ocultar Guias' : 'Exibir Guias'}
              </button>

              {stepGuides.length > 0 && (
                <button
                  onClick={() => setShowStepsDrawer(!showStepsDrawer)}
                  className="px-2 py-1 rounded text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition flex items-center gap-1"
                  title="Ver roteiro passo a passo do assistente"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span>Passos ({stepGuides.length})</span>
                </button>
              )}

              {onClearGuides && (
                <button
                  onClick={onClearGuides}
                  className="px-2 py-1 rounded text-xs font-medium text-gray-400 hover:text-red-400 hover:bg-gray-800/80 transition"
                  title="Limpar todos os desenhos da tela"
                >
                  Limpar
                </button>
              )}
            </>
          )}

          {isInIframe && (
            <a
              href={typeof window !== 'undefined' ? window.location.href : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 rounded text-xs font-medium text-cyan-400 hover:bg-cyan-950/60 border border-cyan-500/30 transition flex items-center gap-1"
              title="Abrir em tela cheia numa nova aba"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span className="hidden sm:inline">Nova Aba</span>
            </a>
          )}
        </div>
      </div>

      {/* Main Display Area */}
      <div
        ref={containerRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-gray-950/90 ${
          isDraggingOver ? 'ring-2 ring-cyan-400 bg-cyan-950/20' : ''
        }`}
      >
        {/* Hidden file inputs for upload and camera snap */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0] && onUploadScreenshot) {
              onUploadScreenshot(e.target.files[0]);
            }
          }}
        />
        <input
          ref={cameraSnapInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0] && onUploadScreenshot) {
              onUploadScreenshot(e.target.files[0]);
            }
          }}
        />

        {/* Video feed or screenshot image */}
        {hasContent ? (
          <div className="relative w-full h-full flex items-center justify-center">
            {isSharing ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="max-w-full max-h-full object-contain pointer-events-none"
              />
            ) : (
              screenshotDataUrl && (
                <img
                  src={screenshotDataUrl}
                  alt="Screenshot"
                  className="max-w-full max-h-full object-contain pointer-events-none"
                />
              )
            )}

            {/* SVG Visual Guides & Annotations Rendered Exclusively by AI Assistant */}
            {isShowingGuides && containerSize.width > 0 && containerSize.height > 0 && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none z-10"
                viewBox={`0 0 ${containerSize.width} ${containerSize.height}`}
              >
                <defs>
                  <marker
                    id="guide-arrow"
                    viewBox="0 0 10 10"
                    refX="7"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#38bdf8" />
                  </marker>
                  <marker
                    id="guide-arrow-yellow"
                    viewBox="0 0 10 10"
                    refX="7"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#fef08a" />
                  </marker>
                  <filter id="badge-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.7" />
                  </filter>
                </defs>

                {/* Detected Bounding Box Annotations */}
                {annotations.map((ann, idx) => (
                  <rect
                    key={`ann-${idx}`}
                    x={ann.x * containerSize.width}
                    y={ann.y * containerSize.height}
                    width={ann.width * containerSize.width}
                    height={ann.height * containerSize.height}
                    fill="rgba(56, 189, 248, 0.15)"
                    stroke="#38bdf8"
                    strokeWidth="2.5"
                    strokeDasharray="6 4"
                    rx="6"
                  />
                ))}

                {/* AI Assistant Visual Guides */}
                {visualGuides.map((guide, idx) => {
                  const color = guide.color || '#38bdf8';
                  const strokeWidth = (guide as any).strokeWidth || 3.5;

                  switch (guide.type) {
                    case GuideType.ARROW: {
                      const sx = (guide.startX ?? (guide as any).x ?? 0.5) * containerSize.width;
                      const sy = (guide.startY ?? (guide as any).y ?? 0.5) * containerSize.height;
                      const ex = (guide.endX ?? ((guide as any).x ? (guide as any).x : 0.55)) * containerSize.width;
                      const ey = (guide.endY ?? ((guide as any).y ? (guide as any).y : 0.55)) * containerSize.height;

                      return (
                        <g key={`guide-${idx}`}>
                          <line
                            x1={sx}
                            y1={sy}
                            x2={ex}
                            y2={ey}
                            stroke={color}
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                            markerEnd={color.includes('fef08a') ? 'url(#guide-arrow-yellow)' : 'url(#guide-arrow)'}
                            filter="url(#badge-glow)"
                          />
                          {guide.label && (
                            <g transform={`translate(${(sx + ex) / 2}, ${(sy + ey) / 2 - 14})`}>
                              <rect
                                x={-(guide.label.length * 4.5) - 6}
                                y="-12"
                                width={guide.label.length * 9 + 12}
                                height="22"
                                rx="5"
                                fill="#0f172a"
                                stroke={color}
                                strokeWidth="1.5"
                              />
                              <text
                                x="0"
                                y="2"
                                fill={color}
                                fontSize="11"
                                fontWeight="bold"
                                textAnchor="middle"
                              >
                                {guide.label}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    }

                    case GuideType.CIRCLE: {
                      const cx = (guide.x ?? 0.5) * containerSize.width;
                      const cy = (guide.y ?? 0.5) * containerSize.height;
                      const r = (guide.radius || 0.05) * Math.min(containerSize.width, containerSize.height);

                      return (
                        <g key={`guide-${idx}`}>
                          <circle
                            cx={cx}
                            cy={cy}
                            r={r}
                            fill={guide.fill ? `${color}33` : 'none'}
                            stroke={color}
                            strokeWidth={strokeWidth}
                            strokeDasharray={guide.fill ? 'none' : '4 3'}
                            filter="url(#badge-glow)"
                          />
                          {guide.label && (
                            <g transform={`translate(${cx}, ${cy - r - 12})`}>
                              <rect
                                x={-(guide.label.length * 4.5) - 6}
                                y="-10"
                                width={guide.label.length * 9 + 12}
                                height="20"
                                rx="4"
                                fill="#0f172a"
                                stroke={color}
                                strokeWidth="1"
                              />
                              <text
                                x="0"
                                y="4"
                                fill={color}
                                fontSize="11"
                                fontWeight="bold"
                                textAnchor="middle"
                              >
                                {guide.label}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    }

                    case GuideType.RECT: {
                      const rx = (guide.x ?? 0.1) * containerSize.width;
                      const ry = (guide.y ?? 0.1) * containerSize.height;
                      const rw = (guide.width || 0.2) * containerSize.width;
                      const rh = (guide.height || 0.1) * containerSize.height;

                      return (
                        <g key={`guide-${idx}`}>
                          <rect
                            x={rx}
                            y={ry}
                            width={rw}
                            height={rh}
                            fill={guide.fill ? `${color}25` : 'rgba(56, 189, 248, 0.08)'}
                            stroke={color}
                            strokeWidth={strokeWidth}
                            rx="6"
                            filter="url(#badge-glow)"
                          />
                          {guide.label && (
                            <g transform={`translate(${rx + 8}, ${ry - 12})`}>
                              <rect
                                x="-4"
                                y="-10"
                                width={guide.label.length * 8 + 12}
                                height="20"
                                rx="4"
                                fill="#0f172a"
                                stroke={color}
                                strokeWidth="1"
                              />
                              <text
                                x="2"
                                y="4"
                                fill={color}
                                fontSize="11"
                                fontWeight="bold"
                              >
                                {guide.label}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    }

                    case GuideType.NUMBER_BADGE: {
                      const bx = (guide.x ?? 0.5) * containerSize.width;
                      const by = (guide.y ?? 0.5) * containerSize.height;
                      const isDone = completedSteps[guide.number];

                      return (
                        <g
                          key={`guide-${idx}`}
                          className="pointer-events-auto cursor-pointer"
                          onClick={() => toggleStepCompleted(guide.number)}
                          filter="url(#badge-glow)"
                        >
                          <circle
                            cx={bx}
                            cy={by}
                            r="17"
                            fill={isDone ? '#10b981' : '#f59e0b'}
                            stroke="#ffffff"
                            strokeWidth="2.5"
                          />
                          <text
                            x={bx}
                            y={by + 5}
                            fill="#ffffff"
                            fontSize="13"
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            {isDone ? '✓' : guide.number}
                          </text>
                          {guide.label && (
                            <g transform={`translate(${bx + 24}, ${by + 4})`}>
                              <rect
                                x="-4"
                                y="-12"
                                width={guide.label.length * 8 + 14}
                                height="22"
                                rx="5"
                                fill="#0f172a"
                                stroke={isDone ? '#10b981' : '#f59e0b'}
                                strokeWidth="1.5"
                              />
                              <text
                                x="3"
                                y="3"
                                fill="#ffffff"
                                fontSize="11"
                                fontWeight="600"
                              >
                                {guide.label}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    }

                    case GuideType.TEXT: {
                      const tx = (guide.x ?? 0.5) * containerSize.width;
                      const ty = (guide.y ?? 0.5) * containerSize.height;

                      return (
                        <g key={`guide-${idx}`} transform={`translate(${tx}, ${ty})`}>
                          <rect
                            x="-6"
                            y="-14"
                            width={guide.text.length * 8 + 16}
                            height="24"
                            rx="5"
                            fill="#0f172a"
                            stroke={color}
                            strokeWidth="1.5"
                            filter="url(#badge-glow)"
                          />
                          <text
                            x="2"
                            y="2"
                            fill="#ffffff"
                            fontSize={guide.fontSize || 12}
                            fontWeight="bold"
                          >
                            {guide.text}
                          </text>
                        </g>
                      );
                    }

                    default:
                      return null;
                  }
                })}
              </svg>
            )}
          </div>
        ) : (
          /* Empty State: Ready to Share Screen or Snap Photo */
          <div className="flex flex-col items-center justify-center p-6 text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center text-cyan-400 mb-4 shadow-xl">
              <ScreenIcon />
            </div>

            <h3 className="text-base font-bold text-gray-100 mb-1">
              Pronto para Orientação Visual
            </h3>
            <p className="text-xs text-gray-400 mb-5 leading-relaxed">
              Compartilhe sua tela ou tire uma foto. O assistente analisará o que você vê e desenhará setas, círculos e passos passo a passo.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => onStartScreenShare('screen')}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20 transition cursor-pointer flex items-center gap-1.5"
              >
                <ScreenIcon />
                <span>Compartilhar Tela</span>
              </button>

              <button
                onClick={() => onStartScreenShare('camera')}
                className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold border border-gray-700 transition cursor-pointer flex items-center gap-1.5"
              >
                <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Câmera / Celular</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium border border-gray-700 transition cursor-pointer flex items-center gap-1.5"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Enviar Print</span>
              </button>
            </div>

            <p className="mt-4 text-[11px] text-gray-500">
              Dica: você também pode colar uma imagem da área de transferência pressionando <kbd className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-300">Ctrl+V</kbd>
            </p>
          </div>
        )}

        {/* Step-by-Step Roadmap Drawer */}
        {showStepsDrawer && stepGuides.length > 0 && (
          <div className="absolute top-2 right-2 bottom-2 w-72 max-w-[85%] bg-gray-900/95 border border-gray-700 rounded-xl shadow-2xl backdrop-blur-xl p-3 z-30 flex flex-col animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-gray-800">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <h4 className="text-xs font-bold text-gray-100">Roteiro Passo a Passo</h4>
              </div>
              <button
                onClick={() => setShowStepsDrawer(false)}
                className="text-gray-400 hover:text-white p-1 rounded"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2 space-y-2 pr-1">
              {stepGuides.map((step) => {
                const isDone = completedSteps[step.number];
                return (
                  <div
                    key={`step-list-${step.number}`}
                    onClick={() => toggleStepCompleted(step.number)}
                    className={`p-2 rounded-lg border text-xs cursor-pointer transition flex items-start gap-2.5 ${
                      isDone
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                        : 'bg-gray-800/60 border-gray-700 text-gray-200 hover:border-gray-600'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5 ${
                        isDone ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                      }`}
                    >
                      {isDone ? '✓' : step.number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium ${isDone ? 'line-through opacity-75' : ''}`}>
                        {step.label || `Etapa ${step.number}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-[10px] text-gray-500 pt-2 border-t border-gray-800 text-center">
              Clique em um passo para marcar como concluído
            </p>
          </div>
        )}
      </div>

      {/* Floating Stop Share Button when active */}
      {isSharing && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={onStopScreenShare}
            className="px-4 py-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/30 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>Parar Compartilhamento</span>
          </button>
        </div>
      )}
    </div>
  );
};