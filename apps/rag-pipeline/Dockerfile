# ==============================================================================
# Dockerfile for Inqora RAG Pipeline Microservice
# Date: 2026-07-28
# Description: Production container setup for FastAPI RAG Proxy server and Agent host.
# ==============================================================================

FROM python:3.11-slim AS base

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . ./

# Ensure logs, data, and tools directories exist
RUN mkdir -p logs data credentials tools

# Expose port
EXPOSE 8000

# Default entrypoint starting FastAPI server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
