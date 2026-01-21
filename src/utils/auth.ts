import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';

const SALT_ROUNDS = 10;

// JWT Secret validation - fail fast if not configured
const envJwtSecret = process.env.JWT_SECRET;
if (!envJwtSecret) {
  throw new Error('FATAL: JWT_SECRET environment variable is required. Please set it in your .env file.');
}
const JWT_SECRET: string = envJwtSecret;

// 2 hours in seconds
const JWT_EXPIRES_IN_SECONDS = 2 * 60 * 60;
// 3 days in seconds (reduced from 7 days for security)
const JWT_REFRESH_EXPIRES_IN_SECONDS = 3 * 24 * 60 * 60;

export interface TokenPayload {
  userId: number;
  username: string;
}

/**
 * Hash a plain text password using bcrypt
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Verify a plain text password against a hash
 */
export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Generate JWT access token (short-lived, 2 hours)
 */
export function generateAccessToken(payload: TokenPayload): string {
  const options: SignOptions = { expiresIn: JWT_EXPIRES_IN_SECONDS };
  return jwt.sign(payload, JWT_SECRET, options);
}

/**
 * Generate JWT refresh token (long-lived, 7 days)
 */
export function generateRefreshToken(payload: TokenPayload): string {
  const options: SignOptions = { expiresIn: JWT_REFRESH_EXPIRES_IN_SECONDS };
  return jwt.sign(payload, JWT_SECRET, options);
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Account lockout configuration
 */
export const LOCKOUT_CONFIG = {
  maxAttempts: 10,          // 10 failed attempts
  lockoutDuration: 30 * 60 * 1000, // 30 minutes in milliseconds
};
