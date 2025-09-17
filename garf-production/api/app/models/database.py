"""Database models for GARF Production System"""

from datetime import datetime
from typing import Optional
from sqlalchemy import Column, Integer, BigInteger, String, Text, Boolean, DateTime, ForeignKey, Double, UniqueConstraint, Index, UUID
from sqlalchemy.dialects.postgresql import JSONB, CITEXT, UUID as PostgresUUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

Base = declarative_base()


class Participant(Base):
    __tablename__ = "participants"
    
    id = Column(BigInteger, primary_key=True)
    email = Column(CITEXT, unique=True, nullable=True)
    phone = Column(Text)
    full_name = Column(Text)
    locale = Column(Text, default="he")
    banned = Column(Boolean, nullable=False, default=False)
    email_verified = Column(Boolean, nullable=False, default=False)
    email_verified_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    responses = relationship("Response", back_populates="participant")
    group_memberships = relationship("GroupMember", back_populates="participant")
    email_verifications = relationship("EmailVerification", back_populates="participant")


class EmailVerification(Base):
    __tablename__ = "email_verifications"
    
    id = Column(BigInteger, primary_key=True)
    participant_id = Column(BigInteger, ForeignKey("participants.id", ondelete="CASCADE"), nullable=False)
    email = Column(CITEXT, nullable=False)
    token = Column(PostgresUUID(as_uuid=True), nullable=False, default=uuid.uuid4, unique=True)
    status = Column(Text, nullable=False, default="pending")  # pending|verified|expired
    expires_at = Column(DateTime(timezone=True), nullable=False)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    participant = relationship("Participant", back_populates="email_verifications")
    
    __table_args__ = (
        Index('idx_email_verifications_token', 'token'),
        Index('idx_email_verifications_participant_id', 'participant_id'),
        Index('idx_email_verifications_status', 'status'),
    )


class Survey(Base):
    __tablename__ = "surveys"
    
    id = Column(BigInteger, primary_key=True)
    name = Column(Text, nullable=False)
    version = Column(Integer, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    schema_json = Column(JSONB, nullable=False)  # Field definitions
    ui_config_json = Column(JSONB, nullable=False)  # UI configuration
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    responses = relationship("Response", back_populates="survey")
    policies = relationship("GroupingPolicy", back_populates="survey")
    runs = relationship("GroupingRun", back_populates="survey")
    groups = relationship("Group", back_populates="survey")
    
    __table_args__ = (
        UniqueConstraint('name', 'version', name='_survey_name_version_uc'),
    )


class Response(Base):
    __tablename__ = "responses"
    
    id = Column(BigInteger, primary_key=True)
    participant_id = Column(BigInteger, ForeignKey("participants.id", ondelete="SET NULL"))
    survey_id = Column(BigInteger, ForeignKey("surveys.id", ondelete="RESTRICT"))
    status = Column(Text, nullable=False, default="submitted")  # draft|submitted
    raw_json = Column(JSONB, nullable=False)  # Raw response data
    user_agent = Column(Text)
    ip_hash = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    participant = relationship("Participant", back_populates="responses")
    survey = relationship("Survey", back_populates="responses")
    features = relationship("Features", back_populates="response", uselist=False)
    
    __table_args__ = (
        Index('idx_responses_survey_id', 'survey_id'),
        Index('idx_responses_participant_id', 'participant_id'),
    )


class Features(Base):
    __tablename__ = "features"
    
    id = Column(BigInteger, primary_key=True)
    response_id = Column(BigInteger, ForeignKey("responses.id", ondelete="CASCADE"), unique=True)
    numeric_json = Column(JSONB, nullable=False)  # Numeric features
    categorical_json = Column(JSONB, nullable=False)  # Categorical features (normalized)
    nlp_features_json = Column(JSONB)  # Optional NLP features
    age_band = Column(Text)  # 20s|30s|40s|50plus
    computed_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    response = relationship("Response", back_populates="features")
    
    __table_args__ = (
        Index('idx_features_response_id', 'response_id'),
    )


class GroupingPolicy(Base):
    __tablename__ = "grouping_policies"
    
    id = Column(BigInteger, primary_key=True)
    survey_id = Column(BigInteger, ForeignKey("surveys.id"))
    is_active = Column(Boolean, nullable=False, default=True)
    rules_json = Column(JSONB, nullable=False)  # Hard/soft constraints
    weights_json = Column(JSONB, nullable=False)  # Scoring weights
    normalization_json = Column(JSONB, nullable=False)  # Wildcard tokens
    subspace_json = Column(JSONB, nullable=False)  # Subspace keys
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    survey = relationship("Survey", back_populates="policies")


class GroupingRun(Base):
    __tablename__ = "grouping_runs"
    
    id = Column(BigInteger, primary_key=True)
    survey_id = Column(BigInteger, ForeignKey("surveys.id"))
    policy_json = Column(JSONB, nullable=False)  # Frozen policy snapshot
    status = Column(Text, nullable=False)  # queued|running|done|failed
    started_at = Column(DateTime(timezone=True))
    finished_at = Column(DateTime(timezone=True))
    error_text = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    survey = relationship("Survey", back_populates="runs")
    groups = relationship("Group", back_populates="run")
    
    __table_args__ = (
        Index('idx_grouping_runs_survey_id', 'survey_id'),
        Index('idx_grouping_runs_status', 'status'),
    )


class Group(Base):
    __tablename__ = "groups"
    
    id = Column(BigInteger, primary_key=True)
    survey_id = Column(BigInteger, ForeignKey("surveys.id"))
    run_id = Column(BigInteger, ForeignKey("grouping_runs.id"))
    score = Column(Double)
    size = Column(Integer)
    explain_json = Column(JSONB)  # Explanation of constraints and scoring
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    survey = relationship("Survey", back_populates="groups")
    run = relationship("GroupingRun", back_populates="groups")
    members = relationship("GroupMember", back_populates="group")
    
    __table_args__ = (
        Index('idx_groups_run_id', 'run_id'),
    )


class GroupMember(Base):
    __tablename__ = "group_members"
    
    group_id = Column(BigInteger, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True)
    participant_id = Column(BigInteger, ForeignKey("participants.id", ondelete="CASCADE"), primary_key=True)
    role = Column(Text)  # host|icebreaker|friend etc.
    pair_id = Column(BigInteger)  # Friend-pair linking if set
    
    # Relationships
    group = relationship("Group", back_populates="members")
    participant = relationship("Participant", back_populates="group_memberships")
    
    __table_args__ = (
        Index('idx_group_members_participant_id', 'participant_id'),
    )


class Admin(Base):
    __tablename__ = "admins"
    
    id = Column(BigInteger, primary_key=True)
    auth_provider = Column(Text, nullable=False)  # github|google|passwordless
    subject = Column(Text, nullable=False, unique=True)
    display_name = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    audit_logs = relationship("AuditLog", back_populates="admin")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(BigInteger, primary_key=True)
    actor_admin_id = Column(BigInteger, ForeignKey("admins.id"))
    action = Column(Text, nullable=False)
    payload_json = Column(JSONB)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    admin = relationship("Admin", back_populates="audit_logs")
    
    __table_args__ = (
        Index('idx_audit_logs_actor_admin_id', 'actor_admin_id'),
        Index('idx_audit_logs_created_at', 'created_at', postgresql_using='btree', postgresql_ops={'created_at': 'DESC'}),
    )

