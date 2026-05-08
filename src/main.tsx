import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: { background: '#1a1a24', color: '#c9d1e0', border: '1px solid #2a2a38', fontSize: 13 },
        error: { style: { border: '1px solid #f87171', color: '#f87171' } },
        success: { style: { border: '1px solid #4ade80', color: '#4ade80' } },
        duration: 6000,
      }}
    />
  </StrictMode>,
);
