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
  TEXT = 'text',
  NUMBER_BADGE = 'number_badge',
}

export interface ArrowGuide {
  type: GuideType.ARROW;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  label?: string;
}

export interface TextGuide {
  type: GuideType.TEXT;
  x: number;
  y: number;
  text: string;
}

export interface NumberBadgeGuide {
    type: GuideType.NUMBER_BADGE;
    x: number;
    y: number;
    number: number;
}

export type VisualGuide = ArrowGuide | TextGuide | NumberBadgeGuide;


export interface GeminiResponse {
  text: string;
  annotations: Annotation[];
  visualGuides: VisualGuide[];
}