import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// Since we don't have login fully implemented in UI yet, we can mock a dummy token if the backend requires it,
// but our backend currently uses JWT. For the sake of the prototype, we can bypass or mock it.
// Actually, I'll update the backend temporarily or handle the token. 
// Let's create a temporary token for the admin user.

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

export default api;
