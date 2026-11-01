import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ScreenIcon } from './Icons';
import { Annotation, VisualGuide, GuideType } from '../types';
import { DEMO_SCREENS } from '../utils/demoScreens';
import { ScreenMode } from '../hooks/useScreenCapture';

interface ScreenPreviewProps {
  stream: MediaStream | null;
  isSharing: boolean;
  annotations: Annotation[];
  visualGuides: VisualGuide[];
  screenMode?: ScreenMode;
  activeDemo?: string;
  isNativeSupported?: boolean;
  onSelectDemo?: (demoId: string) => void;
  onUploadImage?: (file: File) => void;
  onPasteImage?: (dataUrl: string) => void;
  onStartScreenShare?: () => void;
  onStopScreenShare?: () => void;
  virtualCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

export const ScreenPreview: React.FC<ScreenPreviewProps> = ({
  stream,
  isSharing,
  annotations,
  visualGuides,
  screenMode = null,
  activeDemo = 'code-editor',
  isNativeSupported = true,
  onSelectDemo,
  onUploadImage,
  onPasteImage,
  onStartScreenShare,
  onStopScreenShare,
  virtualCanvasRef,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showDemoMenu, setShowDemoMenu] = useState(false);

  // Connect native or virtual stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(err => {
          console.debug("Video play event info:", err);
        });
      };
    }
  }, [stream]);

  // Track container size for responsive annotations and visual guides
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
    const resizeObserver = new ResizeObserver(() => updateSize());
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Global paste handler (Ctrl+V / Cmd+V) to load screenshots directly
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result && onPasteImage) {
                onPasteImage(event.target.result as string);
              }
            };
            reader.readAsDataURL(file);
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onPasteImage]);

  // File upload change handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadImage) {
      onUploadImage(file);
    }
    // reset input value so user can re-upload same file if desired
    e.target.value = '';
  };

  // Drag and drop handlers
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
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/') && onUploadImage) {
      onUploadImage(file);
    }
  };

  // Calculate video/canvas render dimensions with object-contain aspect ratio
  const getVideoRenderDimensions = () => {
    if (containerSize.width === 0 || containerSize.height === 0) {
      return { renderWidth: 0, renderHeight: 0, offsetX: 0, offsetY: 0 };
    }

    // Default 16:9 aspect ratio (1280/720) or natural video dimensions
    let videoAspectRatio = 16 / 9;
    if (videoRef.current && videoRef.current.videoWidth && videoRef.current.videoHeight) {
      videoAspectRatio = videoRef.current.videoWidth / videoRef.current.videoHeight;
    }

    const containerAspectRatio = containerSize.width / containerSize.height;

    let renderWidth, renderHeight, offsetX, offsetY;

    if (videoAspectRatio > containerAspectRatio) {
      renderWidth = containerSize.width;
      renderHeight = containerSize.width / videoAspectRatio;
      offsetX = 0;
      offsetY = (containerSize.height - renderHeight) / 2;
    } else {
      renderHeight = containerSize.height;
      renderWidth = containerSize.height * videoAspectRatio;
      offsetY = 0;
      offsetX = (containerSize.width - renderWidth) / 2;
    }

    return { renderWidth, renderHeight, offsetX, offsetY };
  };

  const renderAnnotations = () => {
    if (annotations.length === 0) return null;
    const { renderWidth, renderHeight, offsetX, offsetY } = getVideoRenderDimensions();
    if (renderWidth === 0) return null;

    return annotations.map((ann, index) => (
      <div
        key={`ann-${index}`}
        className="absolute border-2 border-red-500 bg-red-500/30 rounded-md shadow-lg animate-pulse-slow transition-all duration-300 pointer-events-none"
        style={{
          left: `${offsetX + ann.x * renderWidth}px`,
          top: `${offsetY + ann.y * renderHeight}px`,
          width: `${ann.width * renderWidth}px`,
          height: `${ann.height * renderHeight}px`,
        }}
      />
    ));
  };

  const renderVisualGuides = () => {
    if (visualGuides.length === 0) return null;
    const { renderWidth, renderHeight, offsetX, offsetY } = getVideoRenderDimensions();
    if (renderWidth === 0) return null;

    return (
      <svg
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{ left: offsetX, top: offsetY, width: renderWidth, height: renderHeight }}
      >
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#fef08a" />
          </marker>
          <filter id="text-shadow" x="-0.1" y="-0.1" width="1.2" height="1.2">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" />
            <feOffset dx="1" dy="1" result="offsetblur" />
            <feFlood floodColor="rgba(0,0,0,0.8)" />
            <feComposite in2="offsetblur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {visualGuides.map((guide, index) => {
          switch (guide.type) {
            case GuideType.ARROW:
              return (
                <g key={`guide-${index}`}>
                  <line
                    x1={guide.startX * 100 + '%'}
                    y1={guide.startY * 100 + '%'}
                    x2={guide.endX * 100 + '%'}
                    y2={guide.endY * 100 + '%'}
                    stroke="#fef08a"
                    strokeWidth="4"
                    markerEnd="url(#arrowhead)"
                    style={{ filter: 'drop-shadow(2px 2px 2px rgba(0,0,0,0.7))' }}
                  />
                  {guide.label && (
                    <text
                      x={guide.startX * 100 + '%'}
                      y={guide.startY * 100 + '%'}
                      dy="-8"
                      fill="#fef08a"
                      fontSize="16"
                      fontWeight="bold"
                      textAnchor="middle"
                      style={{ filter: 'url(#text-shadow)' }}
                    >
                      {guide.label}
                    </text>
                  )}
                </g>
              );
            case GuideType.TEXT:
              return (
                <text
                  key={`guide-${index}`}
                  x={guide.x * 100 + '%'}
                  y={guide.y * 100 + '%'}
                  fill="#fef08a"
                  fontSize="16"
                  fontWeight="bold"
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  style={{ filter: 'url(#text-shadow)' }}
                >
                  {guide.text}
                </text>
              );
            case GuideType.NUMBER_BADGE:
              return (
                <g
                  key={`guide-${index}`}
                  transform={`translate(${guide.x * renderWidth}, ${guide.y * renderHeight})`}
                >
                  <circle
                    cx="0"
                    cy="0"
                    r="14"
                    fill="#fef08a"
                    style={{ filter: 'drop-shadow(2px 2px 2px rgba(0,0,0,0.7))' }}
                  />
                  <text
                    x="0"
                    y="0"
                    fill="#1f2937"
                    fontSize="16"
                    fontWeight="bold"
                    textAnchor="middle"
                    dy="0.35em"
                  >
                    {guide.number}
                  </text>
                </g>
              );
            default:
              return null;
          }
        })}
      </svg>
    );
  };

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-1 bg-black rounded-lg overflow-hidden border ${
        isDraggingOver ? 'border-cyan-400 ring-2 ring-cyan-500/40' : 'border-gray-700'
      } flex items-center justify-center relative select-none`}
    >
      {/* Hidden file input for screenshot upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {isSharing ? (
        <>
          {/* Main Video Screen Stream */}
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            autoPlay
            playsInline
            muted
          />

          {/* Visual Annotations & Arrows Overlay */}
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            {renderAnnotations()}
            {renderVisualGuides()}
          </div>

          {/* Top Screen Controls Toolbar */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-auto z-30">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-gray-900/85 backdrop-blur-md border border-gray-700 text-gray-200 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                {screenMode === 'virtual' ? 'Tela Interativa (Pronta)' : 'Compartilhamento Nativo'}
              </span>

              {screenMode === 'virtual' && (
                <div className="relative">
                  <button
                    onClick={() => setShowDemoMenu(!showDemoMenu)}
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-800/90 hover:bg-gray-700 border border-gray-600 text-cyan-300 shadow-md flex items-center gap-1 transition-colors"
                  >
                    <span>Cenários de Teste</span>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showDemoMenu && (
                    <div className="absolute top-full left-0 mt-1 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl py-1 z-40">
                      <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                        Escolha um Cenário:
                      </div>
                      {DEMO_SCREENS.map(demo => (
                        <button
                          key={demo.id}
                          onClick={() => {
                            onSelectDemo?.(demo.id);
                            setShowDemoMenu(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs flex flex-col hover:bg-gray-700/80 transition-colors ${
                            activeDemo === demo.id ? 'bg-cyan-950/60 text-cyan-300 font-semibold' : 'text-gray-300'
                          }`}
                        >
                          <span>{demo.name}</span>
                          <span className="text-[10px] text-gray-400 font-normal">{demo.description}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Actions (Upload Print, Colar) */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Carregar um print ou imagem do seu computador"
                className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-800/90 hover:bg-gray-700 border border-gray-600 text-gray-200 shadow-md flex items-center gap-1.5 transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>Enviar Print</span>
              </button>

              <button
                onClick={onStopScreenShare}
                title="Encerrar compartilhamento de tela"
                className="px-2.5 py-1 rounded-md text-xs font-medium bg-red-600/80 hover:bg-red-500 text-white shadow-md transition-colors"
              >
                Parar
              </button>
            </div>
          </div>

          {/* Bottom Hint on How to Paste Print */}
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 pointer-events-none z-20">
            <div className="px-3 py-1 rounded-full bg-gray-900/80 border border-gray-700/60 backdrop-blur-sm text-[11px] text-gray-400 shadow-md">
              Dica: Você pode pressionar <kbd className="text-gray-200 bg-gray-800 px-1 py-0.5 rounded text-[10px]">Ctrl+V</kbd> para colar qualquer print da sua tela
            </div>
          </div>
        </>
      ) : (
        /* Empty / Not Sharing State */
        <div className="text-center p-6 max-w-md flex flex-col items-center">
          <div className="p-4 bg-gray-800/80 border border-gray-700 rounded-2xl mb-4 shadow-lg text-cyan-400">
            <ScreenIcon />
          </div>

          <h2 className="text-lg font-bold text-gray-100 mb-1">
            Compartilhamento de Tela
          </h2>
          <p className="text-xs text-gray-400 mb-5 leading-relaxed">
            Permita que a IA visualize o que está no seu monitor para receber explicações, orientação passo a passo e solução de erros em tempo real.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 w-full justify-center mb-4">
            <button
              onClick={onStartScreenShare}
              className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all transform active:scale-95"
            >
              <ScreenIcon />
              <span>{isNativeSupported ? 'Compartilhar Tela' : 'Iniciar Modo de Tela'}</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 text-xs font-semibold shadow flex items-center justify-center gap-2 transition-all"
            >
              <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Enviar Print/Imagem</span>
            </button>
          </div>

          {/* Quick Demo Screen Options */}
          <div className="w-full bg-gray-800/40 border border-gray-700/60 rounded-xl p-3 text-left">
            <div className="text-[11px] font-medium text-gray-400 mb-2 flex items-center justify-between">
              <span>Ou teste com um cenário pronto:</span>
              <span className="text-[10px] text-cyan-400 font-normal">Clique para abrir</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {DEMO_SCREENS.map(demo => (
                <button
                  key={demo.id}
                  onClick={() => onSelectDemo?.(demo.id)}
                  className="px-2 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-cyan-500/50 text-[11px] text-gray-300 font-medium text-center truncate transition-all"
                  title={demo.description}
                >
                  {demo.name.split(' (')[0]}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-gray-500 mt-3 flex items-center gap-1">
            <span>Dica: Você também pode colar um print diretamente com</span>
            <kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700 font-mono text-[10px]">
              Ctrl+V
            </kbd>
          </p>
        </div>
      )}

      {/* Drag and Drop Fullscreen overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 bg-cyan-900/60 backdrop-blur-sm flex flex-col items-center justify-center border-2 border-dashed border-cyan-400 z-50">
          <svg className="w-12 h-12 text-cyan-300 animate-bounce mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span className="text-sm font-semibold text-white">Solte a imagem para compartilhar</span>
        </div>
      )}
    </div>
  );
};