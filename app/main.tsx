import React from 'react';
import { createRoot } from 'react-dom/client';
import './theme.css';
import '../services/themeService'; // self-inits: applies saved light/dark on load
import '../services/languageService'; // self-inits: applies saved language + dir (LTR/RTL) on load
import { App } from './App';

const el = document.getElementById('root');
if (!el) throw new Error('Root element #root not found');
createRoot(el).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
