import http from 'http';
import { parse as parseUrl } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import type { Auth } from 'firebase-admin/auth';
import { GoogleGenAI, Modality } from '@google/genai';
import { getApiKey } from './config';

export function attachLiveWebSocket(server: http.Server, allowedOrigins: string[], adminAuth: Auth) {
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
}
