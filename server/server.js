import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import { getDbPool } from './db/db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'NexusAI Auth Service' });
});

// Initialize Database connection on start
getDbPool()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[NexusAI Server] Running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[NexusAI Server] Database startup failed:', err.message);
    // Still start server so API returns descriptive database errors rather than dying
    app.listen(PORT, () => {
      console.log(`[NexusAI Server] Running on http://localhost:${PORT} (Database pending connection)`);
    });
  });
