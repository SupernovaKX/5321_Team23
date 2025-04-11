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
export const encryptFile = async (file, password) => {
  // 生成加密密钥和初始化向量
  const { key, salt } = await deriveKey(password);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  // 读取文件内容
  const fileBuffer = await file.arrayBuffer();
  
  // 使用AES-GCM加密文件
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    fileBuffer
  );
  
  // 创建包含所有必要数据的结果对象
  const encryptedFile = new Blob([encryptedBuffer], { type: 'application/octet-stream' });
  
  // 导出密钥以便后续解密
  const exportedKeyBuffer = await window.crypto.subtle.exportKey('raw', key);
  
  // 返回加密文件和解密所需的元数据
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
};

// 解密文件
export const decryptFile = async (encryptedFile, metadata, password) => {
  const { salt, iv, originalName, originalType } = metadata;
  
  // 重新创建密钥
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
  
  // 使用相同的盐值和迭代次数派生相同的密钥
  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(salt),
      iterations: 100000,
      hash: 'SHA-256'
    },
    importedKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  
  // 读取加密文件内容
  const encryptedBuffer = await encryptedFile.arrayBuffer();
  
  // 使用AES-GCM解密文件
  try {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(iv)
      },
      derivedKey,
      encryptedBuffer
    );
    
    // 创建解密后的文件Blob，恢复原始文件类型
    const decryptedFile = new Blob([decryptedBuffer], { type: originalType || 'application/octet-stream' });
    
    return {
      file: decryptedFile,
      fileName: originalName
    };
  } catch (error) {
    throw new Error('解密失败！请检查密码是否正确。');
  }
};
