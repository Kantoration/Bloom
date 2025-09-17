"""Health check endpoints"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict

from app.core.database import get_db
from app.core.config import settings

router = APIRouter()


@router.get("/", status_code=status.HTTP_200_OK)
async def health_check() -> Dict[str, str]:
    """Basic health check"""
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION
    }


@router.get("/ready", status_code=status.HTTP_200_OK)
async def readiness_check(db: Session = Depends(get_db)) -> Dict[str, str]:
    """Readiness check including database connectivity"""
    try:
        # Check database connection
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    return {
        "status": "ready" if db_status == "connected" else "not_ready",
        "database": db_status,
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION
    }


@router.get("/live", status_code=status.HTTP_200_OK)
async def liveness_check() -> Dict[str, str]:
    """Liveness check for container orchestration"""
    return {
        "status": "alive",
        "service": settings.APP_NAME
    }

