"""Survey response endpoints"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Header
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
import hashlib
import json

from app.core.database import get_db
from app.models import Survey, Response, Participant, Features
from app.schemas.survey import ResponseSubmit, ResponseData, FeatureExtraction
from app.services.normalization import create_normalization_service
from app.services.validation import validate_response
from app.services.email_service import create_email_verification, email_service

router = APIRouter()


def get_ip_hash(ip_address: str) -> str:
    """Hash IP address for privacy"""
    return hashlib.sha256(ip_address.encode()).hexdigest()


async def extract_features_background(
    response_id: int,
    response_data: Dict[str, Any],
    survey_schema: Dict[str, Any],
    policy: Optional[Dict[str, Any]] = None
):
    """Background task to extract features from response"""
    from app.core.database import SessionLocal
    
    db = SessionLocal()
    try:
        # Create normalization service
        service = create_normalization_service(survey_schema, policy)
        
        # Extract features
        from app.schemas.survey import SurveySchema
        schema = SurveySchema(**survey_schema)
        
        features_data = service.extract_features(
            response_data,
            schema.fields,
            policy.get("age_rules") if policy else None
        )
        
        # Save features to database
        features = Features(
            response_id=response_id,
            numeric_json=features_data["numeric"],
            categorical_json=features_data["categorical"],
            age_band=features_data.get("age_band"),
            nlp_features_json=features_data.get("nlp_features")
        )
        
        db.add(features)
        db.commit()
        
    except Exception as e:
        print(f"Error extracting features for response {response_id}: {e}")
    finally:
        db.close()


@router.post("/{survey_id}/submit", response_model=ResponseData, status_code=status.HTTP_201_CREATED)
async def submit_response(
    survey_id: int,
    submission: ResponseSubmit,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user_agent: Optional[str] = Header(None),
    x_forwarded_for: Optional[str] = Header(None),
    x_real_ip: Optional[str] = Header(None)
) -> Response:
    """Submit a survey response"""
    # Validate survey exists and is active
    survey = db.query(Survey).filter(
        Survey.id == survey_id,
        Survey.is_active == True
    ).first()
    
    if not survey:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Active survey {survey_id} not found"
        )
    
    # Validate response against schema
    try:
        from app.schemas.survey import SurveySchema
        schema = SurveySchema(**survey.schema_json)
        validation_errors = validate_response(submission.data, schema)
        
        if validation_errors:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"validation_errors": validation_errors}
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Response validation failed: {str(e)}"
        )
    
    # Get or create participant
    participant = None
    if submission.participant_email or submission.participant_phone:
        # Check for existing participant
        if submission.participant_email:
            participant = db.query(Participant).filter(
                Participant.email == submission.participant_email
            ).first()
        elif submission.participant_phone:
            participant = db.query(Participant).filter(
                Participant.phone == submission.participant_phone
            ).first()
        
        # Check if participant is banned
        if participant and participant.banned:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not allowed to submit responses"
            )
        
        # Create new participant if not exists
        if not participant:
            participant = Participant(
                email=submission.participant_email,
                phone=submission.participant_phone,
                full_name=submission.participant_name,
                locale=submission.locale
            )
            db.add(participant)
            db.flush()
    
    # Get IP for hashing (prefer X-Forwarded-For for proxied requests)
    client_ip = x_forwarded_for or x_real_ip or "unknown"
    if "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()
    
    # Create response
    response = Response(
        participant_id=participant.id if participant else None,
        survey_id=survey_id,
        status="submitted",
        raw_json=submission.data,
        user_agent=user_agent,
        ip_hash=get_ip_hash(client_ip) if client_ip != "unknown" else None
    )
    
    db.add(response)
    db.commit()
    db.refresh(response)
    
    # Get active policy for feature extraction
    from app.models import GroupingPolicy
    active_policy = db.query(GroupingPolicy).filter(
        GroupingPolicy.survey_id == survey_id,
        GroupingPolicy.is_active == True
    ).first()
    
    policy_dict = None
    if active_policy:
        policy_dict = {
            "normalization": active_policy.normalization_json,
            "age_rules": active_policy.rules_json.get("age_rules")
        }
    
    # Trigger feature extraction in background
    background_tasks.add_task(
        extract_features_background,
        response.id,
        submission.data,
        survey.schema_json,
        policy_dict
    )
    
    # Send email verification if participant has email and it's not verified
    if participant and participant.email and not participant.email_verified:
        verification = create_email_verification(db, participant, participant.email)
        background_tasks.add_task(
            email_service.send_verification_email,
            participant,
            verification,
            participant.locale or "he"
        )
    
    # Check if we should trigger grouping (threshold-based or scheduled)
    # This would be handled by a separate worker/scheduler in production
    
    return response


@router.get("/{response_id}", response_model=ResponseData)
async def get_response(
    response_id: int,
    db: Session = Depends(get_db)
) -> Response:
    """Get a specific response"""
    response = db.query(Response).filter(Response.id == response_id).first()
    
    if not response:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Response {response_id} not found"
        )
    
    # Include features if available
    features = db.query(Features).filter(Features.response_id == response_id).first()
    if features:
        response.features = {
            "numeric": features.numeric_json,
            "categorical": features.categorical_json,
            "age_band": features.age_band
        }
    
    return response


@router.post("/{survey_id}/save_draft", response_model=ResponseData)
async def save_draft(
    survey_id: int,
    submission: ResponseSubmit,
    db: Session = Depends(get_db)
) -> Response:
    """Save a draft response (optional feature)"""
    # Similar to submit but with status="draft"
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    
    if not survey:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Survey {survey_id} not found"
        )
    
    # For drafts, we might want to allow partial data
    # so validation could be more lenient
    
    # Get or create participant (similar logic as submit)
    participant = None
    if submission.participant_email:
        participant = db.query(Participant).filter(
            Participant.email == submission.participant_email
        ).first()
        
        if not participant:
            participant = Participant(
                email=submission.participant_email,
                phone=submission.participant_phone,
                full_name=submission.participant_name,
                locale=submission.locale
            )
            db.add(participant)
            db.flush()
    
    # Check for existing draft
    existing_draft = None
    if participant:
        existing_draft = db.query(Response).filter(
            Response.participant_id == participant.id,
            Response.survey_id == survey_id,
            Response.status == "draft"
        ).first()
    
    if existing_draft:
        # Update existing draft
        existing_draft.raw_json = submission.data
        db.commit()
        db.refresh(existing_draft)
        return existing_draft
    else:
        # Create new draft
        response = Response(
            participant_id=participant.id if participant else None,
            survey_id=survey_id,
            status="draft",
            raw_json=submission.data
        )
        
        db.add(response)
        db.commit()
        db.refresh(response)
        
        return response

