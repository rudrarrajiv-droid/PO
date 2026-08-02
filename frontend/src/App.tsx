import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from './pages/Dashboard';
import JobCards from './pages/JobCards';
import MasterData from './pages/MasterData';
import Inventory from './pages/Inventory';
import Production from './pages/Production';
import ProductionTracker from './pages/ProductionTracker';
import Settings from './pages/Settings';
import Login from './pages/Login';
import AppLayout from './layouts/AppLayout';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="job-cards" element={<JobCards />} />
                <Route path="master-data" element={<MasterData />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="production" element={<ProductionTracker />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
