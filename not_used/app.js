// src/App.js

import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import { createUploadLink } from 'apollo-upload-client';
import { ApolloClient, InMemoryCache } from '@apollo/client';

// 导入页面组件
import Navbar from '../src/components/Navbar';
import HomePage from '../src/pages/HomePage';
import UploadPage from '../src/pages/UploadPage';
import FileDownload from '../src/components/FileDownload';
import NotFoundPage from '../src/pages/NotFoundPage';

// 创建Apollo客户端
const client = new ApolloClient({
  link: createUploadLink({
    uri: process.env.REACT_APP_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql',
    credentials: 'include',  // 添加这行
    headers: {
      'Apollo-Require-Preflight': 'true'
    }
  }),
  cache: new InMemoryCache()
});

// 主应用组件
function App() {
  return (
    <ApolloProvider client={client}>
      <Router>
        <div className="app">
          <Navbar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/download/:downloadId" element={<FileDownload />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
          <footer className="footer">
            <p>&copy; {new Date().getFullYear()} 端到端加密文件分享 | 团队23</p>
            <p>使用端到端加密技术，保护您的隐私</p>
          </footer>
        </div>
      </Router>
    </ApolloProvider>
  );
}

export default App;
