import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import LocalizationProvider from './i18n/LocalizationProvider';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LocalizationProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </LocalizationProvider>
  </React.StrictMode>
);
