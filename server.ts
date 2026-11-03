import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality, Type, Part } from '@google/genai';

// Attempt to load .env file if available
try {
  (process as any).loadEnvFile?.();
} catch {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const app = express();

// Increase JSON payload limit for high-resolution screenshot frames
app.use(express.json({ limit: '50mb' }));

function getApiKey(): string {
  return process.env.GEMINI_API_KEY || process.env.API_KEY || '';
}

function getGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractErrorMessage(error: any): string {
  if (typeof error === 'string') {
    try {
      const parsed = JSON.parse(error);
      if (parsed?.error?.message) return parsed.error.message;
    } catch {}
    return error;
  }
  if (error?.message) {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.error?.message) return parsed.error.message;
    } catch {}
    return error.message;
  }
  return 'Ocorreu um erro inesperado ao consultar o Gemini.';
}

async function generateContentWithRetry(ai: GoogleGenAI, params: any) {
  try {
    return await ai.models.generateContent(params);
  } catch (err: any) {
    const isTemporary = err?.message?.includes('503') || err?.message?.includes('UNAVAILABLE') || err?.status === 503;
    if (isTemporary) {
      console.warn('Gemini 503 spike encountered, retrying with brief delay...');
      await new Promise(r => setTimeout(r, 1200));
      try {
        return await ai.models.generateContent(params);
      } catch (retryErr: any) {
        if (params.model !== 'gemini-2.5-flash') {
          console.warn('Switching to gemini-2.5-flash as resilient fallback...');
          return await ai.models.generateContent({
            ...params,
            model: 'gemini-2.5-flash',
          });
        }
        throw retryErr;
      }
    }
    throw err;
  }
}

const responseSchema = {
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
          x: { type: Type.NUMBER, description: "The normalized x-coordinate (from 0.0 to 1.0) of the top-left corner of the highlight box." },
          y: { type: Type.NUMBER, description: "The normalized y-coordinate (from 0.0 to 1.0) of the top-left corner of the highlight box." },
          width: { type: Type.NUMBER, description: "The normalized width (from 0.0 to 1.0) of the highlight box." },
          height: { type: Type.NUMBER, description: "The normalized height (from 0.0 to 1.0) of the highlight box." },
        },
        required: ["x", "y", "width", "height"],
      },
    },
    visual_guides: {
      type: Type.ARRAY,
      description: "An optional list of visual guides to draw on the screen to help the user, such as arrows, text labels, or numbered steps.",
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, description: "The type of guide ('arrow', 'text', 'number_badge')." },
          startX: { type: Type.NUMBER, description: "For 'arrow' type: The normalized starting x-coordinate." },
          startY: { type: Type.NUMBER, description: "For 'arrow' type: The normalized starting y-coordinate." },
          endX: { type: Type.NUMBER, description: "For 'arrow' type: The normalized ending x-coordinate." },
          endY: { type: Type.NUMBER, description: "For 'arrow' type: The normalized ending y-coordinate." },
          label: { type: Type.STRING, description: "For 'arrow' type: An optional text label for the arrow." },
          x: { type: Type.NUMBER, description: "For 'text' or 'number_badge' types: The normalized x-coordinate of the guide." },
          y: { type: Type.NUMBER, description: "For 'text' or 'number_badge' types: The normalized y-coordinate of the guide." },
          text: { type: Type.STRING, description: "For 'text' type: The text content of the label." },
          number: { type: Type.INTEGER, description: "For 'number_badge' type: The number for the badge." },
        },
        required: ["type"],
      },
    },
  },
  required: ["response_text"],
};

// POST /api/gemini/ask-screen
app.post('/api/gemini/ask-screen', async (req, res) => {
  try {
    const key = getApiKey();
    if (!key) {
      return res.status(500).json({
        error: 'Sua chave de API do Gemini não foi encontrada no servidor. Verifique o painel Settings > Secrets.',
      });
    }

    const { messages, imageBase64, systemInstruction } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required.' });
    }

    const conversationHistory = messages
      .slice(1, -1)
      .map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
      .join('\n\n');

    const currentPrompt = messages[messages.length - 1].text;
    const fullPrompt = `This is the conversation history so far:\n${conversationHistory}\n\nHere is the current user request: "${currentPrompt}"`;

    const parts: Part[] = [{ text: fullPrompt }];

    if (imageBase64) {
      parts.unshift({
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64,
        },
      });
    }

    const ai = getGeminiClient(key);
    const response = await generateContentWithRetry(ai, {
      model: 'gemini-flash-latest',
      contents: { parts },
      config: {
        systemInstruction: systemInstruction || undefined,
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      },
    });

    const responseText = response.text || '';
    try {
      const parsed = JSON.parse(responseText);
      return res.json({
        text: parsed.response_text || "Desculpe, não consegui formular uma resposta.",
        annotations: parsed.highlights || [],
        visualGuides: parsed.visual_guides || [],
      });
    } catch {
      return res.json({
        text: responseText,
        annotations: [],
        visualGuides: [],
      });
    }
  } catch (error: any) {
    console.error('Error in ask-screen:', error);
    return res.status(500).json({
      error: extractErrorMessage(error),
    });
  }
});

