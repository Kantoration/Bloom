"""Email service for sending verification emails"""

import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from jinja2 import Template
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.database import EmailVerification, Participant

logger = logging.getLogger(__name__)


class EmailService:
    """Service for handling email operations"""
    
    def __init__(self):
        """Initialize email service with configuration"""
        self.conf = ConnectionConfig(
            MAIL_USERNAME=settings.MAIL_USERNAME,
            MAIL_PASSWORD=settings.MAIL_PASSWORD,
            MAIL_FROM=settings.MAIL_FROM,
            MAIL_PORT=settings.MAIL_PORT,
            MAIL_SERVER=settings.MAIL_SERVER,
            MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
            MAIL_STARTTLS=settings.MAIL_STARTTLS,
            MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
            USE_CREDENTIALS=settings.USE_CREDENTIALS,
            VALIDATE_CERTS=settings.VALIDATE_CERTS,
        )
        self.fastmail = FastMail(self.conf)
    
    async def send_verification_email(
        self, 
        participant: Participant, 
        verification: EmailVerification,
        locale: str = "he"
    ) -> bool:
        """Send email verification email to participant"""
        try:
            # Create verification URL
            verification_url = f"{settings.EMAIL_VERIFICATION_BASE_URL}/verify-email?token={verification.token}"
            
            # Email templates
            templates = {
                "he": {
                    "subject": "אימות כתובת אימייל - מערכת GARF",
                    "body": """
                    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>שלום {{ name }},</h2>
                        <p>תודה שהשתתפת בסקר שלנו. כדי להשלים את התהליך, אנא אמת את כתובת האימייל שלך.</p>
                        <p>לחץ על הקישור הבא לאימות:</p>
                        <p><a href="{{ verification_url }}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">אמת אימייל</a></p>
                        <p>או העתק והדבק את הקישור הבא בדפדפן שלך:</p>
                        <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 5px;">{{ verification_url }}</p>
                        <p>קישור זה יפוג תוך 24 שעות.</p>
                        <p>אם לא ביקשת אימות זה, אנא התעלם מההודעה הזו.</p>
                        <hr>
                        <p style="font-size: 12px; color: #666;">מערכת GARF - יצירת קבוצות חכמות</p>
                    </div>
                    """
                },
                "en": {
                    "subject": "Email Verification - GARF System",
                    "body": """
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>Hello {{ name }},</h2>
                        <p>Thank you for participating in our survey. To complete the process, please verify your email address.</p>
                        <p>Click the link below to verify:</p>
                        <p><a href="{{ verification_url }}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
                        <p>Or copy and paste this link into your browser:</p>
                        <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 5px;">{{ verification_url }}</p>
                        <p>This link will expire in 24 hours.</p>
                        <p>If you did not request this verification, please ignore this message.</p>
                        <hr>
                        <p style="font-size: 12px; color: #666;">GARF System - Smart Group Formation</p>
                    </div>
                    """
                }
            }
            
            # Get template for locale
            template = templates.get(locale, templates["en"])
            
            # Render template
            jinja_template = Template(template["body"])
            html_body = jinja_template.render(
                name=participant.full_name or "Participant",
                verification_url=verification_url
            )
            
            # Create message
            message = MessageSchema(
                subject=template["subject"],
                recipients=[participant.email],
                body=html_body,
                subtype="html"
            )
            
            # Send email
            await self.fastmail.send_message(message)
            logger.info(f"Verification email sent to {participant.email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send verification email to {participant.email}: {e}")
            return False
    
    async def send_verification_success_email(
        self, 
        participant: Participant,
        locale: str = "he"
    ) -> bool:
        """Send confirmation email after successful verification"""
        try:
            templates = {
                "he": {
                    "subject": "אימייל אומת בהצלחה - מערכת GARF",
                    "body": """
                    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>שלום {{ name }},</h2>
                        <p>כתובת האימייל שלך אומתה בהצלחה!</p>
                        <p>תודה שהשתתפת בסקר שלנו. כעת תוכל לקבל עדכונים על הקבוצה שלך.</p>
                        <hr>
                        <p style="font-size: 12px; color: #666;">מערכת GARF - יצירת קבוצות חכמות</p>
                    </div>
                    """
                },
                "en": {
                    "subject": "Email Verified Successfully - GARF System",
                    "body": """
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>Hello {{ name }},</h2>
                        <p>Your email address has been successfully verified!</p>
                        <p>Thank you for participating in our survey. You will now receive updates about your group.</p>
                        <hr>
                        <p style="font-size: 12px; color: #666;">GARF System - Smart Group Formation</p>
                    </div>
                    """
                }
            }
            
            template = templates.get(locale, templates["en"])
            
            jinja_template = Template(template["body"])
            html_body = jinja_template.render(
                name=participant.full_name or "Participant"
            )
            
            message = MessageSchema(
                subject=template["subject"],
                recipients=[participant.email],
                body=html_body,
                subtype="html"
            )
            
            await self.fastmail.send_message(message)
            logger.info(f"Verification success email sent to {participant.email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send verification success email to {participant.email}: {e}")
            return False


def create_email_verification(
    db: Session, 
    participant: Participant, 
    email: str
) -> EmailVerification:
    """Create a new email verification record"""
    # Expire any existing pending verifications for this participant
    existing_verifications = db.query(EmailVerification).filter(
        EmailVerification.participant_id == participant.id,
        EmailVerification.status == "pending"
    ).all()
    
    for verification in existing_verifications:
        verification.status = "expired"
    
    # Create new verification
    expires_at = datetime.utcnow() + timedelta(hours=settings.EMAIL_VERIFICATION_EXPIRE_HOURS)
    
    verification = EmailVerification(
        participant_id=participant.id,
        email=email,
        expires_at=expires_at
    )
    
    db.add(verification)
    db.commit()
    db.refresh(verification)
    
    return verification


def verify_email_token(db: Session, token: str) -> Optional[Participant]:
    """Verify email token and update participant status"""
    verification = db.query(EmailVerification).filter(
        EmailVerification.token == token,
        EmailVerification.status == "pending"
    ).first()
    
    if not verification:
        return None
    
    # Check if token is expired
    if datetime.utcnow() > verification.expires_at:
        verification.status = "expired"
        db.commit()
        return None
    
    # Get participant
    participant = db.query(Participant).filter(
        Participant.id == verification.participant_id
    ).first()
    
    if not participant:
        return None
    
    # Update verification status
    verification.status = "verified"
    verification.verified_at = datetime.utcnow()
    
    # Update participant email verification status
    participant.email_verified = True
    participant.email_verified_at = datetime.utcnow()
    
    db.commit()
    
    return participant


# Global email service instance
email_service = EmailService()
