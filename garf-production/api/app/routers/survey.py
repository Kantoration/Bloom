"""Survey management endpoints"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import json

from app.core.database import get_db
from app.models import Survey
from app.schemas.survey import SurveyCreate, SurveyResponse

router = APIRouter()


@router.post("/", response_model=SurveyResponse, status_code=status.HTTP_201_CREATED)
async def create_survey(
    survey_data: SurveyCreate,
    db: Session = Depends(get_db)
) -> Survey:
    """Create a new survey"""
    # Check if survey with same name and version exists
    existing = db.query(Survey).filter(
        Survey.name == survey_data.name,
        Survey.version == survey_data.version
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Survey '{survey_data.name}' version {survey_data.version} already exists"
        )
    
    # Create new survey
    survey = Survey(
        name=survey_data.name,
        version=survey_data.version,
        schema_json=survey_data.schema_json.dict(),
        ui_config_json=survey_data.ui_config_json.dict(),
        is_active=True
    )
    
    db.add(survey)
    db.commit()
    db.refresh(survey)
    
    return survey


@router.get("/{survey_id}", response_model=SurveyResponse)
async def get_survey(
    survey_id: int,
    db: Session = Depends(get_db)
) -> Survey:
    """Get survey by ID"""
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    
    if not survey:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Survey {survey_id} not found"
        )
    
    return survey


@router.get("/", response_model=List[SurveyResponse])
async def list_surveys(
    active_only: bool = Query(True, description="Only return active surveys"),
    name: Optional[str] = Query(None, description="Filter by survey name"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
) -> List[Survey]:
    """List surveys with optional filtering"""
    query = db.query(Survey)
    
    if active_only:
        query = query.filter(Survey.is_active == True)
    
    if name:
        query = query.filter(Survey.name.ilike(f"%{name}%"))
    
    surveys = query.order_by(Survey.created_at.desc()).limit(limit).offset(offset).all()
    
    return surveys


@router.get("/by-name/{name}", response_model=SurveyResponse)
async def get_survey_by_name(
    name: str,
    version: Optional[str] = Query("current", description="Version number or 'current' for latest active"),
    db: Session = Depends(get_db)
) -> Survey:
    """Get survey by name and version"""
    if version == "current":
        # Get latest active version
        survey = db.query(Survey).filter(
            Survey.name == name,
            Survey.is_active == True
        ).order_by(Survey.version.desc()).first()
    else:
        # Get specific version
        try:
            version_num = int(version)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Version must be a number or 'current'"
            )
        
        survey = db.query(Survey).filter(
            Survey.name == name,
            Survey.version == version_num
        ).first()
    
    if not survey:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Survey '{name}' version {version} not found"
        )
    
    return survey


@router.patch("/{survey_id}/deactivate", response_model=SurveyResponse)
async def deactivate_survey(
    survey_id: int,
    db: Session = Depends(get_db)
) -> Survey:
    """Deactivate a survey"""
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    
    if not survey:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Survey {survey_id} not found"
        )
    
    survey.is_active = False
    db.commit()
    db.refresh(survey)
    
    return survey


@router.patch("/{survey_id}/activate", response_model=SurveyResponse)
async def activate_survey(
    survey_id: int,
    db: Session = Depends(get_db)
) -> Survey:
    """Activate a survey"""
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    
    if not survey:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Survey {survey_id} not found"
        )
    
    survey.is_active = True
    db.commit()
    db.refresh(survey)
    
    return survey

