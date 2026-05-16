import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  database: {
    url: process.env.DATABASE_URL || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  cookies: {
    accessName: process.env.ACCESS_TOKEN_COOKIE || 'access_token',
    refreshName: process.env.REFRESH_TOKEN_COOKIE || 'refresh_token',
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: (process.env.COOKIE_SAMESITE || 'lax') as 'lax' | 'strict' | 'none',
    domain: process.env.COOKIE_DOMAIN || undefined,
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  aiService: {
    url: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  },

  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
  },

  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
    bucket: process.env.SUPABASE_STORAGE_BUCKET || 'resumes',
  },

  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
  },
};
