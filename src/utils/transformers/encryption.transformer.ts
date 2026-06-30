import * as crypto from 'crypto';
import { ValueTransformer } from 'typeorm';

const ALGORITHM = 'aes-256-gcm';

export const encryptionTransformer: ValueTransformer = {
  to(value: string | null): string | null {
    if (!value) return null;
    
    const secretKey = process.env.ENCRYPTION_KEY;
    if (!secretKey || secretKey.length !== 32) {
      console.warn('ENCRYPTION_KEY is missing or invalid (must be 32 chars). Tokens will not be encrypted properly.');
      // Bỏ qua mã hóa nếu không có key, hoặc throw Error tuỳ yêu cầu bảo mật nghiêm ngặt.
      // Ở đây throw lỗi để đảm bảo không lưu plaintext vô tình.
      throw new Error('ENCRYPTION_KEY is required and must be 32 characters long for AES-256-GCM.');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(secretKey), iv);
    
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Lưu với định dạng: iv:authTag:encryptedText
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  },
  
  from(value: string | null): string | null {
    if (!value) return null;
    
    const parts = value.split(':');
    // Nếu không đúng định dạng (có thể là data cũ chưa mã hoá), trả về nguyên vẹn
    if (parts.length !== 3) return value;
    
    const [ivHex, authTagHex, encryptedText] = parts;
    const secretKey = process.env.ENCRYPTION_KEY;
    if (!secretKey || secretKey.length !== 32) {
      throw new Error('ENCRYPTION_KEY is required and must be 32 characters long to decrypt tokens.');
    }

    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(secretKey), Buffer.from(ivHex, 'hex'));
      decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
      
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('Error decrypting token:', error);
      // Tránh việc lỗi giải mã làm crash toàn bộ query get User
      return null; 
    }
  }
};
