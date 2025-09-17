"""Pydantic schemas for grouping policies and runs"""

from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field, validator
from enum import Enum


class AgeBand(BaseModel):
    """Age band configuration"""
    name: str
    min: int
    max: int
    max_spread: Optional[int] = None


class AgeRules(BaseModel):
    """Age-based grouping rules"""
    field: str
    bands: List[AgeBand]
    allow_cross_band: bool = False
    boundary_slack_years: int = 0
    group_constraints: Optional[Dict[str, Any]] = None


class HardConstraints(BaseModel):
    """Hard constraints that must be satisfied"""
    categorical_equal: List[str] = Field(default_factory=list)
    multi_overlap: List[str] = Field(default_factory=list)
    numeric_tol: Dict[str, float] = Field(default_factory=dict)


class SoftConstraints(BaseModel):
    """Soft constraints for scoring"""
    numeric_features: List[str] = Field(default_factory=list)
    categorical_features: Dict[str, str] = Field(default_factory=dict)  # field: scoring_type
    multi_choice_features: Dict[str, str] = Field(default_factory=dict)
    weights: Dict[str, float] = Field(
        default_factory=lambda: {
            "diversity_numeric": 1.0,
            "similarity_bonus": 0.2,
            "categorical_diversity": 0.4,
            "multi_overlap_bonus": 0.5
        }
    )


class PairRules(BaseModel):
    """Rules for handling pairs"""
    friend_pairs: bool = True
    sit_together: bool = True
    max_pairs_per_group: Optional[int] = None


class FallbackRules(BaseModel):
    """Fallback rules when constraints can't be satisfied"""
    defer_if_infeasible: bool = True
    min_group_size: int = 4
    max_group_size: int = 6
    allow_partial_groups: bool = False


class GroupingPolicy(BaseModel):
    """Complete grouping policy configuration"""
    group_size: int = 6
    subspaces: List[List[str]] = Field(default_factory=list)  # [["language", "budget"], ["area"]]
    hard: HardConstraints = Field(default_factory=HardConstraints)
    soft: SoftConstraints = Field(default_factory=SoftConstraints)
    age_rules: Optional[AgeRules] = None
    pairs: PairRules = Field(default_factory=PairRules)
    fallback: FallbackRules = Field(default_factory=FallbackRules)
    
    # Normalization settings
    normalization: Dict[str, Any] = Field(
        default_factory=lambda: {
            "flexible_answers": [
                "לא משנה לי", "גם וגם", "אין", "לא חשוב", 
                "שילוב", "בין לבין", "לא משנה", "כל האפשרויות",
                "אין העדפה", "לא רלוונטי"
            ]
        }
    )


class PolicyCreate(BaseModel):
    """Create a new grouping policy"""
    survey_id: int
    rules_json: Dict[str, Any]
    weights_json: Dict[str, Any]
    normalization_json: Dict[str, Any]
    subspace_json: List[List[str]]


class PolicyResponse(BaseModel):
    """Grouping policy from database"""
    id: int
    survey_id: int
    is_active: bool
    rules_json: Dict[str, Any]
    weights_json: Dict[str, Any]
    normalization_json: Dict[str, Any]
    subspace_json: List[List[str]]
    created_at: datetime
    
    class Config:
        orm_mode = True


class RunStatus(str, Enum):
    """Grouping run status"""
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


class RunCreate(BaseModel):
    """Create a new grouping run"""
    survey_id: int
    policy_override: Optional[GroupingPolicy] = None
    idempotency_key: Optional[str] = None


class RunResponse(BaseModel):
    """Grouping run from database"""
    id: int
    survey_id: int
    policy_json: Dict[str, Any]
    status: RunStatus
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    error_text: Optional[str]
    created_at: datetime
    
    # Statistics
    total_groups: Optional[int] = None
    total_participants: Optional[int] = None
    ungrouped_participants: Optional[int] = None
    
    class Config:
        orm_mode = True


class GroupExplanation(BaseModel):
    """Explanation for a group's formation"""
    policy_hash: str
    subspace: Dict[str, str]
    age_rules: Optional[str] = None
    hard_constraints: Dict[str, str]
    soft_scores: Dict[str, float]
    members: List[Dict[str, Any]]


class GroupData(BaseModel):
    """Group data from database"""
    id: int
    survey_id: int
    run_id: int
    score: float
    size: int
    explain_json: Optional[GroupExplanation] = None
    created_at: datetime
    
    # Members
    members: Optional[List[Dict[str, Any]]] = None
    
    class Config:
        orm_mode = True


class ParticipantGrouping(BaseModel):
    """Participant's group assignment"""
    participant_id: int
    group_id: int
    role: Optional[str] = None
    pair_id: Optional[int] = None
    bound_by: List[str]  # Constraints that bound this participant

