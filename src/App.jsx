import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainWebsite from './components/MainWebsite';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main Application / OASIS Dashboard with Floating AI Copilot */}
        <Route path="/" element={<MainWebsite />} />

        {/* Redirect legacy auth paths directly to main application */}
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/register" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
