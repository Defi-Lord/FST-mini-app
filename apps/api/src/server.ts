import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from 'dotenv';
import router from './routes/index.js'; // 👈 Add .js extension

config(); // Load .env

const app = express();

app.use(morgan('dev'));
app.use(cors());
app.use(express.json());

app.use('/api', router);

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server listening on http://0.0.0.0:${PORT}`);
});
