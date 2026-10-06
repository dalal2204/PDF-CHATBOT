require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDatabase = require('./config/db');
const healthRoutes = require('./routes/health.routes');
const documentRoutes = require('./routes/document.routes');
const chatRoutes = require('./routes/chat.routes');
const { errorHandler, notFound } = require('./middlewares/error.middleware');

const app = express();
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',').map((origin) => origin.trim());

app.use(cors({ origin: (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error('This origin is not allowed by CORS.'));
} }));
app.use(express.json({ limit: '1mb' }));

app.use('/api/health', healthRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/documents/:documentId/chat', chatRoutes);
app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT) || 3000;
connectDatabase().then(() => {
  app.listen(port, () => console.log(`API listening on port ${port}`));
}).catch(() => {
  console.error('MongoDB connection failed. Check the backend environment configuration and database availability.');
  process.exit(1);
});

module.exports = app;
