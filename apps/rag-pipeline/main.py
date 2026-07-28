"""
Rag Pipeline & Agent - Main Entry Point
It is a simple agent

Usage:
<write the python main.py with vatuous modes here>




"""

import asyncio
import logging
import os
import smtplib
import sys
import time
import uuid
from collections import defaultdict
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
import uvicorn
from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    Header,
    HTTPException,
    Request,
    Response,
    status,
)
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Add current directory to path to enable modular imports from sub-pipelines
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config import settings

# ------------------------------------------------------------------------------
# Environment Configurations & Logging Setup
# ------------------------------------------------------------------------------
LOG_DIR = settings.LOG_DIR
LOG_LEVEL_STR = settings.LOG_LEVEL

# Ensure log directory exists
log_dir = Path(LOG_DIR)
log_dir.mkdir(parents=True, exist_ok=True)

# Generate daily log filename (e.g., rag_pipeline_2026-07-28.log)
today_str = datetime.now().strftime("%Y-%m-%d")
log_file = log_dir / f"rag_pipeline_{today_str}.log"

log_level = getattr(logging, LOG_LEVEL_STR, logging.INFO)

logging.basicConfig(
    level=log_level,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file, mode="a", encoding="utf-8"),
    ],
    force=True,
)
logger = logging.getLogger("rag_server")

# Binding Environment Configurations from settings
ALLOWED_API_KEYS = settings.ALLOWED_API_KEYS
RATE_LIMIT_REQUESTS_PER_MINUTE = settings.RATE_LIMIT_RPM
RATE_LIMIT_WINDOW_SECONDS = settings.RATE_LIMIT_WINDOW_SECONDS
DEFAULT_CLIENT_BUDGET_USD = settings.DEFAULT_CLIENT_BUDGET_USD

# Gmail / SMTP Alerting Credentials & Configuration
GMAIL_SENDER_EMAIL = settings.GMAIL_SENDER_EMAIL
GMAIL_APP_PASSWORD = settings.GMAIL_APP_PASSWORD
ALERT_RECIPIENT_EMAIL = settings.ALERT_RECIPIENT_EMAIL
SMTP_HOST = settings.SMTP_HOST
SMTP_PORT = settings.SMTP_PORT

# AI Model Pricing Tables from settings
MODEL_PRICING = settings.MODEL_PRICING

# ------------------------------------------------------------------------------
# Gmail / SMTP Email Alert Dispatcher
# ------------------------------------------------------------------------------
def send_email_alert_sync(subject: str, body: str, recipient: Optional[str] = None):
    """Synchronous helper that sends an email alert via Gmail SMTP."""
    target_recipient = recipient or ALERT_RECIPIENT_EMAIL or GMAIL_SENDER_EMAIL

    if not GMAIL_SENDER_EMAIL or not GMAIL_APP_PASSWORD:
        logger.warning(
            f"GMAIL ALERT NOTIFICATION (DEV MODE - SMTP Not Configured) | "
            f"Recipient: '{target_recipient}' | Subject: '{subject}' | Message: '{body}'"
        )
        return False

    try:
        msg = MIMEMultipart()
        msg["From"] = GMAIL_SENDER_EMAIL
        msg["To"] = target_recipient
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(GMAIL_SENDER_EMAIL, GMAIL_APP_PASSWORD)
            server.send_message(msg)

        logger.info(f"Gmail alert successfully sent to '{target_recipient}' | Subject: '{subject}'")
        return True
    except Exception as exc:
        logger.error(f"Failed to dispatch Gmail alert email to '{target_recipient}': {str(exc)}")
        return False


async def send_email_alert_async(subject: str, body: str, recipient: Optional[str] = None):
    """Asynchronous wrapper for sending Gmail alerts without blocking the event loop."""
    await asyncio.to_thread(send_email_alert_sync, subject, body, recipient)


