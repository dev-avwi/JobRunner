import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getMasterKey(): Buffer {
  const masterKeyBase64 = process.env.EMAIL_ENCRYPTION_KEY;
  
  if (!masterKeyBase64) {
    console.warn('⚠️ EMAIL_ENCRYPTION_KEY not set - SMTP credentials will be stored unencrypted');
    return Buffer.alloc(0);
  }
  
  try {
    const key = Buffer.from(masterKeyBase64, 'base64');
    if (key.length !== 32) {
      console.error('EMAIL_ENCRYPTION_KEY must be 32 bytes (256 bits)');
      return Buffer.alloc(0);
    }
    return key;
  } catch (error) {
    console.error('Invalid EMAIL_ENCRYPTION_KEY format');
    return Buffer.alloc(0);
  }
}

export function isEncryptionEnabled(): boolean {
  return getMasterKey().length === 32;
}

export function encrypt(plaintext: string): string {
  const masterKey = getMasterKey();
  
  if (masterKey.length === 0) {
    return plaintext;
  }
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'base64')]);
  return combined.toString('base64');
}

export function decrypt(ciphertext: string): string {
  const masterKey = getMasterKey();
  
  if (masterKey.length === 0) {
    return ciphertext;
  }
  
  try {
    const combined = Buffer.from(ciphertext, 'base64');
    
    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      return ciphertext;
    }
    
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encryptedData = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.warn('Failed to decrypt - value may be unencrypted or corrupted');
    return ciphertext;
  }
}

export function generateMasterKey(): string {
  const key = crypto.randomBytes(32);
  return key.toString('base64');
}
