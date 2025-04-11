// src/pages/HomePage.js

import React from 'react';
import { Link } from 'react-router-dom';

const HomePage = () => {
  return (
    <div className="home-page">
      <div className="hero-section">
        <h1>安全、私密的端到端加密文件分享</h1>
        <p className="subtitle">在您的浏览器中加密，服务器永远不会看到您的文件内容或密钥</p>
        
        <div className="cta-buttons">
          <Link to="/upload" className="primary-button">
            加密并分享文件
          </Link>
        </div>
      </div>
      
      <div className="features-section">
        <h2>为什么选择我们的服务？</h2>
        
        <div className="features-grid">
          <div className="feature-card">
            <h3>端到端加密</h3>
            <p>文件在您的浏览器中使用AES-GCM加密，确保只有您和收件人可以访问内容</p>
          </div>
          
          <div className="feature-card">
            <h3>零知识架构</h3>
            <p>我们的服务器永远不会看到您的文件内容或加密密钥，即使被黑客入侵也不会泄露您的数据</p>
          </div>
          
          <div className="feature-card">
            <h3>分离的链接和密码</h3>
            <p>下载链接和解密密码可以通过不同渠道分享，提高安全性</p>
          </div>
          
          <div className="feature-card">
            <h3>简单易用</h3>
            <p>无需注册或安装插件，只需上传文件并分享链接和密码</p>
          </div>
        </div>
      </div>
      
      <div className="how-it-works-section">
        <h2>工作原理</h2>
        
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <h3>上传文件</h3>
            <p>在浏览器中选择您要分享的文件</p>
          </div>
          
          <div className="step">
            <div className="step-number">2</div>
            <h3>客户端加密</h3>
            <p>文件在您的浏览器中使用强大的AES加密</p>
          </div>
          
          <div className="step">
            <div className="step-number">3</div>
            <h3>获取链接和密码</h3>
            <p>系统生成下载链接和独立的解密密码</p>
          </div>
          
          <div className="step">
            <div className="step-number">4</div>
            <h3>安全分享</h3>
            <p>通过不同渠道分享链接和密码给接收者</p>
          </div>
          
          <div className="step">
            <div className="step-number">5</div>
            <h3>安全下载</h3>
            <p>接收者使用链接下载文件，然后用密码在本地解密</p>
          </div>
        </div>
      </div>
      
      <div className="security-section">
        <h2>安全是我们的首要任务</h2>
        <p>我们的文件分享系统采用多层安全措施保护您的隐私：</p>
        
        <ul className="security-features">
          <li>在浏览器中使用AES-GCM加密算法</li>
          <li>安全随机密钥生成</li>
          <li>TLS 1.3加密传输</li>
          <li>零知识后端 - 服务器从不处理或存储明文或密钥</li>
          <li>开源代码允许安全审计</li>
        </ul>
      </div>
    </div>
  );
};

export default HomePage;
