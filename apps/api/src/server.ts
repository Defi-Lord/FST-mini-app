import express from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

const PORT = parseInt(process.env.PORT || '3000', 10);

app.get('/', (_req, res) => {
  res.send('✅ FST API is up and running!');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
});
