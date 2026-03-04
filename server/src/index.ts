import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initDb, closeDb } from './db/init.js';
import { hmacMiddleware } from './middleware/hmac.js';
import licenseRouter from './routes/license.js';
import { startScheduler, stopScheduler } from './services/scheduler.js';

const PORT = Number(process.env.PORT) || 3100;

const app = express();

// Security headers
app.use(helmet());

// CORS — allow Chrome extension origin
app.use(cors({
  origin: true,
  methods: ['POST'],
  allowedHeaders: ['Content-Type'],
}));

// Rate limit: 60 requests per minute per IP
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, code: 'rate_limited', message: 'Too many requests, try again later' },
}));

// JSON body parser
app.use(express.json());

// HMAC signature middleware
app.use('/api/license', hmacMiddleware);

// Routes
app.use('/api/license', licenseRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Init DB and start server
async function start(): Promise<void> {
  await initDb();
  console.log('Database initialized');

  startScheduler();

  const server = app.listen(PORT, () => {
    console.log(`License server running on http://localhost:${PORT}`);
  });

  function shutdown(): void {
    console.log('Shutting down...');
    stopScheduler();
    server.close(() => {
      closeDb();
      process.exit(0);
    });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

