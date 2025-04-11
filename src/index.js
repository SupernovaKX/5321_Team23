import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './services/app-js';
import './style.css';  // 添加这一行

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);