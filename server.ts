import path from 'path';
import express from 'express';
import http from 'http';
import { parse as parseUrl } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI, Modality } from '@google/genai';
import { getApiKey, responseSchema } from './server/config';
import { initializeFirebaseAdmin } from './server/firebaseAdmin';

async function createServer() {
  const adminAuth = initializeFirebaseAdmin();
  const app = express();
  const server = http.createServer(app);

  const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, false);
      return callback(null, allowedOrigins.includes(origin));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '4mb' }));

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Muitas solicitações. Aguarde um minuto e tente novamente.' },
  });
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
      const conversationHistory = messages
        .slice(1, -1)
        .map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
        .join('\n\n');

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

      const conversationHistory = messages
        .slice(1)
        .map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
        .join('\n');

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

  // WebSocket Server for Live API Proxy
  const wss = new WebSocketServer({ noServer: true, maxPayload: 5 * 1024 * 1024 });
  const activeUsers = new Set<string>();

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parseUrl(request.url || '');
    if (pathname === '/api/live-ws') {
      const origin = request.headers.origin;
      const requestHost = request.headers.host;
      let sameOrigin = false;
      try { sameOrigin = !!origin && new URL(origin).host === requestHost; } catch { sameOrigin = false; }
      if (origin && !sameOrigin && !allowedOrigins.includes(origin)) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    let liveSession: any = null;
    let isClosed = false;
    let authenticatedUid: string | null = null;
    let authTimeout: NodeJS.Timeout | null = setTimeout(() => ws.close(4401, 'Authentication timeout'), 5000);

    ws.on('message', async (data) => {
      try {
        const payload = JSON.parse(data.toString());

        if (!authenticatedUid) {
          if (payload.type !== 'authenticate' || typeof payload.token !== 'string' || payload.token.length > 10000) {
            ws.close(4401, 'Authentication required');
            return;
          }
          try {
            const decoded = await adminAuth.verifyIdToken(payload.token);
            authenticatedUid = decoded.uid;
            if (authTimeout) clearTimeout(authTimeout);
            authTimeout = null;
            if (activeUsers.has(authenticatedUid)) {
              ws.close(4429, 'Live session already active');
              authenticatedUid = null;
              return;
            }
            activeUsers.add(authenticatedUid);
            ws.send(JSON.stringify({ type: 'authenticated' }));
          } catch {
            ws.close(4401, 'Invalid authentication');
          }
          return;
        }

        if (payload.type === 'start') {
          if (liveSession) return;
          const apiKey = getApiKey();
          if (!apiKey) {
            ws.send(JSON.stringify({
              type: 'session_error',
              error: 'API_KEY_NOT_FOUND',
              message: 'Chave GEMINI_API_KEY não configurada no servidor.',
            }));
            return;
          }

          const ai = new GoogleGenAI({ apiKey });

          const liveModel = payload.model || 'gemini-2.5-flash-native-audio-preview-12-2025';
          const voiceModel = payload.voiceModel || 'Zephyr';
          const systemInstruction = payload.systemInstruction || '';

          liveSession = await ai.live.connect({
            model: liveModel,
            config: {
              responseModalities: [Modality.AUDIO],
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              systemInstruction: systemInstruction,
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceModel } },
              },
            },
            callbacks: {
              onopen: () => {
                if (!isClosed && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'session_open' }));
                }
              },
              onmessage: (message: any) => {
                if (!isClosed && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'server_message', message }));
                }
              },
              onclose: (e: any) => {
                if (!isClosed && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'session_close', details: e }));
                }
              },
              onerror: (err: any) => {
                console.error("Server Live session error:", err);
                if (!isClosed && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'session_error',
                    error: err?.message || String(err),
                  }));
                }
              },
            },
          });
        } else if (payload.type === 'realtime_input' && liveSession) {
          if (payload.input && typeof payload.input === 'object') liveSession.sendRealtimeInput(payload.input);
        } else if (payload.type === 'stop') {
          if (liveSession) {
            try {
              liveSession.close();
            } catch (e) {
              console.debug("Live session close error:", e);
            }
            liveSession = null;
          }
        }
      } catch (err: any) {
        console.error("Error processing WebSocket message on server:", err);
        if (ws.readyState === WebSocket.OPEN) ws.close(1011, 'Message processing failed');
      }
    });

    const cleanup = () => {
      isClosed = true;
      if (authTimeout) clearTimeout(authTimeout);
      if (authenticatedUid) activeUsers.delete(authenticatedUid);
      if (liveSession) {
        try {
          liveSession.close();
        } catch (e) {
          console.debug("Error closing session on socket close:", e);
        }
        liveSession = null;
      }
    };

    ws.on('close', cleanup);
    ws.on('error', cleanup);
  });

  // Development: Mount Vite Middlewares
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: Serve built assets
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Vercel imports this HTTP server as a Function entrypoint. Locally, keep
  // the standalone Express server for the existing npm run dev workflow.
  if (!process.env.VERCEL) {
    const PORT = parseInt(process.env.PORT || '3000', 10);
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running at http://0.0.0.0:${PORT}`);
    });
  }

  return server;
}

const server = await createServer();
export default server;
