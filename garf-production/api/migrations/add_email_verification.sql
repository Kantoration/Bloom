-- Migration: Add email verification functionality
-- This migration adds email verification fields to participants table and creates email_verifications table

-- Add email verification fields to participants table
ALTER TABLE participants 
ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN email_verified_at TIMESTAMP WITH TIME ZONE;

-- Create email_verifications table
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

-- Create indexes for email_verifications table
CREATE INDEX idx_email_verifications_token ON email_verifications(token);
CREATE INDEX idx_email_verifications_participant_id ON email_verifications(participant_id);
CREATE INDEX idx_email_verifications_status ON email_verifications(status);

-- Add comment to the table
COMMENT ON TABLE email_verifications IS 'Email verification tokens for participants';
COMMENT ON COLUMN email_verifications.token IS 'Unique UUID token for email verification';
COMMENT ON COLUMN email_verifications.status IS 'Verification status: pending, verified, or expired';
COMMENT ON COLUMN email_verifications.expires_at IS 'When the verification token expires';
COMMENT ON COLUMN email_verifications.verified_at IS 'When the email was verified';

-- Add comments to participant table columns
COMMENT ON COLUMN participants.email_verified IS 'Whether the participant email has been verified';
COMMENT ON COLUMN participants.email_verified_at IS 'When the email was verified';
