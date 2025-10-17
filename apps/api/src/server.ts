import express from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

const PORT = parseInt(process.env.PORT || '3000', 10); // Render uses this!

// Optional test route
app.get('/', (req, res) => {
  res.send('✅ API running on Render successfully!');
});

// Always bind to 0.0.0.0 for Render
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server started at http://0.0.0.0:${PORT}`);
});
