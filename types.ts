export enum Role {
  USER = 'user',
  ASSISTANT = 'assistant',
}

export interface Message {
  role: Role;
  text: string;
}

export interface Annotation {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export enum GuideType {
  ARROW = 'arrow',
  RECTANGLE = 'rectangle',
  CIRCLE = 'circle',
  TEXT = 'text',
  NUMBER_BADGE = 'number_badge',
  LINE = 'line',
  HIGHLIGHT = 'highlight',
}

export interface ArrowGuide {
  type: GuideType.ARROW;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  label?: string;
  color?: string;
  style?: 'solid' | 'dashed';
}

export interface RectangleGuide {
  type: GuideType.RECTANGLE;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  color?: string;
  style?: 'solid' | 'dashed';
  filled?: boolean;
}

export interface CircleGuide {
  type: GuideType.CIRCLE;
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY?: number;
  label?: string;
  color?: string;
  pulse?: boolean;
}

export interface TextGuide {
  type: GuideType.TEXT;
  x: number;
  y: number;
  text: string;
  color?: string;
  backgroundColor?: string;
  fontSize?: 'sm' | 'md' | 'lg';
}

export interface NumberBadgeGuide {
  type: GuideType.NUMBER_BADGE;
  x: number;
  y: number;
  number: number;
  title?: string;
  description?: string;
  color?: string;
}

export interface LineGuide {
  type: GuideType.LINE;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color?: string;
  style?: 'solid' | 'dashed';
  label?: string;
}

export interface HighlightGuide {
  type: GuideType.HIGHLIGHT;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

export type VisualGuide =
  | ArrowGuide
  | RectangleGuide
  | CircleGuide
  | TextGuide
  | NumberBadgeGuide
  | LineGuide
  | HighlightGuide;

export interface GeminiResponse {
  text: string;
  annotations: Annotation[];
  visualGuides: VisualGuide[];
}