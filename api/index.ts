import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from '../backend/src/routes/auth';
import customersRoutes from '../backend/src/routes/customers';
import productsRoutes from '../backend/src/routes/products';
import reelsRoutes from '../backend/src/routes/reels';
import jobcardsRoutes from '../backend/src/routes/jobcards';
import dashboardRoutes from '../backend/src/routes/dashboard';

dotenv.config();

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/reels', reelsRoutes);
app.use('/api/jobcards', jobcardsRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Packwell ERP API is running.' });
});

export default app;
