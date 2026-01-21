import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  LOCKOUT_CONFIG,
  TokenPayload,
} from '../utils/auth';
import { loginRateLimiter } from '../middleware/rateLimit';

const router = Router();

/**
 * POST /api/auth/login
 * Login with username and password
 */
router.post('/login', loginRateLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      res.status(423).json({
        error: `Account is locked. Try again in ${remainingMinutes} minutes.`,
        lockedUntil: user.lockedUntil,
      });
      return;
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password);

    if (!isValidPassword) {
      // Increment failed attempts
      const newFailedAttempts = user.failedAttempts + 1;
      const updateData: { failedAttempts: number; lockedUntil?: Date } = {
        failedAttempts: newFailedAttempts,
      };

      // Lock account if max attempts reached
      if (newFailedAttempts >= LOCKOUT_CONFIG.maxAttempts) {
        updateData.lockedUntil = new Date(Date.now() + LOCKOUT_CONFIG.lockoutDuration);
        await prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
        res.status(423).json({
          error: `Account locked due to too many failed attempts. Try again in 30 minutes.`,
          attemptsRemaining: 0,
        });
        return;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      res.status(401).json({
        error: 'Invalid username or password',
        attemptsRemaining: LOCKOUT_CONFIG.maxAttempts - newFailedAttempts,
      });
      return;
    }

    // Reset failed attempts on successful login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
      },
    });

    // Generate tokens
    const tokenPayload: TokenPayload = {
      userId: user.id,
      username: user.username,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Set refresh token as HttpOnly cookie (3 days for security)
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
    });

    // Set access token as HttpOnly cookie (XSS protection)
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 2 * 60 * 60 * 1000, // 2 hours
    });

    res.json({
      message: 'Login successful',
      accessToken,
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/logout
 * Clear tokens and logout
 */
router.post('/logout', (_req: Request, res: Response) => {
  // Must use the same options as when setting cookies for proper clearing
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const,
  };
  
  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);
  res.json({ message: 'Logout successful' });
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh token not found' });
      return;
    }

    const decoded = verifyToken(refreshToken);
    if (!decoded) {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    // Verify user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Generate new tokens (refresh token rotation for security)
    const tokenPayload: TokenPayload = {
      userId: user.id,
      username: user.username,
    };

    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    // Set new access token cookie (HttpOnly for XSS protection)
    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 2 * 60 * 60 * 1000, // 2 hours
    });

    // Rotate refresh token (invalidates old token)
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
    });

    res.json({
      message: 'Token refreshed',
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info (requires auth)
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    // Get token from header or cookie
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password using secret key
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { secretKey, newPassword } = req.body;

    // Validate input
    if (!secretKey) {
      res.status(400).json({ error: 'Secret key is required' });
      return;
    }

    if (!newPassword) {
      res.status(400).json({ error: 'New password is required' });
      return;
    }

    // Validate password length
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    // Get secret key from environment
    const validSecretKey = process.env.PW_RESET_KEY;

    if (!validSecretKey) {
      console.error('PW_RESET_KEY not configured in environment');
      res.status(500).json({ error: 'Password reset is not configured' });
      return;
    }

    // Verify secret key
    if (secretKey !== validSecretKey) {
      res.status(403).json({ error: 'Invalid secret key' });
      return;
    }

    // Find admin user (first user or username 'admin')
    const user = await prisma.user.findFirst({
      where: { username: 'admin' },
    });

    if (!user) {
      res.status(404).json({ error: 'Admin user not found' });
      return;
    }

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password and reset lockout
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        failedAttempts: 0,
        lockedUntil: null,
      },
    });

    console.log(`Password reset for user: ${user.username}`);

    res.json({
      message: 'Password reset successful',
      username: user.username,
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
