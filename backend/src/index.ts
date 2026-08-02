import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import customersRoutes from './routes/customers';
import productsRoutes from './routes/products';
import reelsRoutes from './routes/reels';
import jobcardsRoutes from './routes/jobcards';
import dashboardRoutes from './routes/dashboard';
import productionRoutes from './routes/production';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/reels', reelsRoutes);
app.use('/api/jobcards', jobcardsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/production', productionRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Packwell ERP API is running.' });
});

const PORT = process.env.PORT || 5000;

// Export the app for Vercel serverless functions
export default app;

// Only start the server locally if not in a Vercel environment
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