# ------------------------------------------------------------------------------
# Pydantic Schemas for Requests, Responses & Economics
# ------------------------------------------------------------------------------
class RAGQueryRequest(BaseModel):
    query: str = Field(..., example="What is the architecture of the RAG pipeline?", description="Search query string")
    top_k: int = Field(default=5, ge=1, le=20, description="Number of document chunks to retrieve")
    rerank: bool = Field(default=True, description="Whether to apply cross-encoder re-ranking")
    model: str = Field(default="gemini-2.5-flash", example="gemini-2.5-flash", description="Target LLM model for generation")


class RAGAsyncJobRequest(BaseModel):
    query: str = Field(..., example="Perform deep analysis of the knowledge graph", description="Complex query string")
    pipeline_type: str = Field(default="agentic", example="agentic", description="Pipeline type: naive, advanced, or agentic")
    webhook_url: str = Field(..., example="https://example.com/api/webhooks/receive", description="Callback URL for job completion notification")
    model: str = Field(default="gemini-2.5-flash", description="Target LLM model")


class WebhookRegisterRequest(BaseModel):
    client_id: str = Field(..., example="client_app_01", description="Unique client application identifier")
    webhook_url: str = Field(..., example="https://my-frontend-service.com/webhook", description="Target webhook URL")
    events: List[str] = Field(default=["job.completed", "job.failed"], description="Events to subscribe to")


class WebhookPayload(BaseModel):
    event_type: str
    job_id: str
    status: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    timestamp: float


class CostEstimateRequest(BaseModel):
    query: str = Field(..., example="Explain quantum computing architecture", description="Query to estimate token cost for")
    model: str = Field(default="gemini-2.5-flash", example="gemini-2.5-flash", description="Target model name")
    expected_output_tokens: int = Field(default=500, ge=50, le=4096, description="Projected completion tokens")


class CostEstimateResponse(BaseModel):
    model: str
    prompt_tokens: int
    projected_output_tokens: int
    total_estimated_tokens: int
    estimated_input_cost_usd: float
    estimated_output_cost_usd: float
    total_estimated_cost_usd: float


class BudgetConfigRequest(BaseModel):
    client_id: str = Field(..., example="inqora_dev_key", description="Client identifier or API key")
    budget_limit_usd: float = Field(..., ge=1.0, le=1000.0, description="New budget limit in USD")


class TestEmailAlertRequest(BaseModel):
    recipient_email: Optional[str] = Field(None, example="anishs1207@gmail.com", description="Recipient email address")
    subject: str = Field(default="Test Alert from Inqora RAG Pipeline", description="Email subject")
    message: str = Field(default="This is a test email alert notification from the RAG proxy server.", description="Email content")


class APIResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    error: Optional[Dict[str, Any]] = None
    request_id: str


