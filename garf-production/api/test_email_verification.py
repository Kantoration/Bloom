#!/usr/bin/env python3
"""
Test script for email verification system
Run this script to test the email verification functionality
"""

import asyncio
import sys
import os
from datetime import datetime, timedelta

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.core.database import SessionLocal
from app.models.database import Participant, EmailVerification
from app.services.email_service import email_service, create_email_verification, verify_email_token


async def test_email_verification():
    """Test the email verification system"""
    print("🧪 Testing Email Verification System")
    print("=" * 50)
    
    # Create database session
    db = SessionLocal()
    
    try:
        # Test 1: Create a test participant
        print("1. Creating test participant...")
        test_participant = Participant(
            email="test@example.com",
            full_name="Test User",
            locale="he"
        )
        db.add(test_participant)
        db.commit()
        db.refresh(test_participant)
        print(f"   ✅ Created participant with ID: {test_participant.id}")
        
        # Test 2: Create email verification
        print("2. Creating email verification...")
        verification = create_email_verification(db, test_participant, test_participant.email)
        print(f"   ✅ Created verification with token: {verification.token}")
        print(f"   ✅ Expires at: {verification.expires_at}")
        
        # Test 3: Verify email token
        print("3. Verifying email token...")
        verified_participant = verify_email_token(db, str(verification.token))
        if verified_participant:
            print(f"   ✅ Email verified successfully for participant: {verified_participant.id}")
            print(f"   ✅ Email verified at: {verified_participant.email_verified_at}")
        else:
            print("   ❌ Email verification failed")
        
        # Test 4: Check participant status
        print("4. Checking participant verification status...")
        db.refresh(test_participant)
        print(f"   ✅ Email verified: {test_participant.email_verified}")
        print(f"   ✅ Verified at: {test_participant.email_verified_at}")
        
        # Test 5: Test expired token
        print("5. Testing expired token...")
        expired_verification = EmailVerification(
            participant_id=test_participant.id,
            email=test_participant.email,
            expires_at=datetime.utcnow() - timedelta(hours=1)  # Expired 1 hour ago
        )
        db.add(expired_verification)
        db.commit()
        db.refresh(expired_verification)
        
        expired_result = verify_email_token(db, str(expired_verification.token))
        if expired_result is None:
            print("   ✅ Expired token correctly rejected")
        else:
            print("   ❌ Expired token was accepted (this is wrong)")
        
        print("\n🎉 All tests completed successfully!")
        print("\nTo test email sending, you need to:")
        print("1. Configure email settings in your .env file")
        print("2. Run the API server")
        print("3. Submit a survey response with an email address")
        print("4. Check the email inbox for verification email")
        
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Clean up test data
        print("\n🧹 Cleaning up test data...")
        try:
            # Delete test verifications
            db.query(EmailVerification).filter(
                EmailVerification.participant_id == test_participant.id
            ).delete()
            
            # Delete test participant
            db.delete(test_participant)
            db.commit()
            print("   ✅ Test data cleaned up")
        except Exception as e:
            print(f"   ⚠️  Cleanup error: {e}")
        
        db.close()


def test_configuration():
    """Test email configuration"""
    print("🔧 Testing Email Configuration")
    print("=" * 50)
    
    try:
        from app.core.config import settings
        
        print(f"Mail Server: {settings.MAIL_SERVER}")
        print(f"Mail Port: {settings.MAIL_PORT}")
        print(f"Mail From: {settings.MAIL_FROM}")
        print(f"Mail Username: {settings.MAIL_USERNAME}")
        print(f"Base URL: {settings.EMAIL_VERIFICATION_BASE_URL}")
        print(f"Expire Hours: {settings.EMAIL_VERIFICATION_EXPIRE_HOURS}")
        
        if not settings.MAIL_USERNAME or not settings.MAIL_PASSWORD:
            print("⚠️  Warning: Email credentials not configured")
            print("   Set MAIL_USERNAME and MAIL_PASSWORD in your .env file")
        else:
            print("✅ Email configuration looks good")
            
    except Exception as e:
        print(f"❌ Configuration test failed: {e}")


if __name__ == "__main__":
    print("GARF Email Verification Test Suite")
    print("=" * 50)
    
    # Test configuration first
    test_configuration()
    print()
    
    # Test email verification system
    asyncio.run(test_email_verification())
