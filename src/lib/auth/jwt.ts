import { SignJWT, jwtVerify } from 'jose';

const SECRET_KEY = process.env.JWT_SECRET || 'forge-ai-super-secret-key-development-2026-xyz';
const encodedSecret = new TextEncoder().encode(SECRET_KEY);

export interface JWTPayload {
  userId: string;
  email: string;
}

/**
 * Sign user details into a stateless JWT token
 */
export async function signToken(payload: JWTPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(encodedSecret);
}

/**
 * Verify JWT token and return decoded payload
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedSecret);
    return payload as unknown as JWTPayload;
  } catch (error) {
    return null;
  }
}