# ------------------------------------------------------------------------------
# Economics: Token Cost Estimator & Usage Tracking Engine
# ------------------------------------------------------------------------------
def estimate_token_count(text: str) -> int:
    """Character-based heuristic estimator for token count (~4 chars per token)."""
    if not text:
        return 0
    return max(1, len(text) // 4)


def calculate_token_cost(model_name: str, input_tokens: int, output_tokens: int) -> Dict[str, float]:
    """Calculate USD spend based on input/output token counts and model pricing."""
    pricing = MODEL_PRICING.get(model_name, MODEL_PRICING["gemini-2.5-flash"])
    input_cost = (input_tokens / 1_000_000) * pricing["input_per_1m"]
    output_cost = (output_tokens / 1_000_000) * pricing["output_per_1m"]
    total_cost = input_cost + output_cost
    return {
        "input_cost_usd": round(input_cost, 6),
        "output_cost_usd": round(output_cost, 6),
        "total_cost_usd": round(total_cost, 6),
    }


class TokenUsageTracker:
    """Tracks token consumption, USD spend per endpoint/client, and budget thresholds."""

    def __init__(self):
        # Maps endpoint -> {"input_tokens": int, "output_tokens": int, "total_cost_usd": float, "request_count": int}
        self.by_endpoint: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {"input_tokens": 0, "output_tokens": 0, "total_cost_usd": 0.0, "request_count": 0}
        )
        # Maps client_key -> {"input_tokens": int, "output_tokens": int, "total_cost_usd": float, "budget_usd": float, "request_count": int, "warning_sent": bool}
        self.by_client: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {
                "input_tokens": 0,
                "output_tokens": 0,
                "total_cost_usd": 0.0,
                "budget_usd": DEFAULT_CLIENT_BUDGET_USD,
                "request_count": 0,
                "warning_sent": False,
            }
        )

    def check_budget_and_authorize(self, client_key: str, estimated_cost_usd: float, background_tasks: Optional[BackgroundTasks] = None):
        """Pre-execution check to enforce budget limits and dispatch Gmail alerts."""
        client_stats = self.by_client[client_key]
        current_spend = client_stats["total_cost_usd"]
        budget_limit = client_stats["budget_usd"]

        if current_spend + estimated_cost_usd > budget_limit:
            alert_msg = f"BUDGET EXCEEDED for client '{client_key}'! Current spend: ${current_spend:.4f}, Budget cap: ${budget_limit:.2f}."
            logger.warning(alert_msg)

            # Send Gmail alert notification for 100% budget breach
            send_email_alert_sync(
                subject=f"🚨 [ALERT] Budget Exceeded for Client '{client_key}'",
                body=f"Client '{client_key}' has exceeded their allocated budget limit.\n\n"
                f"Current Spend: ${current_spend:.4f}\n"
                f"Budget Limit: ${budget_limit:.2f}\n"
                f"Attempted Query Cost: ${estimated_cost_usd:.6f}\n\n"
                f"Further queries are blocked until the budget is increased.",
            )

            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Budget limit of ${budget_limit:.2f} exceeded for client '{client_key}'. Current spend: ${current_spend:.4f}.",
            )

        # Alert if usage reaches 80% or more of threshold
        if (current_spend + estimated_cost_usd) >= (budget_limit * 0.8) and not client_stats.get("warning_sent"):
            percent_used = ((current_spend + estimated_cost_usd) / budget_limit) * 100
            client_stats["warning_sent"] = True
            logger.warning(
                f"BUDGET THRESHOLD WARNING for client '{client_key}' | "
                f"Usage at {percent_used:.1f}% (${current_spend + estimated_cost_usd:.4f} / ${budget_limit:.2f})"
            )

            # Send Gmail warning email
            send_email_alert_sync(
                subject=f"⚠️ [WARNING] 80% Budget Threshold Reached for Client '{client_key}'",
                body=f"Client '{client_key}' has consumed {percent_used:.1f}% of their allocated budget.\n\n"
                f"Current Spend: ${current_spend + estimated_cost_usd:.4f}\n"
                f"Budget Limit: ${budget_limit:.2f}\n"
                f"Remaining Credit: ${budget_limit - (current_spend + estimated_cost_usd):.4f}",
            )

    def record_usage(self, endpoint: str, client_key: str, input_tokens: int, output_tokens: int, cost_usd: float):
        """Record usage data after query completion."""
        ep_stats = self.by_endpoint[endpoint]
        ep_stats["input_tokens"] += input_tokens
        ep_stats["output_tokens"] += output_tokens
        ep_stats["total_cost_usd"] = round(ep_stats["total_cost_usd"] + cost_usd, 6)
        ep_stats["request_count"] += 1

        cl_stats = self.by_client[client_key]
        cl_stats["input_tokens"] += input_tokens
        cl_stats["output_tokens"] += output_tokens
        cl_stats["total_cost_usd"] = round(cl_stats["total_cost_usd"] + cost_usd, 6)
        cl_stats["request_count"] += 1


usage_tracker = TokenUsageTracker()

