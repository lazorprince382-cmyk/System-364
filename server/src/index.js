import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import { categoriesRouter, productsRouter } from './routes/crud.js';
import parentsRoutes from './routes/parents.js';
import stockRoutes from './routes/stock.js';
import ordersRoutes from './routes/orders.js';
import returnsRoutes from './routes/returns.js';
import uniformHistoryRoutes from './routes/uniformHistory.js';
import reportsRoutes from './routes/reports.js';
import systemRoutes from './routes/system.js';
import { authenticate, attachUser } from './middleware/auth.js';
import { ensureGenderSchema } from './db/ensure-gender.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);

app.use('/api/dashboard', authenticate, attachUser, dashboardRoutes);
app.use('/api/categories', authenticate, categoriesRouter);
app.use('/api/products', authenticate, productsRouter);
app.use('/api/parents', authenticate, parentsRoutes);
app.use('/api/stock', authenticate, stockRoutes);
app.use('/api/orders', authenticate, ordersRoutes);
app.use('/api/returns', authenticate, returnsRoutes);
app.use('/api/uniform-history', authenticate, uniformHistoryRoutes);
app.use('/api/reports', authenticate, reportsRoutes);
app.use('/api/system', authenticate, systemRoutes);

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'uniform' });
});

// Global error handler for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Schema check (should not fail since setup runs before server starts)
ensureGenderSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Uniform server listening on http://localhost:${PORT}`);
      console.log(`📡 Health endpoint: http://localhost:${PORT}/api/health`);
    });
  })
  .catch((err) => {
    console.error('❌ Database gender schema check failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
