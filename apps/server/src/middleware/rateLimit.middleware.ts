import rateLimit from "express-rate-limit";

// General rate limiter for all API endpoints to protect against basic DoS/spamming
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 150, // Limit each IP to 150 requests per window
  standardHeaders: true, // Return rate limit info in standard headers
  legacyHeaders: false, // Disable legacy headers
  message: {
    success: false,
    error: "Too many requests from this IP, please try again after 15 minutes"
  }
});

// Stricter rate limiter for heavy/expensive LLM/AI operations
export const aiEndpointsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 15, // Limit each IP to 15 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many AI generation requests, please wait a minute before trying again"
  }
});

// Strict rate limiter for file uploads (since upload processing does heavy parsing/OCR/indexing)
export const fileUploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes window
  max: 5, // Limit each IP to 5 uploads per 10 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many file uploads, please try again after 10 minutes"
  }
});
