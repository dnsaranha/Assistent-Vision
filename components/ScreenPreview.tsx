import React, { useRef, useEffect, useState, useMemo } from 'react';
import { ScreenIcon, CameraIcon, FlipCameraIcon, ImageIcon } from './Icons';
import { Annotation, VisualGuide, GuideType, NumberBadgeGuide } from '../types';
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
  onClearVisualGuides?: () => void;
}

// Preset color map for robust contrast over any screen/video content
const COLOR_MAP: Record<string, { stroke: string; fill: string; text: string; bg: string }> = {
  yellow: { stroke: '#facc15', fill: 'rgba(250, 204, 21, 0.25)', text: '#fef08a', bg: 'rgba(234, 179, 8, 0.2)' },
  cyan: { stroke: '#38bdf8', fill: 'rgba(56, 189, 248, 0.25)', text: '#bae6fd', bg: 'rgba(14, 165, 233, 0.2)' },
  green: { stroke: '#4ade80', fill: 'rgba(74, 222, 128, 0.25)', text: '#bbf7d0', bg: 'rgba(34, 197, 94, 0.2)' },
  red: { stroke: '#f87171', fill: 'rgba(248, 113, 113, 0.25)', text: '#fecaca', bg: 'rgba(239, 68, 68, 0.2)' },
  purple: { stroke: '#c084fc', fill: 'rgba(192, 132, 252, 0.25)', text: '#e9d5ff', bg: 'rgba(168, 85, 247, 0.2)' },
  orange: { stroke: '#fb923c', fill: 'rgba(251, 146, 60, 0.25)', text: '#fed7aa', bg: 'rgba(249, 115, 22, 0.2)' },
};

function resolveColor(colorNameOrHex?: string): { stroke: string; fill: string; text: string; bg: string } {
  if (!colorNameOrHex) {
    return COLOR_MAP.cyan;
  }
  const lower = colorNameOrHex.toLowerCase();
  if (COLOR_MAP[lower]) {
    return COLOR_MAP[lower];
  }
  if (colorNameOrHex.startsWith('#')) {
    return {
      stroke: colorNameOrHex,
      fill: `${colorNameOrHex}33`,
      text: '#ffffff',
      bg: `${colorNameOrHex}22`,
    };
  }
  return COLOR_MAP.cyan;
}

