import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from './pages/Dashboard';
import JobCards from './pages/JobCards';
import Inventory from './pages/Inventory';
import AppLayout from './layouts/AppLayout';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="job-cards" element={<JobCards />} />
            <Route path="master-data" element={<div className="p-4 text-center text-muted-foreground">Master Data Module Coming Soon</div>} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="production" element={<div className="p-4 text-center text-muted-foreground">Production Tracking Module Coming Soon</div>} />
            <Route path="settings" element={<div className="p-4 text-center text-muted-foreground">Settings Module Coming Soon</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
