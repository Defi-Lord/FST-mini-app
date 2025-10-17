import { createServer } from 'http';
import app from './app'; // or wherever your express app is

// Use port from environment or default to 3000
const PORT = parseInt(process.env.PORT || '3000', 10);

// Important: Listen on 0.0.0.0 for Render to detect the port
const server = createServer(app);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
