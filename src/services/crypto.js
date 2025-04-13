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
    console.log('Starting encryption process');
    console.log('Input parameters:', {
      fileDataLength: fileData.byteLength,
      passwordLength: password.length,
      passwordFirstChars: password.substring(0, 10)
    });

    // Generate salt first (16 bytes)
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    console.log('Generated salt:', {
      length: salt.length,
      firstBytes: new Uint8Array(salt.slice(0, 4)),
      lastBytes: new Uint8Array(salt.slice(-4))
    });

    // Generate IV (16 bytes for consistency)
    const iv = window.crypto.getRandomValues(new Uint8Array(16));
    console.log('Generated IV:', {
      length: iv.length,
      firstBytes: new Uint8Array(iv.slice(0, 4)),
      lastBytes: new Uint8Array(iv.slice(-4))
    });

    // Convert password to ArrayBuffer
    console.log('Converting password to ArrayBuffer...');
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    console.log('Password buffer details:', {
      size: passwordBuffer.byteLength,
      firstBytes: new Uint8Array(passwordBuffer.slice(0, 4)),
      lastBytes: new Uint8Array(passwordBuffer.slice(-4))
    });

    // Import password as raw key material
    console.log('Importing password as raw key material...');
    const importedKey = await window.crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    console.log('Password key imported successfully');

    // Derive key using PBKDF2
    console.log('Deriving key using PBKDF2...');
    console.log('PBKDF2 parameters:', {
      saltLength: salt.length,
      saltFirstBytes: new Uint8Array(salt.slice(0, 4)),
      saltLastBytes: new Uint8Array(salt.slice(-4)),
      iterations: 100000,
      hash: 'SHA-256'
    });

    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      importedKey,
      { 
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    );
    console.log('Key derived successfully:', {
      algorithm: key.algorithm.name,
      length: key.algorithm.length,
      extractable: key.extractable,
      usages: key.usages
    });

    // Encrypt the data
    console.log('Starting encryption with AES-GCM...');
    console.log('Encryption parameters:', {
      ivLength: iv.length,
      ivFirstBytes: new Uint8Array(iv.slice(0, 4)),
      ivLastBytes: new Uint8Array(iv.slice(-4)),
      tagLength: 128,
      fileDataLength: fileData.byteLength,
      fileDataFirstBytes: new Uint8Array(fileData.slice(0, 4)),
      fileDataLastBytes: new Uint8Array(fileData.slice(-4))
    });

    const encryptedData = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128
      },
      key,
      fileData
    );

    console.log('Encryption successful');
    console.log('Encrypted data details:', {
      size: encryptedData.byteLength,
      firstBytes: new Uint8Array(encryptedData.slice(0, 4)),
      lastBytes: new Uint8Array(encryptedData.slice(-4))
    });

    // Convert IV and salt to base64 for storage in database
    const ivBase64 = arrayBufferToBase64(iv);
    const saltBase64 = arrayBufferToBase64(salt);

    console.log('Base64 conversions:', {
      ivLength: ivBase64.length,
      saltLength: saltBase64.length
    });

    return {
      encryptedData,  // Return the binary data directly
      iv: ivBase64,
      salt: saltBase64
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw error;
  }
};

