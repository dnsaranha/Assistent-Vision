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
}

export enum GuideType {
  ARROW = 'arrow',
  CIRCLE = 'circle',
  RECT = 'rect',
  TEXT = 'text',
  NUMBER_BADGE = 'number_badge',
  FREEHAND = 'freehand',
}

export interface ArrowGuide {
  type: GuideType.ARROW;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  label?: string;
  color?: string;
  strokeWidth?: number;
}

export interface CircleGuide {
  type: GuideType.CIRCLE;
  x: number;
  y: number;
  radius: number; // normalized radius (e.g., 0.02 to 0.25)
  label?: string;
  color?: string;
  strokeWidth?: number;
  fill?: boolean;
}

export interface RectGuide {
  type: GuideType.RECT;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  color?: string;
  strokeWidth?: number;
  fill?: boolean;
}

export interface TextGuide {
  type: GuideType.TEXT;
  x: number;
  y: number;
  text: string;
  color?: string;
  fontSize?: number;
}

export interface NumberBadgeGuide {
  type: GuideType.NUMBER_BADGE;
  x: number;
  y: number;
  number: number;
  label?: string;
  color?: string;
}

export interface FreehandGuide {
  type: GuideType.FREEHAND;
  points: { x: number; y: number }[];
  color?: string;
  strokeWidth?: number;
}

export type VisualGuide =
  | ArrowGuide
  | CircleGuide
  | RectGuide
  | TextGuide
  | NumberBadgeGuide
  | FreehandGuide;

export type DrawingTool = 'select' | 'step' | 'arrow' | 'circle' | 'rect' | 'pen' | 'text';



export interface GeminiResponse {
  text: string;
  annotations: Annotation[];
  visualGuides: VisualGuide[];
}