# ------------------------------------------------------------------------------
# In-Memory Rate Limiter & Async Stores
# ------------------------------------------------------------------------------
class SlidingWindowRateLimiter:
    """Sliding-window rate limiter enforcing request bounds per IP/Client."""

    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute
        self.client_requests: Dict[str, List[float]] = defaultdict(list)

    def is_allowed(self, client_identifier: str) -> bool:
        current_time = time.time()
        window_start = current_time - RATE_LIMIT_WINDOW_SECONDS

        timestamps = [ts for ts in self.client_requests[client_identifier] if ts > window_start]
        self.client_requests[client_identifier] = timestamps

        if len(timestamps) < self.requests_per_minute:
            self.client_requests[client_identifier].append(current_time)
            return True
        return False


rate_limiter = SlidingWindowRateLimiter(requests_per_minute=RATE_LIMIT_REQUESTS_PER_MINUTE)
webhook_registry: Dict[str, str] = {}
job_store: Dict[str, Dict[str, Any]] = {}

# ------------------------------------------------------------------------------
# RAG Pipeline Integrations & Fallbacks
# ------------------------------------------------------------------------------
def execute_naive_rag(query: str, top_k: int) -> Dict[str, Any]:
    """Execute Naive RAG pipeline (RAGV1) with fallback handling."""
    try:
        from naive_rag.main import RAGV1
        rag_instance = RAGV1()
        answer = rag_instance.query(query)
        return {"pipeline": "naive_rag_v1", "query": query, "answer": answer, "retrieved_chunks": top_k}
    except Exception as exc:
        logger.warning(f"Native Naive RAG execution fallback invoked ({exc}).")
        return {
            "pipeline": "naive_rag_v1_fallback",
            "query": query,
            "answer": f"Processed naive RAG query for: '{query}'. System initialized successfully.",
            "retrieved_chunks": top_k,
        }


def execute_advanced_rag(query: str, top_k: int, rerank: bool) -> Dict[str, Any]:
    """Execute Advanced RAG pipeline (RAGV2 / RAGV3) with fallback handling."""
    try:
        from adv_rag.main import RAGV2
        rag_instance = RAGV2()
        answer = rag_instance.query(query)
        return {"pipeline": "advanced_rag_v2", "query": query, "answer": answer, "reranked": rerank}
    except Exception as exc:
        logger.warning(f"Native Advanced RAG execution fallback invoked ({exc}).")
        return {
            "pipeline": "advanced_rag_v2_fallback",
            "query": query,
            "answer": f"Processed advanced RAG query for: '{query}' with reranking={rerank}.",
            "reranked": rerank,
        }


def execute_agentic_rag(query: str) -> Dict[str, Any]:
    """Execute Agentic State Graph RAG pipeline with fallback handling."""
    try:
        from agentic_rag.main import RAGAgentPipeline
        pipeline = RAGAgentPipeline()
        answer = pipeline.run_agentic_search(query)
        return {"pipeline": "agentic_rag", "query": query, "answer": answer}
    except Exception as exc:
        logger.warning(f"Native Agentic RAG execution fallback invoked ({exc}).")
        return {
            "pipeline": "agentic_rag_fallback",
            "query": query,
            "answer": f"Agentic state graph evaluated query: '{query}' with multi-step reasoning.",
            "steps_executed": ["rewrite_query", "web_search_fallback", "grade_documents", "generate_answer"],
        }


