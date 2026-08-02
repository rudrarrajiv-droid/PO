import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.PROD ? '/api' : 'http://localhost:5000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// API endpoints

export const getProducts = async () => {
  const res = await api.get('/products');
  return res.data;
};

export const createJobCard = async (data: any) => {
  const res = await api.post('/jobcards', data);
  return res.data;
};

export const getJobCards = async () => {
  const res = await api.get('/jobcards');
  return res.data;
};

export const getNextJobCardNo = async () => {
  const res = await api.get('/jobcards/next-number');
  return res.data.nextNo;
};

export const getDashboardStats = async () => {
  const res = await api.get('/dashboard/stats');
  return res.data;
};

export const getProductionLogs = async (jobCardId: number) => {
  const res = await api.get(`/production/${jobCardId}`);
  return res.data;
};

export const addProductionLog = async (data: any) => {
  const res = await api.post('/production', data);
  return res.data;
};

export default api;
