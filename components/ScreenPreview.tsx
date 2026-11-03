import React, { useRef, useEffect, useState } from 'react';
import { ScreenIcon, CameraIcon, FlipCameraIcon, ImageIcon } from './Icons';
import { Annotation, VisualGuide, GuideType } from '../types';
import { VisualSourceType } from '../hooks/useScreenCapture';

interface ScreenPreviewProps {
  stream: MediaStream | null;
  isSharing: boolean;
  sourceType: VisualSourceType;
  facingMode: 'environment' | 'user';
  customImage: string | null;
  annotations: Annotation[];
  visualGuides: VisualGuide[];
  onStartScreen: () => void;
  onStartCamera: () => void;
  onToggleCamera: () => void;
  onUploadImage: (file: File) => void;
}

export const ScreenPreview: React.FC<ScreenPreviewProps> = ({
  stream,
  isSharing,
  sourceType,
  facingMode,
  customImage,
  annotations,
  visualGuides,
  onStartScreen,
  onStartCamera,
  onToggleCamera,
  onUploadImage,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(err => console.error("Video play failed:", err));
      };
    }
  }, [stream]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      setContainerSize({
        width: container.offsetWidth,
        height: container.offsetHeight,
      });
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const getVideoRenderDimensions = () => {
    if (customImage) {
      // For static image, fit inside container
      return { renderWidth: containerSize.width, renderHeight: containerSize.height, offsetX: 0, offsetY: 0 };
    }

    if (!videoRef.current || containerSize.width === 0 || !videoRef.current.videoWidth) {
      return { renderWidth: 0, renderHeight: 0, offsetX: 0, offsetY: 0 };
    }

    const videoAspectRatio = videoRef.current.videoWidth / videoRef.current.videoHeight;
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
        className="absolute border-2 border-red-500 bg-red-500/30 rounded-md shadow-lg animate-pulse-slow transition-all duration-300"
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
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ left: offsetX, top: offsetY, width: renderWidth, height: renderHeight }}>
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#fef08a" />
          </marker>
          <filter id="text-shadow" x="-0.1" y="-0.1" width="1.2" height="1.2">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.5"/>
            <feOffset dx="1" dy="1" result="offsetblur"/>
            <feFlood floodColor="rgba(0,0,0,0.8)"/>
            <feComposite in2="offsetblur" operator="in"/>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
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
                <g key={`guide-${index}`} transform={`translate(${guide.x * renderWidth}, ${guide.y * renderHeight})`}>
                  <circle cx="0" cy="0" r="14" fill="#fef08a" style={{ filter: 'drop-shadow(2px 2px 2px rgba(0,0,0,0.7))' }}/>
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

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadImage(file);
    }
  };

  return (
    <div ref={containerRef} className="flex-1 bg-black rounded-lg overflow-hidden border border-gray-700 flex items-center justify-center relative shadow-inner">
      {isSharing ? (
        <>
          {customImage ? (
            <img src={customImage} alt="Captura de tela enviada" className="w-full h-full object-contain" />
          ) : (
            <video ref={videoRef} className="w-full h-full object-contain" playsInline muted />
          )}

          {/* Overlaid Annotations and Guides */}
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            {renderAnnotations()}
            {renderVisualGuides()}
          </div>

          {/* Top Floating Badge & Action Bar */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-auto">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-gray-700 text-xs font-semibold text-gray-200 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>
                {sourceType === 'screen'
                  ? 'Tela Compartilhada'
                  : sourceType === 'camera'
                  ? `Câmera (${facingMode === 'environment' ? 'Traseira' : 'Frontal'})`
                  : 'Imagem Carregada'}
              </span>
            </div>

            {sourceType === 'camera' && (
              <button
                onClick={onToggleCamera}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-600/90 hover:bg-cyan-500 text-white text-xs font-medium shadow-lg backdrop-blur-md transition-all active:scale-95 border border-cyan-400/50"
                title="Trocar entre câmera frontal e traseira"
              >
                <FlipCameraIcon className="w-3.5 h-3.5" />
                <span>Trocar Câmera</span>
              </button>
            )}
          </div>
        </>
      ) : (
        /* Empty State with Mobile-friendly & Google Meet-like Camera Options */
        <div className="text-center text-gray-400 p-4 max-w-md flex flex-col items-center">
          <div className="p-3.5 bg-gray-800/80 rounded-2xl mb-3 border border-gray-700/60 shadow-lg flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <ScreenIcon />
            </div>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <CameraIcon />
            </div>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-gray-200 mb-1">
            Transmissão Visual Desativada
          </h3>
          <p className="text-xs sm:text-sm text-gray-400 mb-4">
            Escolha como a IA verá sua tela ou ambiente para te ajudar em tempo real:
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 w-full max-w-sm">
            <button
              onClick={onStartCamera}
              className="flex-1 min-w-[130px] flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium text-xs shadow-md transition-all active:scale-95"
            >
              <CameraIcon className="w-4 h-4" />
              <span>Usar Câmera (Celular)</span>
            </button>

            <button
              onClick={onStartScreen}
              className="flex-1 min-w-[130px] flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 font-medium text-xs shadow-md transition-all active:scale-95"
            >
              <ScreenIcon />
              <span>Compartilhar Tela</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/60 hover:bg-gray-800 text-gray-300 border border-gray-700/60 text-xs transition-all active:scale-95"
            >
              <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>Enviar Screenshot ou Foto da Galeria</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileInputChange}
            />
          </div>

          <p className="text-[11px] text-gray-400 mt-3 flex items-center gap-1">
            <span className="text-cyan-400">💡 No Celular:</span>
            <span>A Câmera funciona em qualquer aparelho (iOS e Android), igual ao Google Meet!</span>
          </p>
        </div>
      )}
    </div>
  );
};