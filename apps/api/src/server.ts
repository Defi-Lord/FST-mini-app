import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from 'dotenv';
import router from './routes/index.js'; // .js needed in Node ESM mode
import { PrismaClient } from '@prisma/client';

config(); // Load env vars from .env
const prisma = new PrismaClient();

const app = express();

// Middlewares
app.use(morgan('dev'));
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
}));
app.use(express.json());

// Routes
app.use('/api', router);

// Health check
app.get('/', (req, res) => {
  res.send('API server is up and running');
});

// Bind to PORT from env or fallback to 3000
const PORT = process.env.PORT || 3000;

// ✅ Important: Use 0.0.0.0 for Render to detect the service
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
