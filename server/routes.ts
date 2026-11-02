import type { Express } from 'express';
import type { Auth } from 'firebase-admin/auth';
import type { RateLimitRequestHandler } from 'express-rate-limit';
import { GoogleGenAI } from '@google/genai';
import { getApiKey, responseSchema } from './config';
import { buildConversationHistory } from './conversationContext';

export function registerApiRoutes(
  app: Express,
  adminAuth: Auth,
  apiLimiter: RateLimitRequestHandler
) {
  const authenticate = async (req: any, res: any, next: any) => {
    const authorization = req.headers.authorization || '';
    const match = authorization.match(/^Bearer (.+)$/i);
    if (!match) return res.status(401).json({ error: 'Autenticação necessária.' });
    try {
      req.user = await adminAuth.verifyIdToken(match[1]);
      return next();
    } catch {
      return res.status(401).json({ error: 'Sessão inválida ou expirada. Entre novamente.' });
    }
  };
  // API Health Check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasApiKey: !!getApiKey(),
      timestamp: new Date().toISOString(),
    });
  });

  // REST API: Ask About Screen
  app.post('/api/screen/ask', apiLimiter, authenticate, async (req, res) => {
    const apiKey = getApiKey();
    if (!apiKey) {
      return res.status(500).json({
        error: "Chave GEMINI_API_KEY não configurada no servidor.",
      });
    }

    const { messages, imageBase64, systemInstruction } = req.body || {};
    if (!messages || !Array.isArray(messages) || messages.length > 40 ||
        messages.some((m: any) => !m || !['user', 'assistant'].includes(m.role) || typeof m.text !== 'string' || m.text.length > 12000) ||
        (imageBase64 != null && (typeof imageBase64 !== 'string' || imageBase64.length > 3_800_000)) ||
        (systemInstruction != null && (typeof systemInstruction !== 'string' || systemInstruction.length > 8000))) {
      return res.status(400).json({ error: "Parâmetro 'messages' inválido." });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });

      // Build conversation history
      const conversationHistory = buildConversationHistory(messages.slice(1, -1), {
        maxMessages: 16,
        maxChars: 22000,
        maxMessageChars: 3000,
      });

      const currentPrompt = messages[messages.length - 1]?.text || '';
      const fullPrompt = conversationHistory
        ? `This is the conversation history so far:\n${conversationHistory}\n\nHere is the current user request: "${currentPrompt}"`
        : currentPrompt;

      const parts: any[] = [{ text: fullPrompt }];

      if (imageBase64) {
        parts.unshift({
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageBase64,
          },
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: { parts },
        config: {
          systemInstruction: systemInstruction || undefined,
          responseMimeType: 'application/json',
          responseSchema,
        },
      });

      const responseText = response.text || '{}';
      let parsedResponse: any = {};
      try {
        parsedResponse = JSON.parse(responseText);
      } catch (parseError) {
        console.warn("Could not parse JSON response from model, returning raw text:", responseText);
        return res.json({
          text: responseText,
          annotations: [],
          visualGuides: [],
        });
      }

      return res.json({
        text: parsedResponse.response_text || 'Não consegui obter uma resposta para a tela.',
        annotations: (parsedResponse.highlights || []).map((h: any) => ({
          x: h.x,
          y: h.y,
          width: h.width,
          height: h.height,
        })),
        visualGuides: parsedResponse.visual_guides || [],
      });
    } catch (err: any) {
      console.error("Error in /api/screen/ask:", err);
      return res.status(500).json({ error: 'Erro interno ao processar a solicitação.' });
    }
  });

  // REST API: Generate Meeting/Session Summary
  app.post('/api/screen/summary', apiLimiter, authenticate, async (req, res) => {
    const apiKey = getApiKey();
    if (!apiKey) {
      return res.status(500).json({
        error: "Chave GEMINI_API_KEY não configurada no servidor.",
      });
    }

    const { messages, imageBase64 } = req.body || {};
    if (!messages || !Array.isArray(messages) || messages.length > 40 ||
        messages.some((m: any) => !m || !['user', 'assistant'].includes(m.role) || typeof m.text !== 'string' || m.text.length > 12000) ||
        (imageBase64 != null && (typeof imageBase64 !== 'string' || imageBase64.length > 3_800_000))) {
      return res.status(400).json({ error: "Parâmetro 'messages' inválido." });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });

      const conversationHistory = buildConversationHistory(messages.slice(1), {
        maxMessages: 24,
        maxChars: 32000,
        maxMessageChars: 4000,
      });

      const prompt = `Based on the following conversation history, which may involve multiple speakers, and the final screenshot of the shared screen (if provided), generate a concise summary structured as meeting minutes. Your primary task is to identify and differentiate between speakers (e.g., "Speaker 1:", "Speaker 2:"). Use conversational cues from the text to attribute statements. The summary should include key decisions, action items, and main topics. Where relevant, refer to visual elements from the screenshot to provide context. Format the output in Markdown.\n\nConversation:\n${conversationHistory}`;

      const parts: any[] = [{ text: prompt }];

      if (imageBase64) {
        parts.unshift({
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageBase64,
          },
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: { parts },
        config: {
          systemInstruction:
            "You are an expert at summarizing conversations that may involve visual context. Your task is to convert a transcript and a final screenshot into a well-structured and professional summary, formatted in Markdown. Identify key points, decisions, and action items, incorporating visual references where applicable.",
        },
      });

      return res.json({
        summary: response.text || '',
      });
    } catch (err: any) {
      console.error("Error in /api/screen/summary:", err);
      return res.status(500).json({ error: 'Erro interno ao gerar o resumo.' });
    }
  });
}
