import express from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

app.get('/', (req, res) => {
  res.send('✅ API is up and running!');
});

const PORT = parseInt(process.env.PORT || '3000', 10);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server listening on http://0.0.0.0:${PORT}`);
});
