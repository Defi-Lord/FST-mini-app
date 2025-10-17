import { createServer } from 'http';
import app from './app'; // Adjust path if needed

const PORT = parseInt(process.env.PORT || '3000', 10);

// 🧠 This is the critical part for Render to detect your server:
createServer(app).listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
});
