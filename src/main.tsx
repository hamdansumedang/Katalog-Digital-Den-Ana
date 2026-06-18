import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import WhatsAppBlast from './components/WhatsAppBlast.tsx';
import './index.css';

// Routing sederhana berbasis path (server & vite SPA fallback menangani refresh).
const isBlast = window.location.pathname.replace(/\/+$/, '') === '/blast';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isBlast ? <WhatsAppBlast /> : <App />}
  </StrictMode>,
);
