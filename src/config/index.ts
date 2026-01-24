import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(' Missing required environment variables:');
  missingEnvVars.forEach((envVar) => {
    console.error(`   - ${envVar}`);
  });
  console.error('\nPlease add these to your .env file and restart the server.');
  process.exit(1);
}

// Warn if using default values in production
if (process.env.NODE_ENV === 'production') {
  if (!process.env.CORS_ORIGIN) {
    console.warn('  Warning: CORS_ORIGIN not set. Using default: http://localhost:3000');
  }
  if (!process.env.PW_RESET_KEY) {
    console.warn('  Warning: PW_RESET_KEY not set. Password reset feature will be disabled.');
  }
}

// Parse CORS origins - support comma-separated list
const parseCorsOrigins = (): string | string[] => {
  const corsEnv = process.env.CORS_ORIGIN || 'http://localhost:3000';
  // If it contains a comma, split it into an array
  if (corsEnv.includes(',')) {
    return corsEnv.split(',').map((origin) => origin.trim());
  }
  return corsEnv;
};

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  corsOrigin: parseCorsOrigins(),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
} as const;

