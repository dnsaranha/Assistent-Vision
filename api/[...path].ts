// Vercel routes /api/* through this Node.js Function.
// Exporting the HTTP server enables both Express routes and native WebSocket upgrades.
import server from '../server.ts';

export default server;
