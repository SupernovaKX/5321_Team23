// src/pages/UploadPage.js

import React, { useState } from 'react';
import FileUpload from '../components/FileUpload';
import ShareLinks from '../components/ShareLinks';

const UploadPage = () => {
  const [uploadResult, setUploadResult] = useState(null);
  
  const handleUploadComplete = (result) => {
    setUploadResult(result);
    
    // Save information to history
    const history = JSON.parse(localStorage.getItem('uploadHistory') || '[]');
    history.unshift({
      ...result,
      uploadedAt: new Date().toISOString(),
    });
    
    // Keep only the last 10 records
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
            Upload New File
          </button>
        </div>
      )}
    </div>
  );
};

export default UploadPage;