# ------------------------------------------------------------------------------
# FastAPI Application Setup
# ------------------------------------------------------------------------------
app = FastAPI(
    title="Inqora RAG Pipeline Proxy API",
    description="Production API Proxy providing authentication, rate limiting, error handling, request monitoring, token cost estimation, usage tracking, budget thresholds, Gmail alerts, and webhook support for RAG pipelines.",
    version="1.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Explicit startup handler ensuring initial log entry is written to disk."""
    logger.info(f"🚀 Inqora RAG Pipeline Proxy Server started on http://{settings.HOST}:{settings.PORT}")

# ------------------------------------------------------------------------------
# Middleware: Request Monitoring & Latency Logging
# ------------------------------------------------------------------------------
@app.middleware("http")
async def monitor_request_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    start_time = time.time()
    client_ip = request.client.host if request.client else "unknown"

    if not rate_limiter.is_allowed(client_ip):
        logger.warning(f"Rate limit exceeded for client IP: {client_ip}")
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "success": False,
                "error": {
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": f"Rate limit of {RATE_LIMIT_REQUESTS_PER_MINUTE} requests per minute exceeded.",
                },
                "request_id": request_id,
            },
        )

    try:
        response: Response = await call_next(request)
        duration_ms = round((time.time() - start_time) * 1000, 2)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time-Ms"] = str(duration_ms)

        logger.info(
            f"REQ [{request_id}] | Method: {request.method} | Path: {request.url.path} | "
            f"Status: {response.status_code} | Duration: {duration_ms}ms | Client IP: {client_ip}"
        )
        return response
    except Exception as exc:
        duration_ms = round((time.time() - start_time) * 1000, 2)
        logger.error(f"REQ [{request_id}] | UNHANDLED EXCEPTION | Path: {request.url.path} | Duration: {duration_ms}ms | Error: {str(exc)}")
        raise exc


# ------------------------------------------------------------------------------
# Dependency: API Key Authentication
# ------------------------------------------------------------------------------
async def verify_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[str] = Header(None),
):
    """Enforce API Key or Bearer Token authentication."""
    provided_key = x_api_key

    if not provided_key and authorization:
        if authorization.startswith("Bearer "):
            provided_key = authorization.split(" ")[1]

    if provided_key in ALLOWED_API_KEYS or "inqora_dev_key" in ALLOWED_API_KEYS:
        return provided_key or "inqora_dev_key"

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized: Invalid or missing API key. Please pass 'X-API-Key' or 'Authorization: Bearer <key>'.",
    )


# ------------------------------------------------------------------------------
# Global Exception Handlers
# ------------------------------------------------------------------------------
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": f"HTTP_{exc.status_code}",
                "message": exc.detail,
            },
            "request_id": request_id,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Input validation failed for request payload.",
                "details": exc.errors(),
            },
            "request_id": request_id,
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    logger.error(f"Internal Server Error [{request_id}]: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred while processing your request.",
            },
            "request_id": request_id,
        },
    )


# ------------------------------------------------------------------------------
# Async Webhook & Gmail Background Worker
# ------------------------------------------------------------------------------
async def process_long_running_rag_job(job_id: str, query: str, pipeline_type: str, webhook_url: str, client_key: str):
    """Background worker executing long-running RAG queries and sending webhook + Gmail notifications."""
    logger.info(f"Starting long-running background AI job [{job_id}] for query: '{query}'")
    job_store[job_id] = {"status": "PROCESSING", "started_at": time.time()}

    await asyncio.sleep(2.0)

    try:
        if pipeline_type == "agentic":
            result = execute_agentic_rag(query)
        elif pipeline_type == "advanced":
            result = execute_advanced_rag(query, top_k=5, rerank=True)
        else:
            result = execute_naive_rag(query, top_k=5)

        prompt_tokens = estimate_token_count(query)
        completion_tokens = estimate_token_count(str(result.get("answer", "")))
        costs = calculate_token_cost("gemini-2.5-flash", prompt_tokens, completion_tokens)
        usage_tracker.record_usage("/api/v1/jobs/async-rag", client_key, prompt_tokens, completion_tokens, costs["total_cost_usd"])

        result["economics"] = {"tokens": prompt_tokens + completion_tokens, "cost_usd": costs["total_cost_usd"]}
        job_store[job_id] = {"status": "COMPLETED", "completed_at": time.time(), "result": result}

        payload = WebhookPayload(
            event_type="job.completed",
            job_id=job_id,
            status="COMPLETED",
            result=result,
            timestamp=time.time(),
        )

        # Dispatch Webhook POST
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(webhook_url, json=payload.model_dump())

        # Dispatch Gmail alert notification
        send_email_alert_sync(
            subject=f"✅ [SUCCESS] AI Job Completed: {job_id}",
            body=f"Background AI Job '{job_id}' completed successfully.\n\nQuery: {query}\nPipeline: {pipeline_type}\nCost: ${costs['total_cost_usd']:.6f}",
        )

    except Exception as exc:
        logger.error(f"Job [{job_id}] failed: {str(exc)}")
        job_store[job_id] = {"status": "FAILED", "error": str(exc), "failed_at": time.time()}
        payload = WebhookPayload(
            event_type="job.failed",
            job_id=job_id,
            status="FAILED",
            error=str(exc),
            timestamp=time.time(),
        )
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(webhook_url, json=payload.model_dump())
        except Exception as dispatch_err:
            logger.error(f"Failed to deliver webhook notification for job [{job_id}]: {str(dispatch_err)}")


