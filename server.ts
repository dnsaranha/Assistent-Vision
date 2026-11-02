import path from 'path';
import express from 'express';
import http from 'http';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { registerApiRoutes } from './server/routes';
import { attachLiveWebSocket } from './server/liveWebSocket';
import { getApiKey } from './server/config';
import { initializeFirebaseAdmin } from './server/firebaseAdmin';
import { buildConversationHistory } from './server/conversationContext';

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
  registerApiRoutes(app, adminAuth, apiLimiter);

  attachLiveWebSocket(server, allowedOrigins, adminAuth);

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
