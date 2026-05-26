import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Hash password securely using Node's native scrypt algorithm
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hashedPassword = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hashedPassword}`;
}

/**
 * Verify password against stored secure hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, hash] = parts;
    const targetHash = scryptSync(password, salt, 64).toString('hex');
    
    const bufferA = Buffer.from(hash, 'hex');
    const bufferB = Buffer.from(targetHash, 'hex');
    
    return timingSafeEqual(bufferA, bufferB);
  } catch (e) {
    return false;
  }
}
