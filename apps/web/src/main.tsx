import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/urbanist';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/lora/400.css';
import '@fontsource/lora/600.css';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
