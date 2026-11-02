import React from 'react';
import { Annotation, VisualGuide, GuideType } from '../types';

interface VisualGuideOverlayProps {
  visible: boolean;
  containerSize: { width: number; height: number };
  annotations: Annotation[];
  visualGuides: VisualGuide[];
  completedSteps: Record<number, boolean>;
  onToggleStep: (number: number) => void;
}

export const VisualGuideOverlay: React.FC<VisualGuideOverlayProps> = ({
  visible, containerSize, annotations, visualGuides, completedSteps, onToggleStep,
}) => {
  if (!visible || (!visualGuides.length && !annotations.length)) return null;

  const toggleStepCompleted = onToggleStep;
  return (
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
  );
};
