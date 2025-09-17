"""Email verification endpoints"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime

from app.core.database import get_db
from app.models.database import Participant, EmailVerification
from app.services.email_service import email_service, create_email_verification, verify_email_token

router = APIRouter()


class EmailVerificationRequest(BaseModel):
    """Request to send verification email"""
    email: EmailStr
    participant_id: Optional[int] = None


class EmailVerificationResponse(BaseModel):
    """Response for email verification operations"""
    success: bool
    message: str
    participant_id: Optional[int] = None


class EmailVerificationStatus(BaseModel):
    """Email verification status"""
    email: str
    verified: bool
    verified_at: Optional[datetime] = None


@router.post("/send", response_model=EmailVerificationResponse)
async def send_verification_email(
    request: EmailVerificationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Send verification email to participant"""
    # Find participant by email or ID
    participant = None
    if request.participant_id:
        participant = db.query(Participant).filter(
            Participant.id == request.participant_id
        ).first()
    else:
        participant = db.query(Participant).filter(
            Participant.email == request.email
        ).first()
    
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant not found"
        )
    
    # Check if email is already verified
    if participant.email_verified:
        return EmailVerificationResponse(
            success=True,
            message="Email is already verified",
            participant_id=participant.id
        )
    
    # Create verification record
    verification = create_email_verification(db, participant, request.email)
    
    # Send email in background
    background_tasks.add_task(
        email_service.send_verification_email,
        participant,
        verification,
        participant.locale or "he"
    )
    
    return EmailVerificationResponse(
        success=True,
        message="Verification email sent successfully",
        participant_id=participant.id
    )


@router.get("/verify", response_model=EmailVerificationResponse)
async def verify_email(
    token: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Verify email using token"""
    participant = verify_email_token(db, token)
    
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )
    
    # Send success email in background
    background_tasks.add_task(
        email_service.send_verification_success_email,
        participant,
        participant.locale or "he"
    )
    
    return EmailVerificationResponse(
        success=True,
        message="Email verified successfully",
        participant_id=participant.id
    )


@router.get("/status/{participant_id}", response_model=EmailVerificationStatus)
async def get_verification_status(
    participant_id: int,
    db: Session = Depends(get_db)
):
    """Get email verification status for participant"""
    participant = db.query(Participant).filter(
        Participant.id == participant_id
    ).first()
    
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant not found"
        )
    
    return EmailVerificationStatus(
        email=participant.email,
        verified=participant.email_verified,
        verified_at=participant.email_verified_at
    )


@router.post("/resend/{participant_id}", response_model=EmailVerificationResponse)
async def resend_verification_email(
    participant_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Resend verification email for participant"""
    participant = db.query(Participant).filter(
        Participant.id == participant_id
    ).first()
    
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant not found"
        )
    
    if not participant.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Participant has no email address"
        )
    
    if participant.email_verified:
        return EmailVerificationResponse(
            success=True,
            message="Email is already verified",
            participant_id=participant.id
        )
    
    # Create new verification record
    verification = create_email_verification(db, participant, participant.email)
    
    # Send email in background
    background_tasks.add_task(
        email_service.send_verification_email,
        participant,
        verification,
        participant.locale or "he"
    )
    
    return EmailVerificationResponse(
        success=True,
        message="Verification email resent successfully",
        participant_id=participant.id
    )


@router.get("/participant/{email}", response_model=EmailVerificationStatus)
async def get_verification_status_by_email(
    email: str,
    db: Session = Depends(get_db)
):
    """Get email verification status by email address"""
    participant = db.query(Participant).filter(
        Participant.email == email
    ).first()
    
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant not found"
        )
    
    return EmailVerificationStatus(
        email=participant.email,
        verified=participant.email_verified,
        verified_at=participant.email_verified_at
    )
