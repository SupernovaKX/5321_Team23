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

// 文件加密函数
export const encryptFile = async (file, password) => {
  try {
    // 生成加密密钥和初始化向量
    const { key, salt } = await deriveKey(password);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // 读取文件内容为 ArrayBuffer
    const fileBuffer = await file.arrayBuffer();
    
    // 使用 AES-GCM 加密
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      fileBuffer
    );
    
    // 创建加密后的文件对象
    const encryptedFile = new Blob([encryptedBuffer]);
    
    // 返回加密文件和元数据
    return {
      encryptedFile,
      metadata: {
        salt: Array.from(salt),
        iv: Array.from(iv),
        originalName: file.name,
        originalType: file.type,
        originalSize: file.size
      }
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
