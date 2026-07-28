"""
Inqora RAG Pipeline - Configuration Settings
============================================
All configuration loaded from environment variables with sensible defaults.
Date: 2026-07-28
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root (/apps/rag-pipeline)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")

# =============================================================
# Project & Environment
# =============================================================
APP_NAME = os.getenv("APP_NAME", "Inqora RAG Pipeline")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
DEBUG = os.getenv("DEBUG", "true").lower() == "true"
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

# =============================================================
# LLM & AI Provider API Keys
# =============================================================
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# =============================================================
# RAG Proxy API Authentication & Rate Limiting
# =============================================================
ALLOWED_API_KEYS = [
    key.strip()
    for key in os.getenv("ALLOWED_API_KEYS", "inqora_dev_key,secret_api_key_123").split(",")
    if key.strip()
]
RATE_LIMIT_RPM = int(os.getenv("RATE_LIMIT_RPM", "60"))
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))

# =============================================================
# AI Economics & Budget Thresholds
# =============================================================
DEFAULT_CLIENT_BUDGET_USD = float(os.getenv("DEFAULT_CLIENT_BUDGET_USD", "10.00"))
BUDGET_WARNING_THRESHOLD_PCT = float(os.getenv("BUDGET_WARNING_THRESHOLD_PCT", "80.0"))

# Model Pricing (Cost per 1,000,000 Tokens in USD)
MODEL_PRICING = {
    "gemini-2.5-flash": {"input_per_1m": 0.075, "output_per_1m": 0.30},
    "gpt-4o": {"input_per_1m": 2.50, "output_per_1m": 10.00},
    "claude-3.5-sonnet": {"input_per_1m": 3.00, "output_per_1m": 15.00},
    "text-embedding-004": {"input_per_1m": 0.02, "output_per_1m": 0.00},
}

# =============================================================
# Gmail / SMTP Email Alerting & Credentials
# =============================================================
GMAIL_SENDER_EMAIL = os.getenv("GMAIL_SENDER_EMAIL", "anishs1207@gmail.com")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")
ALERT_RECIPIENT_EMAIL = os.getenv("ALERT_RECIPIENT_EMAIL", GMAIL_SENDER_EMAIL)
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))

GMAIL_CREDENTIALS_FILE = os.getenv(
    "GMAIL_CREDENTIALS_FILE",
    str(PROJECT_ROOT / "credentials" / "credentials.json"),
)
GMAIL_TOKEN_FILE = os.getenv(
    "GMAIL_TOKEN_FILE",
    str(PROJECT_ROOT / "credentials" / "token.json"),
)

# =============================================================
# Databases & Caching (PostgreSQL & Redis)
# =============================================================
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://user:password@localhost:5432/agentic_db?schema=public",
)
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))

# =============================================================
# Logging Configuration
# =============================================================
LOG_DIR = os.getenv("LOG_DIR", str(PROJECT_ROOT / "logs"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
