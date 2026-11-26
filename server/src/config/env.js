const { z } = require('zod');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  BUSINESS_TIMEZONE: z.string().default('Asia/Kolkata'),
  COOKIE_SECURE: z.enum(['true','false']).default('false'),
  ADMIN_NAME: z.string().default('BloomVoice Admin'),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('gemini-2.5-flash'),
  AI_BASE_URL: z.string().default('https://generativelanguage.googleapis.com/v1beta/openai/')
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '));
  process.exit(1);
}
module.exports = parsed.data;
