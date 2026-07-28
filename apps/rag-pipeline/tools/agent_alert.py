"""
Agent Alert Tool Module
======================
Date: 2026-07-28
Description: Handles failure threshold monitoring and email alert dispatching for background agents.
"""

import logging
import os
import sys

# Ensure config module is importable
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import settings

logger = logging.getLogger("agent_alert")


def dispatch_agent_alert(alert_type: str, details: str) -> bool:
    """Dispatch an alert message via email/logging for an agent failure mode."""
    subject = f"🚨 [AGENT ALERT] {alert_type.upper()} - {settings.APP_NAME}"
    body = (
        f"Agent Failure Mode Detected!\n"
        f"Alert Type: {alert_type}\n"
        f"Environment: {settings.ENVIRONMENT}\n"
        f"Details: {details}\n"
    )

    logger.error(f"AGENT ALERT DISPATCHED | Type: {alert_type} | Details: {details}")

    # Import send_email_alert_sync from main if available
    try:
        from main import send_email_alert_sync
        return send_email_alert_sync(subject=subject, body=body)
    except Exception as exc:
        logger.warning(f"Could not dispatch alert via SMTP ({exc}). Alert logged locally.")
        return False
