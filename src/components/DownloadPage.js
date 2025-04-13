import React, { useState } from 'react';
import { decryptFile } from '../services/crypto';
import { testEncryption } from '../services/crypto';

const DownloadPage = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [testResult, setTestResult] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  const handleTest = async () => {
    try {
      setTestResult('Running test...');
      const result = await testEncryption();
      setTestResult(result ? 'Test successful!' : 'Test failed - decrypted text did not match');
    } catch (error) {
      setTestResult(`Test failed: ${error.message}`);
      console.error('Test error:', error);
    }
  };

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      setError('');
      // Your existing download logic here
      // ...
    } catch (error) {
      setError(error.message);
      console.error('Download error:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Download Encrypted File</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="password">Password:</label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ marginLeft: '10px', padding: '5px' }}
        />
      </div>

      <button 
        onClick={handleDownload} 
        disabled={isDownloading}
        style={{ padding: '10px 20px', marginRight: '10px' }}
      >
        {isDownloading ? 'Downloading...' : 'Download'}
      </button>

      {error && (
        <div style={{ color: 'red', marginTop: '10px' }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: '20px', padding: '10px', border: '1px solid #ccc' }}>
        <h3>Encryption/Decryption Test</h3>
        <button 
          onClick={handleTest}
          style={{ padding: '10px 20px' }}
        >
          Run Test
        </button>
        {testResult && (
          <p style={{ marginTop: '10px' }}>
            {testResult}
          </p>
        )}
      </div>
    </div>
  );
};

export default DownloadPage; 