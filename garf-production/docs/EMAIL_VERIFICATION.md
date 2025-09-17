# Email Verification System

This document explains how to set up and use the email verification system in the GARF Production API.

## Overview

The email verification system automatically sends verification emails to participants when they submit survey responses with an email address. This ensures that participants can receive important updates about their group assignments.

## Features

- **Automatic Verification**: Emails are sent automatically when participants submit responses
- **Multi-language Support**: Email templates in Hebrew and English
- **Token-based Security**: UUID tokens with expiration (24 hours by default)
- **Background Processing**: Email sending doesn't block response submission
- **Resend Functionality**: Participants can request new verification emails
- **Status Tracking**: Track verification status for each participant

## Setup

### 1. Install Dependencies

The required packages are already added to `requirements.txt`:
- `fastapi-mail==1.4.1`
- `jinja2==3.1.2`

### 2. Configure Email Settings

Add these environment variables to your `.env` file:

```bash
# Email Configuration
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_FROM=noreply@garf.com
MAIL_PORT=587
MAIL_SERVER=smtp.gmail.com
MAIL_FROM_NAME="GARF System"
EMAIL_VERIFICATION_BASE_URL=http://localhost:3000
```

### 3. Gmail Setup (Recommended)

For Gmail, you'll need to:
1. Enable 2-factor authentication
2. Generate an "App Password" for the application
3. Use the app password as `MAIL_PASSWORD`

### 4. Run Database Migration

Execute the migration to add email verification tables:

```bash
psql -d garf_db -f api/migrations/add_email_verification.sql
```

## API Endpoints

### Send Verification Email

```http
POST /api/v1/email-verification/send
Content-Type: application/json

{
  "email": "participant@example.com",
  "participant_id": 123  // optional
}
```

### Verify Email

```http
GET /api/v1/email-verification/verify?token=<verification-token>
```

### Check Verification Status

```http
GET /api/v1/email-verification/status/{participant_id}
```

### Resend Verification Email

```http
POST /api/v1/email-verification/resend/{participant_id}
```

### Get Status by Email

```http
GET /api/v1/email-verification/participant/{email}
```

## Database Schema

### Participants Table (Updated)

```sql
ALTER TABLE participants 
ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN email_verified_at TIMESTAMP WITH TIME ZONE;
```

### Email Verifications Table

```sql
CREATE TABLE email_verifications (
    id BIGSERIAL PRIMARY KEY,
    participant_id BIGINT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    email CITEXT NOT NULL,
    token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

## Integration with Survey Flow

The email verification is automatically integrated into the survey response submission process:

1. **Participant submits response** with email address
2. **System creates participant** if not exists
3. **System checks email verification status**
4. **If not verified**, system:
   - Creates verification record
   - Sends verification email in background
   - Continues with response processing

## Email Templates

The system includes HTML email templates in Hebrew and English:

### Hebrew Template
- RTL (right-to-left) layout
- Professional Hebrew text
- Clear call-to-action button
- Expiration notice

### English Template
- Standard LTR layout
- Professional English text
- Clear call-to-action button
- Expiration notice

## Configuration Options

### Email Verification Settings

```python
# In app/core/config.py
EMAIL_VERIFICATION_EXPIRE_HOURS: int = 24  # Token expiration
EMAIL_VERIFICATION_BASE_URL: str = "http://localhost:3000"  # Frontend URL
```

### Email Server Settings

```python
MAIL_USERNAME: str = "your-email@gmail.com"
MAIL_PASSWORD: str = "your-app-password"
MAIL_FROM: str = "noreply@garf.com"
MAIL_PORT: int = 587
MAIL_SERVER: str = "smtp.gmail.com"
MAIL_FROM_NAME: str = "GARF System"
MAIL_STARTTLS: bool = True
MAIL_SSL_TLS: bool = False
USE_CREDENTIALS: bool = True
VALIDATE_CERTS: bool = True
```

## Frontend Integration

### Verification Page

Create a verification page at `/verify-email` that:
1. Extracts token from URL parameters
2. Calls the verification API endpoint
3. Shows success/error message
4. Redirects to appropriate page

### Example Frontend Code

```typescript
// Verify email token
const verifyEmail = async (token: string) => {
  try {
    const response = await fetch(`/api/v1/email-verification/verify?token=${token}`);
    const result = await response.json();
    
    if (result.success) {
      // Show success message
      // Redirect to survey or dashboard
    } else {
      // Show error message
    }
  } catch (error) {
    // Handle error
  }
};
```

## Testing

### Test Email Verification

1. **Submit a survey response** with an email address
2. **Check email inbox** for verification email
3. **Click verification link** or copy token
4. **Verify email** using API endpoint
5. **Check participant status** to confirm verification

### Test API Endpoints

Use the API documentation at `http://localhost:8000/api/v1/docs` to test all endpoints.

## Troubleshooting

### Common Issues

1. **Emails not sending**
   - Check email credentials
   - Verify SMTP settings
   - Check firewall/network restrictions

2. **Verification links not working**
   - Check `EMAIL_VERIFICATION_BASE_URL` setting
   - Verify frontend route exists
   - Check token expiration

3. **Database errors**
   - Run migration script
   - Check database permissions
   - Verify table structure

### Logs

Check application logs for email-related errors:
- SMTP connection issues
- Email sending failures
- Token verification errors

## Security Considerations

1. **Token Security**: UUID tokens are cryptographically secure
2. **Expiration**: Tokens expire after 24 hours
3. **Rate Limiting**: Consider implementing rate limiting for resend requests
4. **Email Validation**: Email addresses are validated before sending
5. **CORS**: Configure CORS properly for frontend integration

## Production Deployment

### Environment Variables

Set production email settings:
```bash
MAIL_USERNAME=production-email@yourdomain.com
MAIL_PASSWORD=secure-app-password
MAIL_FROM=noreply@yourdomain.com
MAIL_SERVER=smtp.yourdomain.com
EMAIL_VERIFICATION_BASE_URL=https://yourdomain.com
```

### Email Service Provider

Consider using a dedicated email service:
- **SendGrid**: Professional email delivery
- **AWS SES**: Scalable email service
- **Mailgun**: Developer-friendly email API

### Monitoring

Monitor email delivery:
- Track verification email send rates
- Monitor verification completion rates
- Set up alerts for email failures

## Future Enhancements

Potential improvements:
1. **Email Templates**: Customizable email templates
2. **Multiple Languages**: Support for more languages
3. **Email Analytics**: Track email open rates
4. **Bulk Verification**: Verify multiple emails at once
5. **Custom Expiration**: Configurable token expiration per use case