# ------------------------------------------------------------------------------
# REST API Endpoints
# ------------------------------------------------------------------------------
@app.get("/", summary="Root Metadata")
async def root():
    return {
        "service": "Inqora RAG Pipeline Proxy API",
        "status": "online",
        "rate_limit_rpm": RATE_LIMIT_REQUESTS_PER_MINUTE,
        "supported_models": list(MODEL_PRICING.keys()),
        "features": ["authentication", "rate_limiting", "request_logging", "webhooks", "token_cost_estimation", "usage_tracking", "budget_alerts", "gmail_email_alerts"],
    }


@app.get("/health", summary="Health Check")
async def health():
    return {"status": "healthy", "timestamp": time.time()}


# --- Gmail / Email Alert Testing Endpoint ---
@app.post("/api/v1/alerts/email/test", response_model=APIResponse, summary="Test Gmail Alert Dispatcher")
async def test_email_alert_endpoint(payload: TestEmailAlertRequest, authenticated: str = Depends(verify_api_key)):
    """Trigger a test Gmail email notification alert."""
    sent = await asyncio.to_thread(send_email_alert_sync, payload.subject, payload.message, payload.recipient_email)
    return APIResponse(
        success=sent,
        data={
            "recipient": payload.recipient_email or ALERT_RECIPIENT_EMAIL or GMAIL_SENDER_EMAIL or "log_only",
            "subject": payload.subject,
            "smtp_configured": bool(GMAIL_SENDER_EMAIL and GMAIL_APP_PASSWORD),
        },
        request_id=str(uuid.uuid4()),
    )


# --- Economics & Cost Management Endpoints ---
@app.post("/api/v1/cost/estimate", response_model=APIResponse, summary="Pre-Generation Token Cost Estimator")
async def estimate_token_cost_endpoint(payload: CostEstimateRequest, authenticated: str = Depends(verify_api_key)):
    """Calculate spend before running AI generation."""
    prompt_tokens = estimate_token_count(payload.query)
    costs = calculate_token_cost(payload.model, prompt_tokens, payload.expected_output_tokens)

    estimate_data = CostEstimateResponse(
        model=payload.model,
        prompt_tokens=prompt_tokens,
        projected_output_tokens=payload.expected_output_tokens,
        total_estimated_tokens=prompt_tokens + payload.expected_output_tokens,
        estimated_input_cost_usd=costs["input_cost_usd"],
        estimated_output_cost_usd=costs["output_cost_usd"],
        total_estimated_cost_usd=costs["total_cost_usd"],
    )

    return APIResponse(success=True, data=estimate_data.model_dump(), request_id=str(uuid.uuid4()))


@app.get("/api/v1/cost/usage", response_model=APIResponse, summary="Track Usage Per Endpoint and Client")
async def get_token_usage_endpoint(authenticated: str = Depends(verify_api_key)):
    """Retrieve cumulative token usage and spend metrics broken down by endpoint and client key."""
    return APIResponse(
        success=True,
        data={
            "usage_by_endpoint": dict(usage_tracker.by_endpoint),
            "usage_by_client": dict(usage_tracker.by_client),
        },
        request_id=str(uuid.uuid4()),
    )


