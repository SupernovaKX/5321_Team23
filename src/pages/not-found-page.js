// src/pages/NotFoundPage.js

import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage = () => {
  return (
    <div className="not-found-page">
      <div className="not-found-content">
        <div className="not-found-icon">
          <svg viewBox="0 0 24 24" width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 15h2v2h-2v-2zm0-8h2v6h-2V7zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" fill="currentColor" />
          </svg>
        </div>
        <h1>404</h1>
        <h2>页面未找到</h2>
        <p>您请求的页面不存在或已被移除。</p>
        <div className="not-found-actions">
          <Link to="/" className="primary-button">
            返回首页
          </Link>
          <Link to="/upload" className="secondary-button">
            上传文件
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