function toSafeNumber(val: any): number | null {
  if (val === null || val === undefined) return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val));
  return Number.isFinite(n) ? n : null;
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
  onClearVisualGuides,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);

  // Extract all number badge guides with valid coordinates for step tour
  const stepGuides = useMemo(() => {
    return visualGuides
      .filter((g): g is NumberBadgeGuide => {
        if (g.type !== GuideType.NUMBER_BADGE) return false;
        const normX = toSafeNumber(g.x);
        const normY = toSafeNumber(g.y);
        return normX !== null && normY !== null;
      })
      .sort((a, b) => (toSafeNumber(a.number) || 0) - (toSafeNumber(b.number) || 0));
  }, [visualGuides]);

  // Keep active step index in valid range
  useEffect(() => {
    if (activeStepIndex >= stepGuides.length) {
      setActiveStepIndex(Math.max(0, stepGuides.length - 1));
    }
  }, [stepGuides.length, activeStepIndex]);

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
    const cWidth = toSafeNumber(containerSize.width) || 0;
    const cHeight = toSafeNumber(containerSize.height) || 0;

    if (customImage) {
      return { renderWidth: cWidth, renderHeight: cHeight, offsetX: 0, offsetY: 0 };
    }

    const vWidth = toSafeNumber(videoRef.current?.videoWidth) || 0;
    const vHeight = toSafeNumber(videoRef.current?.videoHeight) || 0;

    if (!videoRef.current || cWidth <= 0 || cHeight <= 0 || vWidth <= 0 || vHeight <= 0) {
      return { renderWidth: 0, renderHeight: 0, offsetX: 0, offsetY: 0 };
    }

    const videoAspectRatio = vWidth / vHeight;
    const containerAspectRatio = cWidth / cHeight;

    if (!Number.isFinite(videoAspectRatio) || !Number.isFinite(containerAspectRatio) || videoAspectRatio <= 0 || containerAspectRatio <= 0) {
      return { renderWidth: 0, renderHeight: 0, offsetX: 0, offsetY: 0 };
    }

    let renderWidth = 0;
    let renderHeight = 0;
    let offsetX = 0;
    let offsetY = 0;

    if (videoAspectRatio > containerAspectRatio) {
      renderWidth = cWidth;
      renderHeight = cWidth / videoAspectRatio;
      offsetX = 0;
      offsetY = (cHeight - renderHeight) / 2;
    } else {
      renderHeight = cHeight;
      renderWidth = cHeight * videoAspectRatio;
      offsetY = 0;
      offsetX = (cWidth - renderWidth) / 2;
    }

    if (!Number.isFinite(renderWidth) || !Number.isFinite(renderHeight) || !Number.isFinite(offsetX) || !Number.isFinite(offsetY)) {
      return { renderWidth: 0, renderHeight: 0, offsetX: 0, offsetY: 0 };
    }

    return { renderWidth, renderHeight, offsetX, offsetY };
  };

  const { renderWidth, renderHeight, offsetX, offsetY } = getVideoRenderDimensions();

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadImage(file);
    }
  };

  const totalAnnotations = annotations.length + visualGuides.length;
  const hasValidDimensions =
    renderWidth > 0 &&
    renderHeight > 0 &&
    Number.isFinite(renderWidth) &&
    Number.isFinite(renderHeight) &&
    Number.isFinite(offsetX) &&
    Number.isFinite(offsetY);

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 min-w-0 w-full h-full bg-black rounded-lg overflow-hidden border border-gray-700 flex items-center justify-center relative shadow-inner"
    >
      {isSharing ? (
        <>
          {customImage ? (
            <img src={customImage} alt="Captura de tela enviada" className="w-full h-full object-contain" />
          ) : (
            <video ref={videoRef} className="w-full h-full object-contain" playsInline muted />
          )}

          {/* SVG Overlay for rich drawings, arrows, shapes, and steps */}
          {hasValidDimensions && (
            <svg
              className="absolute pointer-events-none"
              style={{
                left: `${offsetX}px`,
                top: `${offsetY}px`,
                width: `${renderWidth}px`,
                height: `${renderHeight}px`,
              }}
              viewBox={`0 0 ${renderWidth} ${renderHeight}`}
            >
              <defs>
                {/* Arrowhead Markers for each color */}
                {Object.entries(COLOR_MAP).map(([key, val]) => (
                  <marker
                    key={`arrow-${key}`}
                    id={`arrowhead-${key}`}
                    markerWidth="12"
                    markerHeight="9"
                    refX="10"
                    refY="4.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 12 4.5, 0 9, 2.5 4.5" fill={val.stroke} />
                  </marker>
                ))}
                {/* Default Arrowhead */}
                <marker
                  id="arrowhead-default"
                  markerWidth="12"
                  markerHeight="9"
                  refX="10"
                  refY="4.5"
                  orient="auto"
                >
                  <polygon points="0 0, 12 4.5, 0 9, 2.5 4.5" fill="#38bdf8" />
                </marker>

                {/* Drop shadow filter for readability over dark or light background */}
                <filter id="draw-shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.85" />
                </filter>
              </defs>

              {/* Connecting dashed paths between sequential step badges */}
              {stepGuides.length > 1 && (
                <g className="step-connectors opacity-75">
                  {stepGuides.map((guide, idx) => {
                    if (idx === stepGuides.length - 1) return null;
                    const next = stepGuides[idx + 1];
                    const gX = toSafeNumber(guide.x);
                    const gY = toSafeNumber(guide.y);
                    const nX = toSafeNumber(next.x);
                    const nY = toSafeNumber(next.y);
                    if (gX === null || gY === null || nX === null || nY === null) return null;

                    const x1 = gX * renderWidth;
                    const y1 = gY * renderHeight;
                    const x2 = nX * renderWidth;
                    const y2 = nY * renderHeight;
                    if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) {
                      return null;
                    }

                    return (
                      <line
                        key={`connector-${idx}`}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#38bdf8"
                        strokeWidth="2.5"
                        strokeDasharray="6 4"
                        filter="url(#draw-shadow)"
                      />
                    );
                  })}
                </g>
              )}

              {/* Render Bounding Box Annotations with strict finite coordinate checks */}
              {annotations.map((ann, index) => {
                const normX = toSafeNumber(ann?.x);
                const normY = toSafeNumber(ann?.y);
                const normW = toSafeNumber(ann?.width);
                const normH = toSafeNumber(ann?.height);

                if (normX === null || normY === null || normW === null || normH === null || normW <= 0 || normH <= 0) {
                  return null;
                }

                const x = normX * renderWidth;
                const y = normY * renderHeight;
                const w = normW * renderWidth;
                const h = normH * renderHeight;

                if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
                  return null;
                }

                const labelStr = typeof ann.label === 'string' ? ann.label : '';

                return (
                  <g key={`ann-${index}`} filter="url(#draw-shadow)">
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      rx="6"
                      fill="rgba(239, 68, 68, 0.2)"
                      stroke="#ef4444"
                      strokeWidth="2.5"
                      strokeDasharray="4 2"
                    />
                    {labelStr && (
                      <g transform={`translate(${x}, ${Math.max(16, y - 6)})`}>
                        <rect
                          x="0"
                          y="-16"
                          width={Math.max(40, labelStr.length * 8 + 12)}
                          height="20"
                          rx="4"
                          fill="#ef4444"
                        />
                        <text
                          x="6"
                          y="-2"
                          fill="#ffffff"
                          fontSize="11"
                          fontWeight="bold"
                          fontFamily="sans-serif"
                        >
                          {labelStr}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Render Visual Guides with strict finite coordinate validation */}
              {visualGuides.map((guide, index) => {
                const colorConfig = resolveColor(guide?.color);
                const markerColorKey = guide?.color && COLOR_MAP[guide.color.toLowerCase()]
                  ? guide.color.toLowerCase()
                  : 'default';

                switch (guide?.type) {
                  case GuideType.ARROW: {
                    const normSX = toSafeNumber(guide.startX);
                    const normSY = toSafeNumber(guide.startY);
                    const normEX = toSafeNumber(guide.endX);
                    const normEY = toSafeNumber(guide.endY);

                    if (normSX === null || normSY === null || normEX === null || normEY === null) {
                      return null;
                    }

                    const x1 = normSX * renderWidth;
                    const y1 = normSY * renderHeight;
                    const x2 = normEX * renderWidth;
                    const y2 = normEY * renderHeight;

                    if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) {
                      return null;
                    }

                    const isDashed = guide.style === 'dashed';
                    const labelStr = typeof guide.label === 'string' ? guide.label : '';

                    return (
                      <g key={`guide-arrow-${index}`} filter="url(#draw-shadow)">
                        <line
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke={colorConfig.stroke}
                          strokeWidth="3.5"
                          strokeDasharray={isDashed ? '6 4' : undefined}
                          markerEnd={`url(#arrowhead-${markerColorKey})`}
                        />
                        <circle cx={x1} cy={y1} r="3.5" fill={colorConfig.stroke} />
                        {labelStr && (
                          <g transform={`translate(${(x1 + x2) / 2}, ${(y1 + y2) / 2 - 10})`}>
                            <rect
                              x={-((labelStr.length * 7.5 + 14) / 2)}
                              y="-16"
                              width={labelStr.length * 7.5 + 14}
                              height="22"
                              rx="6"
                              fill="#0f172a"
                              stroke={colorConfig.stroke}
                              strokeWidth="1.5"
                              opacity="0.95"
                            />
                            <text
                              x="0"
                              y="0"
                              fill={colorConfig.text}
                              fontSize="12"
                              fontWeight="bold"
                              textAnchor="middle"
                              alignmentBaseline="middle"
                            >
                              {labelStr}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  }

                  case GuideType.RECTANGLE: {
                    const normX = toSafeNumber(guide.x);
                    const normY = toSafeNumber(guide.y);
                    const normW = toSafeNumber(guide.width);
                    const normH = toSafeNumber(guide.height);

                    if (normX === null || normY === null || normW === null || normH === null || normW <= 0 || normH <= 0) {
                      return null;
                    }

                    const x = normX * renderWidth;
                    const y = normY * renderHeight;
                    const w = normW * renderWidth;
                    const h = normH * renderHeight;

                    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
                      return null;
                    }

                    const isDashed = guide.style === 'dashed';
                    const fill = guide.filled ? colorConfig.fill : 'transparent';
                    const labelStr = typeof guide.label === 'string' ? guide.label : '';

                    return (
                      <g key={`guide-rect-${index}`} filter="url(#draw-shadow)">
                        <rect
                          x={x}
                          y={y}
                          width={w}
                          height={h}
                          rx="8"
                          fill={fill}
                          stroke={colorConfig.stroke}
                          strokeWidth="3"
                          strokeDasharray={isDashed ? '7 5' : undefined}
                        />
                        {labelStr && (
                          <g transform={`translate(${x + 4}, ${Math.max(16, y - 6)})`}>
                            <rect
                              x="0"
                              y="-16"
                              width={labelStr.length * 7.5 + 16}
                              height="22"
                              rx="5"
                              fill="#0f172a"
                              stroke={colorConfig.stroke}
                              strokeWidth="1.5"
                            />
                            <text
                              x="8"
                              y="-1"
                              fill={colorConfig.text}
                              fontSize="11"
                              fontWeight="bold"
                            >
                              {labelStr}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  }

                  case GuideType.CIRCLE: {
                    const normCX = toSafeNumber(guide.centerX ?? guide.x);
                    const normCY = toSafeNumber(guide.centerY ?? guide.y);
                    const normRX = toSafeNumber(guide.radiusX ?? (guide.width != null ? guide.width / 2 : null));
                    const normRY = toSafeNumber(guide.radiusY ?? guide.radiusX ?? (guide.height != null ? guide.height / 2 : normRX));

                    if (normCX === null || normCY === null || normRX === null || normRX <= 0) {
                      return null;
                    }

                    const cx = normCX * renderWidth;
                    const cy = normCY * renderHeight;
                    const rx = normRX * renderWidth;
                    const ry = (normRY ?? normRX) * renderHeight;

                    if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(rx) || !Number.isFinite(ry) || rx <= 0 || ry <= 0) {
                      return null;
                    }

                    const shouldPulse = guide.pulse ?? true;
                    const labelStr = typeof guide.label === 'string' ? guide.label : '';

                    return (
                      <g key={`guide-circle-${index}`} filter="url(#draw-shadow)">
                        {shouldPulse && (
                          <ellipse
                            cx={cx}
                            cy={cy}
                            rx={rx + 6}
                            ry={ry + 6}
                            fill="none"
                            stroke={colorConfig.stroke}
                            strokeWidth="2"
                            opacity="0.5"
                            className="animate-ping"
                          />
                        )}
                        <ellipse
                          cx={cx}
                          cy={cy}
                          rx={rx}
                          ry={ry}
                          fill={colorConfig.fill}
                          stroke={colorConfig.stroke}
                          strokeWidth="3"
                        />
                        {labelStr && (
                          <g transform={`translate(${cx}, ${cy - ry - 10})`}>
                            <rect
                              x={-((labelStr.length * 7.5 + 14) / 2)}
                              y="-14"
                              width={labelStr.length * 7.5 + 14}
                              height="20"
                              rx="4"
                              fill="#0f172a"
                              stroke={colorConfig.stroke}
                              strokeWidth="1.5"
                            />
                            <text
                              x="0"
                              y="0"
                              fill={colorConfig.text}
                              fontSize="11"
                              fontWeight="bold"
                              textAnchor="middle"
                              alignmentBaseline="middle"
                            >
                              {labelStr}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  }

                  case GuideType.HIGHLIGHT: {
                    const normX = toSafeNumber(guide.x);
                    const normY = toSafeNumber(guide.y);
                    const normW = toSafeNumber(guide.width);
                    const normH = toSafeNumber(guide.height);

                    if (normX === null || normY === null || normW === null || normH === null || normW <= 0 || normH <= 0) {
                      return null;
                    }

                    const x = normX * renderWidth;
                    const y = normY * renderHeight;
                    const w = normW * renderWidth;
                    const h = normH * renderHeight;

                    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
                      return null;
                    }

                    return (
                      <g key={`guide-highlight-${index}`}>
                        <rect
                          x={x}
                          y={y}
                          width={w}
                          height={h}
                          rx="4"
                          fill={colorConfig.fill || 'rgba(250, 204, 21, 0.35)'}
                          stroke={colorConfig.stroke}
                          strokeWidth="1.5"
                          opacity="0.85"
                          filter="url(#draw-shadow)"
                        />
                      </g>
                    );
                  }

                  case GuideType.LINE: {
                    const normSX = toSafeNumber(guide.startX);
                    const normSY = toSafeNumber(guide.startY);
                    const normEX = toSafeNumber(guide.endX);
                    const normEY = toSafeNumber(guide.endY);

                    if (normSX === null || normSY === null || normEX === null || normEY === null) {
                      return null;
                    }

                    const x1 = normSX * renderWidth;
                    const y1 = normSY * renderHeight;
                    const x2 = normEX * renderWidth;
                    const y2 = normEY * renderHeight;

                    if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) {
                      return null;
                    }

                    const isDashed = guide.style === 'dashed';
                    const labelStr = typeof guide.label === 'string' ? guide.label : '';

                    return (
                      <g key={`guide-line-${index}`} filter="url(#draw-shadow)">
                        <line
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke={colorConfig.stroke}
                          strokeWidth="3"
                          strokeDasharray={isDashed ? '6 4' : undefined}
                        />
                        {labelStr && (
                          <g transform={`translate(${(x1 + x2) / 2}, ${(y1 + y2) / 2 - 10})`}>
                            <rect
                              x={-((labelStr.length * 7.5 + 12) / 2)}
                              y="-12"
                              width={labelStr.length * 7.5 + 12}
                              height="18"
                              rx="4"
                              fill="#0f172a"
                              stroke={colorConfig.stroke}
                              strokeWidth="1"
                            />
                            <text
                              x="0"
                              y="1"
                              fill={colorConfig.text}
                              fontSize="11"
                              fontWeight="bold"
                              textAnchor="middle"
                              alignmentBaseline="middle"
                            >
                              {labelStr}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  }

                  case GuideType.TEXT: {
                    const normX = toSafeNumber(guide.x);
                    const normY = toSafeNumber(guide.y);

                    if (normX === null || normY === null) {
                      return null;
                    }

                    const x = normX * renderWidth;
                    const y = normY * renderHeight;

                    if (!Number.isFinite(x) || !Number.isFinite(y)) {
                      return null;
                    }

                    const textContent = typeof guide.text === 'string' ? guide.text : '';
                    const textLen = textContent.length || 5;
                    const boxWidth = Math.max(60, textLen * 8.2 + 18);

                    return (
                      <g key={`guide-text-${index}`} transform={`translate(${x}, ${y})`} filter="url(#draw-shadow)">
                        <rect
                          x={-(boxWidth / 2)}
                          y="-16"
                          width={boxWidth}
                          height="28"
                          rx="6"
                          fill={guide.backgroundColor || '#0f172a'}
                          stroke={colorConfig.stroke}
                          strokeWidth="1.5"
                          opacity="0.95"
                        />
                        <text
                          x="0"
                          y="-1"
                          fill={colorConfig.text}
                          fontSize="12"
                          fontWeight="bold"
                          textAnchor="middle"
                          alignmentBaseline="middle"
                        >
                          {textContent}
                        </text>
                      </g>
                    );
                  }

                  case GuideType.NUMBER_BADGE: {
                    const normX = toSafeNumber(guide.x);
                    const normY = toSafeNumber(guide.y);

                    if (normX === null || normY === null) {
                      return null;
                    }

                    const x = normX * renderWidth;
                    const y = normY * renderHeight;

                    if (!Number.isFinite(x) || !Number.isFinite(y)) {
                      return null;
                    }

                    const isSelected = stepGuides[activeStepIndex]?.number === guide.number;
                    const titleStr = typeof guide.title === 'string' ? guide.title : '';

                    return (
                      <g
                        key={`guide-badge-${index}`}
                        transform={`translate(${x}, ${y})`}
                        filter="url(#draw-shadow)"
                        className="transition-transform duration-200"
                      >
                        {isSelected && (
                          <circle
                            cx="0"
                            cy="0"
                            r="22"
                            fill="none"
                            stroke="#38bdf8"
                            strokeWidth="3"
                            className="animate-pulse"
                            opacity="0.8"
                          />
                        )}
                        <circle
                          cx="0"
                          cy="0"
                          r="16"
                          fill={isSelected ? '#0284c7' : '#0f172a'}
                          stroke={isSelected ? '#38bdf8' : colorConfig.stroke}
                          strokeWidth="2.5"
                        />
                        <text
                          x="0"
                          y="1"
                          fill="#ffffff"
                          fontSize="13"
                          fontWeight="bold"
                          textAnchor="middle"
                          alignmentBaseline="middle"
                        >
                          {guide.number ?? 1}
                        </text>

                        {titleStr && (
                          <g transform="translate(20, -12)">
                            <rect
                              x="0"
                              y="-2"
                              width={titleStr.length * 7.5 + 14}
                              height="22"
                              rx="5"
                              fill="#0f172a"
                              stroke={isSelected ? '#38bdf8' : colorConfig.stroke}
                              strokeWidth="1.5"
                            />
                            <text
                              x="7"
                              y="13"
                              fill={isSelected ? '#7dd3fc' : colorConfig.text}
                              fontSize="11"
                              fontWeight="bold"
                            >
                              {titleStr}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  }

                  default:
                    return null;
                }
              })}
            </svg>
          )}

          {/* Top Floating Badge & Action Bar */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-auto">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md border border-gray-700 text-xs font-semibold text-gray-200 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>
                {sourceType === 'screen'
                  ? 'Tela Compartilhada'
                  : sourceType === 'camera'
                  ? `Câmera (${facingMode === 'environment' ? 'Traseira' : 'Frontal'})`
                  : 'Imagem Carregada'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Clear Drawings Button if any annotations or guides are present */}
              {totalAnnotations > 0 && onClearVisualGuides && (
                <button
                  onClick={onClearVisualGuides}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-600/80 hover:bg-red-500 text-white text-xs font-medium shadow-lg backdrop-blur-md transition-all active:scale-95 border border-red-400/40"
                  title="Limpar anotações e desenhos da tela"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Limpar Desenhos</span>
                </button>
              )}

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
          </div>

          {/* Interactive Step-by-Step Guided Navigation Tour Card */}
          {stepGuides.length > 0 && (
            <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-3 sm:max-w-sm z-20 pointer-events-auto bg-gray-900/95 backdrop-blur-md border border-cyan-500/40 rounded-xl p-3 shadow-2xl">
              <div className="flex items-center justify-between pb-2 border-b border-gray-800">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-500 text-gray-950 font-bold text-xs flex items-center justify-center">
                    {stepGuides[activeStepIndex]?.number ?? 1}
                  </span>
                  <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                    Passo {activeStepIndex + 1} de {stepGuides.length}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveStepIndex(prev => Math.max(0, prev - 1))}
                    disabled={activeStepIndex === 0}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-40 disabled:hover:bg-gray-800 border border-gray-700 transition"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setActiveStepIndex(prev => Math.min(stepGuides.length - 1, prev + 1))}
                    disabled={activeStepIndex === stepGuides.length - 1}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-40 disabled:hover:bg-cyan-600 shadow-sm transition"
                  >
                    Próximo
                  </button>
                </div>
              </div>

              <div className="pt-2 text-left">
                {stepGuides[activeStepIndex]?.title && (
                  <h4 className="text-xs sm:text-sm font-semibold text-white mb-0.5">
                    {stepGuides[activeStepIndex].title}
                  </h4>
                )}
                {stepGuides[activeStepIndex]?.description && (
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {stepGuides[activeStepIndex].description}
                  </p>
                )}
              </div>
            </div>
          )}
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
            Escolha como a IA verá sua tela ou ambiente para desenhar, indicar com setas e guiar você em tempo real:
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