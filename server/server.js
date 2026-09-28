import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Authentication routes (in-memory, no database dependency)
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'NexusAI Auth Service (No Database)' });
});

// Start server directly without any SQL Server connection
app.listen(PORT, () => {
  console.log(`[NexusAI Server] Running on http://localhost:${PORT} (In-Memory Session Architecture)`);
});
