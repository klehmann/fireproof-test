// Encryption utilities for secure key export/import

export const deriveKeyFromSecret = async (secret: string): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('fireproof-keybag-salt'), // Fixed salt for consistency
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

export const encryptKeyData = async (keyData: any, secret: string): Promise<string> => {
  const key = await deriveKeyFromSecret(secret);
  const encoder = new TextEncoder();
  const jsonString = JSON.stringify(keyData);
  const data = encoder.encode(jsonString);
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt the data
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    data
  );
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encryptedData.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedData), iv.length);
  
  // Convert to base64
  return btoa(String.fromCharCode(...combined));
};

export const decryptKeyData = async (encryptedBase64: string, secret: string): Promise<any> => {
  const key = await deriveKeyFromSecret(secret);
  
  // Decode base64
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  
  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const encryptedData = combined.slice(12);
  
  // Decrypt the data
  const decryptedData = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encryptedData
  );
  
  // Convert back to JSON
  const decoder = new TextDecoder();
  const jsonString = decoder.decode(decryptedData);
  return JSON.parse(jsonString);
};

export const createSecureKeyWrapper = (keyData: any): any => {
  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    type: 'fireproof-keybag-export',
    data: keyData,
    checksum: btoa(JSON.stringify(keyData)).slice(0, 16) // Simple checksum for validation
  };
};

export const validateSecureKeyWrapper = (wrapper: any): boolean => {
  if (!wrapper || typeof wrapper !== 'object') return false;
  if (wrapper.version !== '1.0') return false;
  if (wrapper.type !== 'fireproof-keybag-export') return false;
  if (!wrapper.timestamp || !wrapper.data) return false;
  
  // Validate timestamp format
  try {
    new Date(wrapper.timestamp);
  } catch {
    return false;
  }
  
  // Validate checksum
  const expectedChecksum = btoa(JSON.stringify(wrapper.data)).slice(0, 16);
  return wrapper.checksum === expectedChecksum;
};
