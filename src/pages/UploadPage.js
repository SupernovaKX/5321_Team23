// src/pages/UploadPage.js

import React, { useState } from 'react';
import FileUpload from '../components/FileUpload';
import ShareLinks from '../components/ShareLinks';

const UploadPage = () => {
  const [uploadResult, setUploadResult] = useState(null);
  
  const handleUploadComplete = (result) => {
    setUploadResult(result);
    
    // 将信息保存到历史记录
    const history = JSON.parse(localStorage.getItem('uploadHistory') || '[]');
    history.unshift({
      ...result,
      uploadedAt: new Date().toISOString(),
    });
    
    // 只保留最近10条记录
    if (history.length > 10) {
      history.length = 10;
    }
    
    localStorage.setItem('uploadHistory', JSON.stringify(history));
  };
  
  const handleReset = () => {
    setUploadResult(null);
  };
  
  return (
    <div className="upload-page">
      {!uploadResult ? (
        <FileUpload onUploadComplete={handleUploadComplete} />
      ) : (
        <div>
          <ShareLinks {...uploadResult} />
          <button className="reset-button" onClick={handleReset}>
            上传新文件
          </button>
        </div>
      )}
    </div>
  );
};

export default UploadPage;
