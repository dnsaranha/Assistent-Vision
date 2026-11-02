import path from 'path';
import fs from 'fs';
import { Type } from '@google/genai';

// Load environment variables from .env.local or .env if present
function loadLocalEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      } catch (e) {
        console.warn(`Could not read ${file}:`, e);
      }
    }
  }
}

loadLocalEnv();

export const getApiKey = () => process.env.GEMINI_API_KEY || process.env.API_KEY || '';

export const responseSchema = {
  type: Type.OBJECT,
  properties: {
    response_text: {
      type: Type.STRING,
      description: "The textual answer to the user's question.",
    },
    highlights: {
      type: Type.ARRAY,
      description: "An optional list of areas to highlight on the screen.",
      items: {
        type: Type.OBJECT,
        properties: {
          x: { type: Type.NUMBER, description: "Normalized x-coordinate (0.0 to 1.0) of the top-left corner." },
          y: { type: Type.NUMBER, description: "Normalized y-coordinate (0.0 to 1.0) of the top-left corner." },
          width: { type: Type.NUMBER, description: "Normalized width (0.0 to 1.0)." },
          height: { type: Type.NUMBER, description: "Normalized height (0.0 to 1.0)." },
        },
        required: ["x", "y", "width", "height"],
      },
    },
    visual_guides: {
      type: Type.ARRAY,
      description: "An optional list of visual guides to draw on the screen (arrows, circles, rectangles, text labels, and numbered step badges).",
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, description: "The type of guide: 'arrow', 'circle', 'rect', 'text', or 'number_badge'." },
          startX: { type: Type.NUMBER, description: "For 'arrow': normalized start X (0.0 to 1.0)." },
          startY: { type: Type.NUMBER, description: "For 'arrow': normalized start Y (0.0 to 1.0)." },
          endX: { type: Type.NUMBER, description: "For 'arrow': normalized end X (0.0 to 1.0)." },
          endY: { type: Type.NUMBER, description: "For 'arrow': normalized end Y (0.0 to 1.0)." },
          label: { type: Type.STRING, description: "Optional explanatory label or step title (e.g. 'Clique aqui', 'Passo 1: Salvar')." },
          x: { type: Type.NUMBER, description: "Normalized X coordinate (0.0 to 1.0) for circle center, rect top-left, text, or number_badge." },
          y: { type: Type.NUMBER, description: "Normalized Y coordinate (0.0 to 1.0) for circle center, rect top-left, text, or number_badge." },
          width: { type: Type.NUMBER, description: "For 'rect': normalized width (0.0 to 1.0)." },
          height: { type: Type.NUMBER, description: "For 'rect': normalized height (0.0 to 1.0)." },
          radius: { type: Type.NUMBER, description: "For 'circle': normalized radius (0.01 to 0.25)." },
          text: { type: Type.STRING, description: "For 'text' type: text content." },
          number: { type: Type.INTEGER, description: "For 'number_badge' type: step sequence number (1, 2, 3...)." },
          color: { type: Type.STRING, description: "Optional hex color like '#fef08a' (yellow), '#38bdf8' (cyan), '#f43f5e' (red), '#4ade80' (green)." },
        },
        required: ["type"],
      },
    },
  },
  required: ["response_text"],
};
