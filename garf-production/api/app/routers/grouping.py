"""Grouping management endpoints"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import json
import hashlib
from datetime import datetime

from app.core.database import get_db
from app.models import (
    Survey, GroupingPolicy, GroupingRun, Group, GroupMember,
    Response, Features, Participant
)
from app.schemas.grouping import (
    PolicyCreate, PolicyResponse, RunCreate, RunResponse,
    GroupData, GroupingPolicy as PolicySchema
)

router = APIRouter()


@router.post("/policies", response_model=PolicyResponse, status_code=status.HTTP_201_CREATED)
async def create_policy(
    policy_data: PolicyCreate,
    db: Session = Depends(get_db)
) -> GroupingPolicy:
    """Create or update grouping policy for a survey"""
    # Validate survey exists
    survey = db.query(Survey).filter(Survey.id == policy_data.survey_id).first()
    if not survey:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Survey {policy_data.survey_id} not found"
        )
    
    # Deactivate existing policies for this survey
    db.query(GroupingPolicy).filter(
        GroupingPolicy.survey_id == policy_data.survey_id,
        GroupingPolicy.is_active == True
    ).update({"is_active": False})
    
    # Create new policy
    policy = GroupingPolicy(
        survey_id=policy_data.survey_id,
        is_active=True,
        rules_json=policy_data.rules_json,
        weights_json=policy_data.weights_json,
        normalization_json=policy_data.normalization_json,
        subspace_json=policy_data.subspace_json
    )
    
    db.add(policy)
    db.commit()
    db.refresh(policy)
    
    return policy


@router.get("/policies", response_model=List[PolicyResponse])
async def list_policies(
    survey_id: Optional[int] = Query(None),
    active_only: bool = Query(True),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
) -> List[GroupingPolicy]:
    """List grouping policies"""
    query = db.query(GroupingPolicy)
    
    if survey_id:
        query = query.filter(GroupingPolicy.survey_id == survey_id)
    
    if active_only:
        query = query.filter(GroupingPolicy.is_active == True)
    
    policies = query.order_by(GroupingPolicy.created_at.desc()).limit(limit).offset(offset).all()
    
    return policies


@router.get("/policies/{policy_id}", response_model=PolicyResponse)
async def get_policy(
    policy_id: int,
    db: Session = Depends(get_db)
) -> GroupingPolicy:
    """Get specific policy"""
    policy = db.query(GroupingPolicy).filter(GroupingPolicy.id == policy_id).first()
    
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy {policy_id} not found"
        )
    
    return policy


async def run_grouping_task(run_id: int):
    """Background task to run grouping algorithm"""
    from app.core.database import SessionLocal
    from app.services.grouping_engine import GroupingEngine
    import pandas as pd
    
    db = SessionLocal()
    try:
        # Get run and update status
        run = db.query(GroupingRun).filter(GroupingRun.id == run_id).first()
        if not run:
            return
        
        run.status = "running"
        run.started_at = datetime.utcnow()
        db.commit()
        
        # Get survey
        survey = db.query(Survey).filter(Survey.id == run.survey_id).first()
        
        # Get all responses with features for this survey
        responses_with_features = db.query(Response, Features).join(
            Features, Response.id == Features.response_id
        ).filter(
            Response.survey_id == run.survey_id,
            Response.status == "submitted"
        ).all()
        
        if not responses_with_features:
            run.status = "done"
            run.finished_at = datetime.utcnow()
            run.error_text = "No responses with features found"
            db.commit()
            return
        
        # Build DataFrame for grouping engine
        data_for_grouping = []
        participant_map = {}  # Map index to participant_id
        
        for idx, (response, features) in enumerate(responses_with_features):
            row_data = {}
            
            # Add numeric features
            if features.numeric_json:
                row_data.update(features.numeric_json)
            
            # Add categorical features
            if features.categorical_json:
                row_data.update(features.categorical_json)
            
            # Add age band
            if features.age_band:
                row_data["age_band"] = features.age_band
            
            data_for_grouping.append(row_data)
            participant_map[idx] = response.participant_id
        
        df = pd.DataFrame(data_for_grouping)
        
        # Create grouping engine
        engine = GroupingEngine(run.policy_json, df)
        
        # Run grouping
        groups, explanations = engine.run()
        
        # Save groups to database
        for group_indices, explanation in zip(groups, explanations):
            # Create group
            group = Group(
                survey_id=run.survey_id,
                run_id=run.id,
                score=explanation.get("group_score", 0.0),
                size=len(group_indices),
                explain_json=explanation
            )
            db.add(group)
            db.flush()
            
            # Add group members
            for idx in group_indices:
                participant_id = participant_map.get(idx)
                if participant_id:
                    member = GroupMember(
                        group_id=group.id,
                        participant_id=participant_id,
                        role=None  # Can be set later
                    )
                    db.add(member)
        
        # Update run status
        run.status = "done"
        run.finished_at = datetime.utcnow()
        
        # Add statistics
        stats = engine.get_statistics()
        run.error_text = json.dumps(stats)  # Store stats in error_text for now
        
        db.commit()
        
    except Exception as e:
        if 'run' in locals():
            run.status = "failed"
            run.finished_at = datetime.utcnow()
            run.error_text = str(e)
            db.commit()
    finally:
        db.close()


@router.post("/runs", response_model=RunResponse, status_code=status.HTTP_201_CREATED)
async def create_run(
    run_data: RunCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
) -> GroupingRun:
    """Create and trigger a grouping run"""
    # Validate survey exists
    survey = db.query(Survey).filter(Survey.id == run_data.survey_id).first()
    if not survey:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Survey {run_data.survey_id} not found"
        )
    
    # Get policy (use override if provided, otherwise get active policy)
    if run_data.policy_override:
        policy_dict = run_data.policy_override.dict()
    else:
        active_policy = db.query(GroupingPolicy).filter(
            GroupingPolicy.survey_id == run_data.survey_id,
            GroupingPolicy.is_active == True
        ).first()
        
        if not active_policy:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active policy found for survey"
            )
        
        policy_dict = {
            "group_size": active_policy.rules_json.get("group_size", 6),
            "subspaces": active_policy.subspace_json,
            "hard": active_policy.rules_json.get("hard", {}),
            "soft": active_policy.rules_json.get("soft", {}),
            "age_rules": active_policy.rules_json.get("age_rules"),
            "normalization": active_policy.normalization_json,
            "fallback": active_policy.rules_json.get("fallback", {}),
            "pairs": active_policy.rules_json.get("pairs", {})
        }
    
    # Check idempotency
    if run_data.idempotency_key:
        # Hash the idempotency key with survey_id
        key_hash = hashlib.sha256(
            f"{run_data.survey_id}:{run_data.idempotency_key}".encode()
        ).hexdigest()
        
        # Check for existing run with same key
        existing_run = db.query(GroupingRun).filter(
            GroupingRun.survey_id == run_data.survey_id,
            GroupingRun.error_text.like(f"%idempotency_key:{key_hash}%")
        ).first()
        
        if existing_run:
            return existing_run
    
    # Create run
    run = GroupingRun(
        survey_id=run_data.survey_id,
        policy_json=policy_dict,
        status="queued"
    )
    
    db.add(run)
    db.commit()
    db.refresh(run)
    
    # Trigger background task
    background_tasks.add_task(run_grouping_task, run.id)
    
    return run


@router.get("/runs/{run_id}", response_model=RunResponse)
async def get_run(
    run_id: int,
    db: Session = Depends(get_db)
) -> GroupingRun:
    """Get specific grouping run"""
    run = db.query(GroupingRun).filter(GroupingRun.id == run_id).first()
    
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run {run_id} not found"
        )
    
    # Add statistics
    if run.status == "done":
        group_count = db.query(Group).filter(Group.run_id == run_id).count()
        run.total_groups = group_count
        
        # Parse stats from error_text if available
        if run.error_text and run.error_text.startswith("{"):
            try:
                stats = json.loads(run.error_text)
                run.total_participants = stats.get("total_participants")
                run.ungrouped_participants = stats.get("ungrouped_participants")
            except:
                pass
    
    return run


@router.get("/runs", response_model=List[RunResponse])
async def list_runs(
    survey_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
) -> List[GroupingRun]:
    """List grouping runs"""
    query = db.query(GroupingRun)
    
    if survey_id:
        query = query.filter(GroupingRun.survey_id == survey_id)
    
    if status:
        query = query.filter(GroupingRun.status == status)
    
    runs = query.order_by(GroupingRun.created_at.desc()).limit(limit).offset(offset).all()
    
    return runs


@router.get("/groups", response_model=List[GroupData])
async def list_groups(
    run_id: Optional[int] = Query(None),
    survey_id: Optional[int] = Query(None),
    include_members: bool = Query(False),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
) -> List[Group]:
    """List groups"""
    query = db.query(Group)
    
    if run_id:
        query = query.filter(Group.run_id == run_id)
    
    if survey_id:
        query = query.filter(Group.survey_id == survey_id)
    
    groups = query.order_by(Group.created_at.desc()).limit(limit).offset(offset).all()
    
    # Include members if requested
    if include_members:
        for group in groups:
            members = db.query(GroupMember, Participant).join(
                Participant, GroupMember.participant_id == Participant.id
            ).filter(GroupMember.group_id == group.id).all()
            
            group.members = [
                {
                    "participant_id": member.participant_id,
                    "name": participant.full_name,
                    "email": participant.email,
                    "role": member.role
                }
                for member, participant in members
            ]
    
    return groups


@router.get("/groups/{group_id}", response_model=GroupData)
async def get_group(
    group_id: int,
    db: Session = Depends(get_db)
) -> Group:
    """Get specific group with members"""
    group = db.query(Group).filter(Group.id == group_id).first()
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group {group_id} not found"
        )
    
    # Include members
    members = db.query(GroupMember, Participant).join(
        Participant, GroupMember.participant_id == Participant.id
    ).filter(GroupMember.group_id == group_id).all()
    
    group.members = [
        {
            "participant_id": member.participant_id,
            "name": participant.full_name,
            "email": participant.email,
            "phone": participant.phone,
            "role": member.role,
            "pair_id": member.pair_id
        }
        for member, participant in members
    ]
    
    return group

