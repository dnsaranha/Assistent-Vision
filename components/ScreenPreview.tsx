import React, { useRef, useEffect, useState } from 'react';
import { ScreenIcon } from './Icons';
import { Annotation, VisualGuide, GuideType } from '../types';

interface ScreenPreviewProps {
  stream: MediaStream | null;
  isSharing: boolean;
  annotations: Annotation[];
  visualGuides: VisualGuide[];
}

export const ScreenPreview: React.FC<ScreenPreviewProps> = ({ stream, isSharing, annotations, visualGuides }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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
       <svg className="absolute top-0 left-0 w-full h-full" style={{ left: offsetX, top: offsetY, width: renderWidth, height: renderHeight }} >
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
    )
  }

  return (
    <div ref={containerRef} className="flex-1 bg-black rounded-lg overflow-hidden border border-gray-700 flex items-center justify-center relative">
      {isSharing && stream ? (
        <>
          <video ref={videoRef} className="w-full h-full object-contain" muted />
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            {renderAnnotations()}
            {renderVisualGuides()}
          </div>
        </>
      ) : (
        <div className="text-center text-gray-500">
            <div className="inline-block p-4 bg-gray-800 rounded-full mb-4">
                <ScreenIcon />
            </div>
            <p className="text-lg font-semibold">O compartilhamento de tela está desativado</p>
            <p className="text-sm">Clique no ícone de tela abaixo para começar a compartilhar.</p>
        </div>
      )}
    </div>
  );
};