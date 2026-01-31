// Simple in-memory rate limiter for Vercel serverless
// For production, consider using Redis or Vercel KV

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

const store: RateLimitStore = {}

const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
// Increased limit for better user experience - can be adjusted via env variable
// In development, use a much higher limit or disable
const isDevelopment = process.env.NODE_ENV === 'development'
const MAX_REQUESTS_PER_WINDOW = process.env.RATE_LIMIT_MAX_REQUESTS 
  ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) 
  : isDevelopment 
    ? 100 // Very lenient in development (100 requests per minute)
    : 30 // 30 requests per minute per IP in production (increased from 10)

export function rateLimit(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const key = identifier

  if (!store[key] || now > store[key].resetTime) {
    // New window or expired window
    store[key] = {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    }
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_WINDOW - 1,
      resetTime: store[key].resetTime,
    }
  }

  if (store[key].count >= MAX_REQUESTS_PER_WINDOW) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: store[key].resetTime,
    }
  }

  store[key].count++
  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_WINDOW - store[key].count,
    resetTime: store[key].resetTime,
  }
}

// Clean up old entries periodically (simple cleanup)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    Object.keys(store).forEach((key) => {
      if (now > store[key].resetTime) {
        delete store[key]
      }
    })
  }, RATE_LIMIT_WINDOW)
}