// POST /api/gemini/summary
app.post('/api/gemini/summary', async (req, res) => {
  try {
    const key = getApiKey();
    if (!key) {
      return res.status(500).json({
        error: 'Sua chave de API do Gemini não foi encontrada no servidor. Verifique o painel Settings > Secrets.',
      });
    }

    const { messages, imageBase64 } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required.' });
    }

    const conversationHistory = messages
      .slice(1)
      .map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
      .join('\n');

    const prompt = `Based on the following conversation history, which may involve multiple speakers, and the final screenshot of the shared screen (if provided), generate a concise summary structured as meeting minutes. Your primary task is to identify and differentiate between speakers (e.g., "Speaker 1:", "Speaker 2:"). Use conversational cues from the text to attribute statements. The summary should include key decisions, action items, and main topics. Where relevant, refer to visual elements from the screenshot to provide context. Format the output in Markdown.\n\nConversation:\n${conversationHistory}`;

    const parts: Part[] = [{ text: prompt }];

    if (imageBase64) {
      parts.unshift({
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64,
        },
      });
    }

    const ai = getGeminiClient(key);
    const response = await generateContentWithRetry(ai, {
      model: 'gemini-flash-latest',
      contents: { parts },
      config: {
        systemInstruction: "You are an expert at summarizing conversations that may involve visual context. Your task is to convert a transcript and a final screenshot into a well-structured and professional summary, formatted in Markdown. Identify key points, decisions, and action items, incorporating visual references where applicable.",
      },
    });

    return res.json({ summary: response.text || '' });
  } catch (error: any) {
    console.error('Error in summary:', error);
    return res.status(500).json({
      error: extractErrorMessage(error),
    });
  }
});

// GET /api/config/ads - returns ad unit block IDs and configuration securely from server environment
app.get('/api/config/ads', (_req, res) => {
  const clientId = process.env.ADS_CLIENT_ID || '';
  const slotId = process.env.ADS_SLOT_ID || '';
  const format = process.env.ADS_FORMAT || 'auto';

  res.json({
    enabled: !!(clientId && slotId),
    clientId,
    slotId,
    format,
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// WebSocket upgrade handler for Live API
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
  if (url.pathname === '/api/live' || url.pathname === '/live') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

wss.on('connection', async (clientWs: WebSocket, req: http.IncomingMessage) => {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const voiceName = url.searchParams.get('voice') || 'Zephyr';
  const customInstruction = url.searchParams.get('systemInstruction') || '';

  const safeSend = (data: any) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      try {
        clientWs.send(JSON.stringify(data));
      } catch (e) {
        console.error('Failed to send message to client WebSocket:', e);
      }
    }
  };

  const key = getApiKey();
  if (!key) {
    safeSend({ error: 'Sua chave de API do Gemini não foi encontrada no servidor. Verifique o painel Settings > Secrets.' });
    clientWs.close();
    return;
  }

  let liveSession: any = null;
  let isClosed = false;

  try {
    const ai = getGeminiClient(key);
    const sessionPromise = ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName,
            },
          },
        },
        systemInstruction: customInstruction || undefined,
      },
      callbacks: {
        onopen: () => {
          safeSend({ type: 'connected' });
        },
        onmessage: (message: LiveServerMessage) => {
          const content = message.serverContent;
          if (content?.inputTranscription?.text) {
            safeSend({ inputTranscript: content.inputTranscription.text });
          }
          if (content?.outputTranscription?.text) {
            safeSend({ outputTranscript: content.outputTranscription.text });
          }
          for (const part of content?.modelTurn?.parts ?? []) {
            if (part.inlineData?.data) {
              safeSend({ audio: part.inlineData.data });
            }
          }
          if (content?.interrupted) {
            safeSend({ interrupted: true });
          }
          if (content?.turnComplete) {
            safeSend({ turnComplete: true });
          }
        },
        onclose: (e: any) => {
          safeSend({ type: 'closed', detail: e });
          if (!isClosed) {
            isClosed = true;
            try { clientWs.close(); } catch {}
          }
        },
        onerror: (err: any) => {
          console.error('Live session error:', err);
          safeSend({ error: extractErrorMessage(err) });
          if (!isClosed) {
            isClosed = true;
            try { clientWs.close(); } catch {}
          }
        },
      },
    });

    sessionPromise.then((session) => {
      liveSession = session;
    }).catch((err) => {
      console.error('Failed to connect to Live API session:', err);
      safeSend({ error: extractErrorMessage(err) });
      if (!isClosed) {
        isClosed = true;
        try { clientWs.close(); } catch {}
      }
    });

    clientWs.on('message', async (data) => {
      try {
        const payload = JSON.parse(data.toString());
        const session = liveSession || (await sessionPromise);
        if (!session) return;

        if (payload.audio) {
          session.sendRealtimeInput({
            audio: {
              data: payload.audio,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } else if (payload.video) {
          session.sendRealtimeInput({
            video: {
              data: payload.video,
              mimeType: 'image/jpeg',
            },
          });
        } else if (payload.text) {
          session.sendRealtimeInput({
            text: payload.text,
          });
        }
      } catch (err) {
        console.error('Error handling message from client in Live session:', err);
      }
    });

    clientWs.on('close', () => {
      isClosed = true;
      if (liveSession) {
        try {
          liveSession.close();
        } catch (e) {
          console.debug('Error closing Live session:', e);
        }
      } else {
        sessionPromise.then(s => {
          try { s.close(); } catch {}
        }).catch(() => {});
      }
    });

    clientWs.on('error', (err) => {
      console.error('Client WebSocket error:', err);
      isClosed = true;
      if (liveSession) {
        try { liveSession.close(); } catch {}
      }
    });

  } catch (error: any) {
    console.error('Error establishing Live API connection:', error);
    safeSend({ error: extractErrorMessage(error) });
    if (!isClosed) {
      isClosed = true;
      try { clientWs.close(); } catch {}
    }
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
