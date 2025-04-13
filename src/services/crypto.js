// src/services/crypto.js

/**
 * 端到端加密文件分享系统的加密服务
 * 使用Web Crypto API实现AES-GCM加密
 */

// 生成随机密码供加密使用
export const generatePassword = (length = 24) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+';
  const randomValues = new Uint8Array(length);
  window.crypto.getRandomValues(randomValues);
  
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(randomValues[i] % chars.length);
  }
  return password;
};

// 从密码派生加密密钥
export const deriveKey = async (password) => {
  // 将密码转换为 UTF-8 编码的 ArrayBuffer
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  // 导入密码作为原始密钥材料
  const importedKey = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  // 创建盐值 (salt)
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  
  // 使用PBKDF2从密码派生AES-GCM密钥
  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    importedKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  
  return { key: derivedKey, salt };
};

// 加密文件
export const encryptFile = async (fileData, password) => {
  try {
    console.log('Starting encryption');
    
    // Generate encryption key and salt
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    
    // Import password as raw key material
    const importedKey = await window.crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    
    // Generate salt
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    
    // Derive key using PBKDF2
    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      importedKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    // Generate IV
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt the data
    const encryptedData = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      fileData
    );
    
    console.log('Encryption successful');
    
    // Convert to base64 for storage
    const encryptedArray = new Uint8Array(encryptedData);
    const encryptedBase64 = btoa(String.fromCharCode(...encryptedArray));
    
    return {
      encryptedData: encryptedBase64,
      iv: btoa(String.fromCharCode(...iv)),
      salt: btoa(String.fromCharCode(...salt))
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt file');
  }
};

// 解密文件
export const decryptFile = async (encryptedData, password, ivBase64, saltBase64) => {
  try {
    console.log('Starting decryption with provided parameters');
    
    // Convert base64 strings to ArrayBuffers
    const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
    const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
    
    // Convert password to ArrayBuffer
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    
    // Import password as raw key material
    const importedKey = await window.crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    
    // Derive key using PBKDF2
    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      importedKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    // Decrypt the data
    const decryptedData = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      encryptedData
    );
    
    console.log('Decryption successful');
    return decryptedData;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt file. Please check your password and try again.');
  }
};
