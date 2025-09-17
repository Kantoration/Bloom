"""Normalization service for survey responses"""

import pandas as pd
from typing import Dict, List, Set, Any, Optional
from app.schemas.survey import FieldDefinition, NormalizationConfig


# Default flexible answers that match with all concrete options
DEFAULT_FLEXIBLE_ANSWERS = {
    "לא משנה לי", "גם וגם", "אין", "לא חשוב", 
    "שילוב", "בין לבין", "לא משנה", "כל האפשרויות",
    "אין העדפה", "לא רלוונטי", "לא חשוב לי", "בלי העדפה"
}


class NormalizationService:
    """Service for normalizing and expanding survey responses"""
    
    def __init__(self, policy_normalization: Optional[Dict[str, Any]] = None):
        """
        Initialize normalization service
        
        Args:
            policy_normalization: Normalization configuration from policy
        """
        self.flexible_answers = set(
            policy_normalization.get("flexible_answers", [])
            if policy_normalization
            else DEFAULT_FLEXIBLE_ANSWERS
        )
        self.normalization_rules = {}
    
    def build_normalization_rules(self, fields: List[FieldDefinition]) -> None:
        """
        Build normalization rules from field definitions
        
        Args:
            fields: List of field definitions from survey schema
        """
        for field in fields:
            if not field.normalization:
                continue
            
            # Store normalization config for each field
            self.normalization_rules[field.name] = {
                "wildcards": set(field.normalization.wildcards),
                "expansion": set(field.normalization.expansion),
                "synonyms": field.normalization.synonyms,
                "options": set(field.options) if field.options else set()
            }
    
    def normalize_answer(self, value: Any, field_name: str) -> Set[str]:
        """
        Normalize a single answer with wildcard expansion
        
        Args:
            value: The answer value
            field_name: Name of the field being normalized
            
        Returns:
            Set of normalized values
        """
        if pd.isna(value) or value == "" or value is None:
            return set()
        
        value_str = str(value).strip()
        
        # Check if field has normalization rules
        if field_name not in self.normalization_rules:
            return {value_str}
        
        rules = self.normalization_rules[field_name]
        
        # Apply synonyms
        if value_str in rules["synonyms"]:
            value_str = rules["synonyms"][value_str]
        
        # Check if it's a wildcard
        if value_str in rules["wildcards"] or value_str in self.flexible_answers:
            # Expand to all options or specified expansion
            if rules["expansion"]:
                return rules["expansion"]
            elif rules["options"]:
                return rules["options"]
            else:
                # If no expansion defined, return original
                return {value_str}
        
        return {value_str}
    
    def normalize_multi_answer(self, value: Any, field_name: str) -> Set[str]:
        """
        Normalize a multi-choice answer (comma-separated or list)
        
        Args:
            value: The answer value (string or list)
            field_name: Name of the field being normalized
            
        Returns:
            Set of normalized values
        """
        if pd.isna(value) or value == "" or value is None:
            return set()
        
        # Handle both string and list inputs
        if isinstance(value, list):
            parts = [str(v).strip() for v in value if v]
        else:
            parts = [p.strip() for p in str(value).split(",") if p.strip()]
        
        # Normalize each part and combine
        result = set()
        for part in parts:
            result.update(self.normalize_answer(part, field_name))
        
        return result
    
    def extract_features(
        self,
        response_data: Dict[str, Any],
        fields: List[FieldDefinition],
        age_rules: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Extract features from response data for grouping algorithm
        
        Args:
            response_data: Raw response data
            fields: Field definitions from survey schema
            age_rules: Age band configuration
            
        Returns:
            Dictionary with numeric_features, categorical_features, age_band, etc.
        """
        numeric_features = {}
        categorical_features = {}
        age_band = None
        
        for field in fields:
            field_value = response_data.get(field.name)
            
            if field_value is None:
                continue
            
            # Handle different field types
            if field.type in ["scale", "number"]:
                # Numeric features
                try:
                    numeric_value = float(field_value)
                    numeric_features[field.name] = numeric_value
                    
                    # Check if this is the age field
                    if age_rules and field.name == age_rules.get("field"):
                        age_band = self._compute_age_band(numeric_value, age_rules["bands"])
                        
                except (ValueError, TypeError):
                    pass  # Skip invalid numeric values
                    
            elif field.type == "single_select":
                # Single-select categorical
                normalized = self.normalize_answer(field_value, field.name)
                if normalized:
                    categorical_features[field.name] = list(normalized)
                    
            elif field.type == "multi_select":
                # Multi-select categorical
                normalized = self.normalize_multi_answer(field_value, field.name)
                if normalized:
                    categorical_features[field.name] = list(normalized)
                    
            elif field.type in ["text", "email", "phone"]:
                # Text features (may be used for NLP later)
                categorical_features[field.name] = [str(field_value).strip()]
        
        return {
            "numeric": numeric_features,
            "categorical": categorical_features,
            "age_band": age_band,
            "nlp_features": {}  # Placeholder for future NLP features
        }
    
    def _compute_age_band(self, age: float, bands: List[Dict[str, Any]]) -> Optional[str]:
        """
        Compute age band for a given age
        
        Args:
            age: The age value
            bands: List of age band configurations
            
        Returns:
            Age band name or None
        """
        for band in bands:
            if band["min"] <= age <= band["max"]:
                return band["name"]
        return None
    
    def canonicalize_text(self, text: str) -> str:
        """
        Canonicalize text (trim, fix RTL spaces, normalize casing)
        
        Args:
            text: Input text
            
        Returns:
            Canonicalized text
        """
        if not text:
            return ""
        
        # Trim and normalize spaces
        text = " ".join(text.split())
        
        # Fix RTL/LTR marks
        text = text.replace("\u200e", "").replace("\u200f", "")
        
        return text
    
    def validate_expanded_values(
        self,
        expanded_values: Set[str],
        field_options: List[str],
        field_name: str
    ) -> bool:
        """
        Validate that expanded values are subset of field options
        
        Args:
            expanded_values: Set of expanded values
            field_options: List of valid options for the field
            field_name: Name of field for error reporting
            
        Returns:
            True if valid, False otherwise
        """
        if not field_options:
            return True  # No options to validate against
        
        valid_options = set(field_options)
        if not expanded_values.issubset(valid_options):
            invalid = expanded_values - valid_options
            print(f"Warning: Invalid expanded values for {field_name}: {invalid}")
            return False
        
        return True


def create_normalization_service(
    survey_schema: Dict[str, Any],
    policy: Optional[Dict[str, Any]] = None
) -> NormalizationService:
    """
    Factory function to create normalization service
    
    Args:
        survey_schema: Survey schema with field definitions
        policy: Grouping policy with normalization settings
        
    Returns:
        Configured normalization service
    """
    from app.schemas.survey import SurveySchema
    
    # Parse schema
    schema = SurveySchema(**survey_schema)
    
    # Get normalization config from policy
    normalization_config = policy.get("normalization") if policy else None
    
    # Create service
    service = NormalizationService(normalization_config)
    
    # Build rules from schema
    service.build_normalization_rules(schema.fields)
    
    return service