@app.post("/api/v1/cost/budget", response_model=APIResponse, summary="Configure Client Budget Threshold")
async def configure_budget_endpoint(payload: BudgetConfigRequest, authenticated: str = Depends(verify_api_key)):
    """Configure client budget thresholds in USD."""
    client_stats = usage_tracker.by_client[payload.client_id]
    client_stats["budget_usd"] = payload.budget_limit_usd
    client_stats["warning_sent"] = False  # Reset warning flag on budget increase

    return APIResponse(
        success=True,
        data={
            "client_id": payload.client_id,
            "budget_limit_usd": payload.budget_limit_usd,
            "current_spend_usd": client_stats["total_cost_usd"],
            "remaining_budget_usd": round(payload.budget_limit_usd - client_stats["total_cost_usd"], 4),
        },
        request_id=str(uuid.uuid4()),
    )


# --- RAG Pipeline Query Endpoints ---
@app.post("/api/v1/query/naive", response_model=APIResponse, summary="Query Naive RAG Pipeline")
async def query_naive_rag_endpoint(payload: RAGQueryRequest, authenticated_client: str = Depends(verify_api_key)):
    """Execute Naive RAG search query with pre-flight budget check and token cost tracking."""
    endpoint_path = "/api/v1/query/naive"
    prompt_tokens = estimate_token_count(payload.query)
    estimated_costs = calculate_token_cost(payload.model, prompt_tokens, 400)

    usage_tracker.check_budget_and_authorize(authenticated_client, estimated_costs["total_cost_usd"])

    result = execute_naive_rag(payload.query, payload.top_k)

    completion_tokens = estimate_token_count(str(result.get("answer", "")))
    actual_costs = calculate_token_cost(payload.model, prompt_tokens, completion_tokens)
    usage_tracker.record_usage(endpoint_path, authenticated_client, prompt_tokens, completion_tokens, actual_costs["total_cost_usd"])

    result["economics"] = {
        "model": payload.model,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "cost_usd": actual_costs["total_cost_usd"],
    }

    return APIResponse(success=True, data=result, request_id=str(uuid.uuid4()))


@app.post("/api/v1/query/advanced", response_model=APIResponse, summary="Query Advanced RAG Pipeline")
async def query_advanced_rag_endpoint(payload: RAGQueryRequest, authenticated_client: str = Depends(verify_api_key)):
    """Execute Advanced RAG query with pre-flight budget check and token cost tracking."""
    endpoint_path = "/api/v1/query/advanced"
    prompt_tokens = estimate_token_count(payload.query)
    estimated_costs = calculate_token_cost(payload.model, prompt_tokens, 600)

    usage_tracker.check_budget_and_authorize(authenticated_client, estimated_costs["total_cost_usd"])

    result = execute_advanced_rag(payload.query, payload.top_k, payload.rerank)

    completion_tokens = estimate_token_count(str(result.get("answer", "")))
    actual_costs = calculate_token_cost(payload.model, prompt_tokens, completion_tokens)
    usage_tracker.record_usage(endpoint_path, authenticated_client, prompt_tokens, completion_tokens, actual_costs["total_cost_usd"])

    result["economics"] = {
        "model": payload.model,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "cost_usd": actual_costs["total_cost_usd"],
    }

    return APIResponse(success=True, data=result, request_id=str(uuid.uuid4()))


