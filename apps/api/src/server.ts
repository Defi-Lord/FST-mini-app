import express from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

// Middleware (optional)
// app.use(express.json());

app.get('/', async (req, res) => {
  res.send('Server is running!');
});

// Use Render's required port and host
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is listening on port ${PORT}`);
});
