import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from 'dotenv';
import router from './routes/index.js'; // <- MUST use .js
import { PrismaClient } from '@prisma/client';

config(); // Load env

const prisma = new PrismaClient();
const app = express();

app.use(morgan('dev'));
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
}));
app.use(express.json());
app.use('/api', router);

// Health check route
app.get('/', (_, res) => res.send('Server running.'));

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