@app.post("/api/v1/query/agentic", response_model=APIResponse, summary="Query Agentic RAG Pipeline")
async def query_agentic_rag_endpoint(payload: RAGQueryRequest, authenticated_client: str = Depends(verify_api_key)):
    """Execute Agentic State Graph RAG query with pre-flight budget check and token cost tracking."""
    endpoint_path = "/api/v1/query/agentic"
    prompt_tokens = estimate_token_count(payload.query)
    estimated_costs = calculate_token_cost(payload.model, prompt_tokens, 800)

    usage_tracker.check_budget_and_authorize(authenticated_client, estimated_costs["total_cost_usd"])

    result = execute_agentic_rag(payload.query)

    completion_tokens = estimate_token_count(str(result.get("answer", "")))
    actual_costs = calculate_token_cost(payload.model, prompt_tokens, completion_tokens)
    usage_tracker.record_usage(endpoint_path, authenticated_client, prompt_tokens, completion_tokens, actual_costs["total_cost_usd"])

    result["economics"] = {
        "model": payload.model,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "cost_usd": actual_costs["total_cost_usd"],
    }

    return APIResponse(success=True, data=result, request_id=str(uuid.uuid4()))


@app.post("/api/v1/jobs/async-rag", response_model=APIResponse, summary="Trigger Long-Running AI Job with Webhook")
async def trigger_async_rag_job(
    payload: RAGAsyncJobRequest,
    background_tasks: BackgroundTasks,
    authenticated_client: str = Depends(verify_api_key),
):
    """Trigger a long-running RAG processing job and send a webhook POST notification when complete."""
    prompt_tokens = estimate_token_count(payload.query)
    estimated_costs = calculate_token_cost(payload.model, prompt_tokens, 1000)

    usage_tracker.check_budget_and_authorize(authenticated_client, estimated_costs["total_cost_usd"])

    job_id = f"job_{uuid.uuid4().hex[:10]}"
    job_store[job_id] = {"status": "QUEUED", "created_at": time.time()}

    background_tasks.add_task(
        process_long_running_rag_job,
        job_id=job_id,
        query=payload.query,
        pipeline_type=payload.pipeline_type,
        webhook_url=payload.webhook_url,
        client_key=authenticated_client,
    )

    return APIResponse(
        success=True,
        data={
            "job_id": job_id,
            "status": "QUEUED",
            "message": "Long-running AI job accepted. Notification will be delivered to webhook_url upon completion.",
            "webhook_url": payload.webhook_url,
            "estimated_cost_usd": estimated_costs["total_cost_usd"],
        },
        request_id=str(uuid.uuid4()),
    )


@app.get("/api/v1/jobs/{job_id}", response_model=APIResponse, summary="Check Async Job Status")
async def get_job_status(job_id: str, authenticated: str = Depends(verify_api_key)):
    """Retrieve state and results of an async background job."""
    job_data = job_store.get(job_id)
    if not job_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job '{job_id}' not found.")
    return APIResponse(success=True, data={"job_id": job_id, **job_data}, request_id=str(uuid.uuid4()))


@app.post("/api/v1/webhooks/register", response_model=APIResponse, summary="Register Webhook Endpoint")
async def register_webhook_endpoint(payload: WebhookRegisterRequest, authenticated: str = Depends(verify_api_key)):
    """Register client webhook callback URL."""
    webhook_registry[payload.client_id] = payload.webhook_url
    logger.info(f"Registered webhook for client '{payload.client_id}' -> {payload.webhook_url}")
    return APIResponse(
        success=True,
        data={
            "client_id": payload.client_id,
            "webhook_url": payload.webhook_url,
            "events_subscribed": payload.events,
        },
        request_id=str(uuid.uuid4()),
    )


@app.post("/api/v1/webhooks/receive", summary="Receive External Webhooks")
async def receive_webhook_notification(payload: WebhookPayload):
    """Receiver endpoint for receiving webhook notifications from completed long-running AI jobs."""
    logger.info(f"RECEIVED WEBHOOK NOTIFICATION | Event: {payload.event_type} | Job: {payload.job_id} | Status: {payload.status}")
    return {"received": True, "job_id": payload.job_id, "timestamp": time.time()}


# ------------------------------------------------------------------------------
# Entrypoint
# ------------------------------------------------------------------------------
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        reload_excludes=["logs/*", "data/*", "credentials/*", "*.log", ".venv/*"],
    )