// 解密文件
export const decryptFile = async (encryptedData, password, ivBase64, saltBase64) => {
  try {
    console.log('Starting decryption process');
    console.log('Input parameters:', {
      encryptedDataLength: encryptedData?.byteLength,
      ivLength: ivBase64?.length,
      saltLength: saltBase64?.length,
      passwordLength: password?.length
    });

    // Convert base64 strings to ArrayBuffers for IV and salt
    const iv = saferBase64ToArrayBuffer(ivBase64);
    const salt = saferBase64ToArrayBuffer(saltBase64);

    console.log('Converted to ArrayBuffers:', {
      ivLength: iv?.byteLength,
      saltLength: salt?.byteLength,
      encryptedLength: encryptedData?.byteLength
    });

    // Verify IV and salt lengths
    if (!iv || iv.byteLength !== 16) {
      throw new Error(`Invalid IV length: expected 16 bytes, got ${iv?.byteLength}`);
    }
    if (!salt || salt.byteLength !== 16) {
      throw new Error(`Invalid salt length: expected 16 bytes, got ${salt?.byteLength}`);
    }

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
      { 
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    );

    console.log('Key derived successfully:', {
      algorithm: key.algorithm.name,
      length: key.algorithm.length,
      extractable: key.extractable,
      usages: key.usages
    });

    // Decrypt the data
    console.log('Starting decryption with AES-GCM...');
    console.log('Decryption parameters:', {
      ivLength: iv.byteLength,
      ivFirstBytes: new Uint8Array(iv.slice(0, 4)),
      ivLastBytes: new Uint8Array(iv.slice(-4)),
      tagLength: 128,
      encryptedLength: encryptedData.byteLength,
      encryptedFirstBytes: new Uint8Array(encryptedData.slice(0, 4)),
      encryptedLastBytes: new Uint8Array(encryptedData.slice(-4))
    });

    const decryptedData = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128
      },
      key,
      encryptedData
    );

    console.log('Decryption successful');
    console.log('Decrypted data details:', {
      size: decryptedData.byteLength,
      firstBytes: new Uint8Array(decryptedData.slice(0, 4)),
      lastBytes: new Uint8Array(decryptedData.slice(-4))
    });

    return decryptedData;
  } catch (error) {
    console.error('Decryption error:', error);
    throw error;
  }
};

// Helper function for safer base64 to ArrayBuffer conversion
function saferBase64ToArrayBuffer(base64) {
  try {
    if (!base64) {
      throw new Error('Base64 string is undefined or null');
    }

    console.log('Converting base64 to ArrayBuffer:', {
      inputLength: base64.length,
      firstChar: base64.charAt(0),
      lastChar: base64.charAt(base64.length - 1)
    });

    // For URL-safe base64, replace safe chars with standard base64 chars
    const standardBase64 = base64
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    // Add padding if necessary
    let paddedBase64 = standardBase64;
    const mod4 = standardBase64.length % 4;
    if (mod4) {
      paddedBase64 += '='.repeat(4 - mod4);
    }

    console.log('Base64 after processing:', {
      length: paddedBase64.length,
      firstChar: paddedBase64.charAt(0),
      lastChar: paddedBase64.charAt(paddedBase64.length - 1)
    });

    // Convert base64 to binary string
    const binaryString = atob(paddedBase64);
    console.log('Binary string length:', binaryString.length);
    
    // Create a new ArrayBuffer with the correct size
    const buffer = new ArrayBuffer(binaryString.length);
    const bytes = new Uint8Array(buffer);
    
    // Fill the ArrayBuffer with the binary data
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    console.log('ArrayBuffer created:', {
      byteLength: buffer.byteLength,
      firstByte: bytes[0],
      lastByte: bytes[bytes.length - 1],
      firstBytes: new Uint8Array(buffer.slice(0, 4)),
      lastBytes: new Uint8Array(buffer.slice(-4))
    });

    // Verify the buffer is not empty and has the expected length
    if (buffer.byteLength === 0) {
      throw new Error('Resulting ArrayBuffer is empty');
    }

    return buffer;
  } catch (error) {
    console.error('Base64 decoding failed:', {
      error: error.message,
      input: base64?.substring(0, 20) + '...',
      inputLength: base64?.length
    });
    throw error;
  }
}

// Convert string to ArrayBuffer (for direct binary interpretation)
function stringToArrayBuffer(str) {
  if (!str) {
    throw new Error('String is undefined or null');
  }

  const buffer = new ArrayBuffer(str.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return buffer;
}

// Helper function for ArrayBuffer to base64 conversion
function arrayBufferToBase64(buffer) {
  if (!buffer) {
    throw new Error('Buffer is undefined or null');
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Add this test function at the end of the file
export const testEncryption = async () => {
  try {
    console.log('Starting encryption/decryption test...');
    
    // Create a small test data
    const testData = new TextEncoder().encode('Hello, World!');
    const testPassword = 'testpassword1234567890';
    
    console.log('Test data:', {
      size: testData.byteLength,
      content: new TextDecoder().decode(testData)
    });

    // Generate salt and IV
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(16));

    console.log('Generated salt and IV:', {
      saltLength: salt.length,
      saltFirstBytes: new Uint8Array(salt.slice(0, 4)),
      ivLength: iv.length,
      ivFirstBytes: new Uint8Array(iv.slice(0, 4))
    });

    // Convert password to ArrayBuffer
    const passwordBuffer = new TextEncoder().encode(testPassword);
    
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
      { 
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['encrypt', 'decrypt']
    );

    console.log('Key derived:', {
      algorithm: key.algorithm.name,
      length: key.algorithm.length,
      extractable: key.extractable,
      usages: key.usages
    });

    // Encrypt the data
    console.log('Encrypting test data...');
    const encryptedData = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128
      },
      key,
      testData
    );

    console.log('Encryption successful:', {
      encryptedSize: encryptedData.byteLength,
      firstBytes: new Uint8Array(encryptedData.slice(0, 4))
    });

    // Now try to decrypt
    console.log('Attempting decryption...');
    const decryptedData = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128
      },
      key,
      encryptedData
    );

    const decryptedText = new TextDecoder().decode(decryptedData);
    console.log('Decryption successful:', {
      decryptedSize: decryptedData.byteLength,
      content: decryptedText
    });

    return decryptedText === 'Hello, World!';
  } catch (error) {
    console.error('Test failed:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      error: error
    });
    throw error;
  }
};

