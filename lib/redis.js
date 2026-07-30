import { Redis } from '@upstash/redis';

// Mendukung nama variabel lingkungan dari integrasi Vercel Marketplace (Redis/Upstash)
// maupun dari akun Upstash langsung, agar setup di dashboard Vercel tetap simpel.
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = new Redis({ url, token });
