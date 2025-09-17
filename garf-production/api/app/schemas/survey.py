"""Pydantic schemas for surveys and responses"""

from datetime import datetime
from typing import Dict, List, Optional, Any, Union, Literal
from pydantic import BaseModel, Field, EmailStr, validator
from enum import Enum


class FieldType(str, Enum):
    """Survey field types"""
    SINGLE_SELECT = "single_select"
    MULTI_SELECT = "multi_select"
    SCALE = "scale"
    TEXT = "text"
    NUMBER = "number"
    EMAIL = "email"
    PHONE = "phone"
    DATE = "date"


class FieldRole(str, Enum):
    """Field role in grouping algorithm"""
    HARD_CONSTRAINT = "hard_constraint"
    SOFT_CONSTRAINT = "soft_constraint"
    EXPLAIN_ONLY = "explain_only"
    IDENTIFIER = "identifier"


class NormalizationConfig(BaseModel):
    """Normalization configuration for a field"""
    wildcards: List[str] = Field(default_factory=list)
    expansion: List[str] = Field(default_factory=list)
    synonyms: Dict[str, str] = Field(default_factory=dict)


class FieldDefinition(BaseModel):
    """Survey field definition"""
    name: str
    label: Dict[str, str]  # {"he": "שאלה", "en": "Question"}
    type: FieldType
    required: bool = False
    role: FieldRole = FieldRole.EXPLAIN_ONLY
    
    # Type-specific properties
    options: Optional[List[str]] = None  # For select fields
    min: Optional[Union[int, float]] = None  # For scale/number
    max: Optional[Union[int, float]] = None  # For scale/number
    tolerance: Optional[Union[int, float]] = None  # For numeric hard constraints
    max_length: Optional[int] = None  # For text fields
    placeholder: Optional[Dict[str, str]] = None
    help_text: Optional[Dict[str, str]] = None
    
    # Normalization
    normalization: Optional[NormalizationConfig] = None
    
    @validator('options')
    def validate_options(cls, v, values):
        field_type = values.get('type')
        if field_type in [FieldType.SINGLE_SELECT, FieldType.MULTI_SELECT]:
            if not v or len(v) == 0:
                raise ValueError(f"Select fields must have options")
        return v
    
    @validator('min', 'max')
    def validate_scale_bounds(cls, v, values):
        field_type = values.get('type')
        if field_type in [FieldType.SCALE, FieldType.NUMBER]:
            if v is None:
                raise ValueError(f"Scale/number fields must have min and max")
        return v


class SurveySchema(BaseModel):
    """Survey schema definition"""
    fields: List[FieldDefinition]
    
    def get_field_by_name(self, name: str) -> Optional[FieldDefinition]:
        """Get field definition by name"""
        for field in self.fields:
            if field.name == name:
                return field
        return None


class UIConfig(BaseModel):
    """UI configuration for survey display"""
    title: Dict[str, str]
    description: Dict[str, str]
    submit_button: Dict[str, str] = {"he": "שלח", "en": "Submit"}
    thank_you_message: Dict[str, str]
    rtl: bool = True
    theme: Dict[str, Any] = Field(default_factory=dict)
    field_order: Optional[List[str]] = None


class SurveyCreate(BaseModel):
    """Create a new survey"""
    name: str
    version: int = 1
    schema_json: SurveySchema
    ui_config_json: UIConfig


class SurveyResponse(BaseModel):
    """Survey response from database"""
    id: int
    name: str
    version: int
    is_active: bool
    schema_json: Dict[str, Any]
    ui_config_json: Dict[str, Any]
    created_at: datetime
    
    class Config:
        orm_mode = True


class ResponseSubmit(BaseModel):
    """Submit a survey response"""
    survey_id: int
    data: Dict[str, Any]
    participant_email: Optional[EmailStr] = None
    participant_phone: Optional[str] = None
    participant_name: Optional[str] = None
    locale: str = "he"
    
    @validator('data')
    def validate_data_not_empty(cls, v):
        if not v:
            raise ValueError("Response data cannot be empty")
        return v


class ResponseStatus(str, Enum):
    """Response status"""
    DRAFT = "draft"
    SUBMITTED = "submitted"


class ResponseData(BaseModel):
    """Response data from database"""
    id: int
    participant_id: Optional[int]
    survey_id: int
    status: ResponseStatus
    raw_json: Dict[str, Any]
    created_at: datetime
    
    # Optional related data
    features: Optional[Dict[str, Any]] = None
    participant: Optional[Dict[str, Any]] = None
    
    class Config:
        orm_mode = True


class FeatureExtraction(BaseModel):
    """Extracted features for grouping"""
    response_id: int
    numeric_features: Dict[str, float]
    categorical_features: Dict[str, List[str]]  # Normalized and expanded
    age_band: Optional[str] = None
    nlp_features: Optional[Dict[str, Any]] = None

