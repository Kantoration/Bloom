"""Validation service for survey responses"""

from typing import Dict, Any, List, Optional
from app.schemas.survey import SurveySchema, FieldDefinition, FieldType


def validate_response(
    response_data: Dict[str, Any],
    survey_schema: SurveySchema
) -> List[Dict[str, str]]:
    """
    Validate response data against survey schema
    
    Args:
        response_data: The response data to validate
        survey_schema: The survey schema to validate against
        
    Returns:
        List of validation errors (empty if valid)
    """
    errors = []
    
    for field in survey_schema.fields:
        field_value = response_data.get(field.name)
        
        # Check required fields
        if field.required:
            if field_value is None or field_value == "":
                errors.append({
                    "field": field.name,
                    "error": "This field is required"
                })
                continue
        
        # Skip validation if field is empty and not required
        if field_value is None or field_value == "":
            continue
        
        # Validate based on field type
        if field.type == FieldType.EMAIL:
            if not is_valid_email(str(field_value)):
                errors.append({
                    "field": field.name,
                    "error": "Invalid email format"
                })
        
        elif field.type == FieldType.PHONE:
            if not is_valid_phone(str(field_value)):
                errors.append({
                    "field": field.name,
                    "error": "Invalid phone format"
                })
        
        elif field.type == FieldType.SCALE or field.type == FieldType.NUMBER:
            try:
                num_value = float(field_value)
                if field.min is not None and num_value < field.min:
                    errors.append({
                        "field": field.name,
                        "error": f"Value must be at least {field.min}"
                    })
                if field.max is not None and num_value > field.max:
                    errors.append({
                        "field": field.name,
                        "error": f"Value must be at most {field.max}"
                    })
            except (ValueError, TypeError):
                errors.append({
                    "field": field.name,
                    "error": "Must be a valid number"
                })
        
        elif field.type == FieldType.SINGLE_SELECT:
            if field.options and str(field_value) not in field.options:
                # Check if it's a wildcard/flexible answer
                if not is_flexible_answer(str(field_value), field):
                    errors.append({
                        "field": field.name,
                        "error": f"Invalid option: {field_value}"
                    })
        
        elif field.type == FieldType.MULTI_SELECT:
            if field.options:
                # Parse multi-select value
                if isinstance(field_value, list):
                    values = field_value
                elif isinstance(field_value, str):
                    values = [v.strip() for v in field_value.split(",")]
                else:
                    values = []
                
                # Validate each value
                for value in values:
                    if value and value not in field.options:
                        if not is_flexible_answer(value, field):
                            errors.append({
                                "field": field.name,
                                "error": f"Invalid option: {value}"
                            })
                            break
        
        elif field.type == FieldType.TEXT:
            if field.max_length and len(str(field_value)) > field.max_length:
                errors.append({
                    "field": field.name,
                    "error": f"Text too long (max {field.max_length} characters)"
                })
    
    return errors


def is_valid_email(email: str) -> bool:
    """Check if email format is valid"""
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def is_valid_phone(phone: str) -> bool:
    """Check if phone format is valid (Israeli format)"""
    import re
    # Remove common separators
    phone = phone.replace("-", "").replace(" ", "").replace(".", "")
    # Israeli phone patterns
    patterns = [
        r'^05\d{8}$',  # Mobile
        r'^0[2-9]\d{7,8}$',  # Landline
        r'^\+9725\d{8}$',  # International mobile
        r'^\+972[2-9]\d{7,8}$'  # International landline
    ]
    return any(re.match(pattern, phone) for pattern in patterns)


def is_flexible_answer(value: str, field: FieldDefinition) -> bool:
    """Check if value is a flexible/wildcard answer"""
    if field.normalization and field.normalization.wildcards:
        return value in field.normalization.wildcards
    
    # Check against default flexible answers
    default_flexible = {
        "לא משנה לי", "גם וגם", "אין", "לא חשוב",
        "שילוב", "בין לבין", "לא משנה", "כל האפשרויות",
        "אין העדפה", "לא רלוונטי"
    }
    return value in default_flexible