// Add this test function at the end of the file
export const testFullProcess = async () => {
  try {
    console.log('Starting full encryption/decryption process test...');
    
    // 1. Create test data
    const testData = new TextEncoder().encode('Hello, World!');
    const testPassword = 'testpassword1234567890';
    
    console.log('Test data:', {
      size: testData.byteLength,
      content: new TextDecoder().decode(testData)
    });

    // 2. Generate salt and IV
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(16));

    console.log('Generated salt and IV:', {
      saltLength: salt.length,
      saltBytes: Array.from(new Uint8Array(salt)),
      ivLength: iv.length,
      ivBytes: Array.from(new Uint8Array(iv))
    });

    // 3. Convert password to ArrayBuffer
    const passwordBuffer = new TextEncoder().encode(testPassword);
    
    // 4. Import password as raw key material
    const importedKey = await window.crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      true,
      ['deriveKey']
    );

    // 5. Derive key using PBKDF2
    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      importedKey,
      { 
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    );

    console.log('Key derived:', {
      algorithm: key.algorithm.name,
      length: key.algorithm.length,
      extractable: key.extractable,
      usages: key.usages
    });

    // 6. Encrypt the data
    console.log('Encrypting test data...');
    const encryptedData = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128
      },
      key,
      testData
    );

    console.log('Encryption successful:', {
      encryptedSize: encryptedData.byteLength,
      firstBytes: Array.from(new Uint8Array(encryptedData.slice(0, 4))),
      lastBytes: Array.from(new Uint8Array(encryptedData.slice(-4)))
    });

    // 7. Convert to base64 for storage
    const encryptedBase64 = arrayBufferToBase64(encryptedData);
    const ivBase64 = arrayBufferToBase64(iv);
    const saltBase64 = arrayBufferToBase64(salt);

    console.log('Base64 conversions:', {
      encryptedLength: encryptedBase64.length,
      ivLength: ivBase64.length,
      saltLength: saltBase64.length
    });

    // 8. Now try to decrypt using the same process as the actual file decryption
    console.log('Starting decryption process...');
    
    // Convert base64 back to ArrayBuffers
    const ivBuffer = saferBase64ToArrayBuffer(ivBase64);
    const saltBuffer = saferBase64ToArrayBuffer(saltBase64);
    const encryptedBuffer = saferBase64ToArrayBuffer(encryptedBase64);

    console.log('Converted back to ArrayBuffers:', {
      ivLength: ivBuffer.byteLength,
      saltLength: saltBuffer.byteLength,
      encryptedLength: encryptedBuffer.byteLength
    });

    // Import password again
    const importedKey2 = await window.crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      true,
      ['deriveKey']
    );

    // Derive key again
    const key2 = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: 100000,
        hash: 'SHA-256'
      },
      importedKey2,
      { 
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    );

    // Decrypt
    const decryptedData = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer,
        tagLength: 128
      },
      key2,
      encryptedBuffer
    );

    const decryptedText = new TextDecoder().decode(decryptedData);
    console.log('Decryption successful:', {
      decryptedSize: decryptedData.byteLength,
      content: decryptedText
    });

    return decryptedText === 'Hello, World!';
  } catch (error) {
    console.error('Test failed:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      error: error
    });
    throw error;
  }
};
