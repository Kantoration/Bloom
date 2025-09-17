"""Admin endpoints for export and management"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
import csv
import io
from datetime import datetime

from app.core.database import get_db
from app.models import (
    Survey, Response, Features, GroupingRun, Group, GroupMember,
    Participant, GroupingPolicy, AuditLog
)

router = APIRouter()

# Note: In production, these endpoints should require authentication
# For now, they're open for development


@router.get("/export/responses.csv")
async def export_responses(
    survey_id: Optional[int] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db)
):
    """Export responses as CSV"""
    query = db.query(Response, Participant, Survey).outerjoin(
        Participant, Response.participant_id == Participant.id
    ).join(
        Survey, Response.survey_id == Survey.id
    )
    
    if survey_id:
        query = query.filter(Response.survey_id == survey_id)
    
    if start_date:
        query = query.filter(Response.created_at >= start_date)
    
    if end_date:
        query = query.filter(Response.created_at <= end_date)
    
    responses = query.all()
    
    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    headers = [
        "response_id", "survey_name", "survey_version", "participant_email",
        "participant_name", "participant_phone", "status", "created_at"
    ]
    
    # Add dynamic headers from response data
    if responses:
        sample_data = responses[0][0].raw_json
        headers.extend(sample_data.keys())
    
    writer.writerow(headers)
    
    # Write data
    for response, participant, survey in responses:
        row = [
            response.id,
            survey.name,
            survey.version,
            participant.email if participant else "",
            participant.full_name if participant else "",
            participant.phone if participant else "",
            response.status,
            response.created_at.isoformat()
        ]
        
        # Add response data
        for key in response.raw_json.keys():
            value = response.raw_json.get(key, "")
            if isinstance(value, list):
                value = ", ".join(str(v) for v in value)
            row.append(value)
        
        writer.writerow(row)
    
    # Return as streaming response
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=responses_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        }
    )


@router.get("/export/features.csv")
async def export_features(
    survey_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Export extracted features as CSV"""
    query = db.query(Features, Response).join(
        Response, Features.response_id == Response.id
    )
    
    if survey_id:
        query = query.filter(Response.survey_id == survey_id)
    
    features_data = query.all()
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Collect all unique feature names
    all_numeric_features = set()
    all_categorical_features = set()
    
    for features, response in features_data:
        if features.numeric_json:
            all_numeric_features.update(features.numeric_json.keys())
        if features.categorical_json:
            all_categorical_features.update(features.categorical_json.keys())
    
    # Write header
    headers = ["response_id", "survey_id", "age_band"]
    headers.extend(f"numeric_{f}" for f in sorted(all_numeric_features))
    headers.extend(f"categorical_{f}" for f in sorted(all_categorical_features))
    writer.writerow(headers)
    
    # Write data
    for features, response in features_data:
        row = [response.id, response.survey_id, features.age_band or ""]
        
        # Add numeric features
        for feature_name in sorted(all_numeric_features):
            value = features.numeric_json.get(feature_name, "")
            row.append(value)
        
        # Add categorical features
        for feature_name in sorted(all_categorical_features):
            value = features.categorical_json.get(feature_name, "")
            if isinstance(value, list):
                value = ", ".join(str(v) for v in value)
            row.append(value)
        
        writer.writerow(row)
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=features_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        }
    )


@router.get("/export/groups.csv")
async def export_groups(
    run_id: Optional[int] = Query(None),
    survey_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Export groups as CSV"""
    query = db.query(Group)
    
    if run_id:
        query = query.filter(Group.run_id == run_id)
    
    if survey_id:
        query = query.filter(Group.survey_id == survey_id)
    
    groups = query.all()
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    headers = [
        "group_id", "run_id", "survey_id", "score", "size",
        "participant_ids", "participant_names", "participant_emails"
    ]
    writer.writerow(headers)
    
    # Write data
    for group in groups:
        # Get members
        members = db.query(GroupMember, Participant).join(
            Participant, GroupMember.participant_id == Participant.id
        ).filter(GroupMember.group_id == group.id).all()
        
        participant_ids = ", ".join(str(m.participant_id) for m, p in members)
        participant_names = ", ".join(p.full_name or "" for m, p in members)
        participant_emails = ", ".join(p.email or "" for m, p in members)
        
        row = [
            group.id,
            group.run_id,
            group.survey_id,
            group.score,
            group.size,
            participant_ids,
            participant_names,
            participant_emails
        ]
        
        writer.writerow(row)
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=groups_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        }
    )


@router.get("/export/runs.csv")
async def export_runs(
    survey_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Export grouping runs as CSV"""
    query = db.query(GroupingRun, Survey).join(
        Survey, GroupingRun.survey_id == Survey.id
    )
    
    if survey_id:
        query = query.filter(GroupingRun.survey_id == survey_id)
    
    runs_data = query.all()
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    headers = [
        "run_id", "survey_name", "survey_version", "status",
        "started_at", "finished_at", "created_at", "total_groups",
        "error_text"
    ]
    writer.writerow(headers)
    
    # Write data
    for run, survey in runs_data:
        # Count groups
        group_count = db.query(Group).filter(Group.run_id == run.id).count()
        
        row = [
            run.id,
            survey.name,
            survey.version,
            run.status,
            run.started_at.isoformat() if run.started_at else "",
            run.finished_at.isoformat() if run.finished_at else "",
            run.created_at.isoformat(),
            group_count,
            run.error_text or ""
        ]
        
        writer.writerow(row)
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=runs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        }
    )


@router.get("/export/audit.csv")
async def export_audit_logs(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db)
):
    """Export audit logs as CSV"""
    query = db.query(AuditLog)
    
    if start_date:
        query = query.filter(AuditLog.created_at >= start_date)
    
    if end_date:
        query = query.filter(AuditLog.created_at <= end_date)
    
    logs = query.order_by(AuditLog.created_at.desc()).all()
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    headers = ["log_id", "admin_id", "action", "payload", "created_at"]
    writer.writerow(headers)
    
    # Write data
    for log in logs:
        row = [
            log.id,
            log.actor_admin_id,
            log.action,
            str(log.payload_json),
            log.created_at.isoformat()
        ]
        
        writer.writerow(row)
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=audit_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        }
    )


@router.get("/statistics")
async def get_statistics(
    survey_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Get system statistics"""
    stats = {}
    
    # Survey stats
    if survey_id:
        stats["survey_id"] = survey_id
        stats["total_responses"] = db.query(Response).filter(
            Response.survey_id == survey_id
        ).count()
        stats["submitted_responses"] = db.query(Response).filter(
            Response.survey_id == survey_id,
            Response.status == "submitted"
        ).count()
        stats["draft_responses"] = db.query(Response).filter(
            Response.survey_id == survey_id,
            Response.status == "draft"
        ).count()
        stats["total_runs"] = db.query(GroupingRun).filter(
            GroupingRun.survey_id == survey_id
        ).count()
        stats["total_groups"] = db.query(Group).filter(
            Group.survey_id == survey_id
        ).count()
    else:
        stats["total_surveys"] = db.query(Survey).count()
        stats["active_surveys"] = db.query(Survey).filter(
            Survey.is_active == True
        ).count()
        stats["total_participants"] = db.query(Participant).count()
        stats["total_responses"] = db.query(Response).count()
        stats["total_runs"] = db.query(GroupingRun).count()
        stats["total_groups"] = db.query(Group).count()
    
    return stats

