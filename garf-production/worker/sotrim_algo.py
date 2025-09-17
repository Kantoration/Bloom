# Copy of the SOTRIM algorithm for worker processes
# Note: In production, this should be symlinked from garf-legacy/sotrim_algo.py
import pandas as pd
import numpy as np
from collections import defaultdict
from itertools import combinations
from typing import List, Dict, Set, Tuple, Optional
import warnings
import time
import json
import os

# Try to import scipy, fallback to numpy if not available
try:
    from scipy.sparse import csr_matrix
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False
    print("Warning: scipy not available, using dense matrices only")

# =========================
# CONFIG LOADER
# =========================
def load_config(config_path: str = "group_formation_config.json") -> Dict:
    """Load configuration from JSON file with fallback to defaults."""
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning: Could not load config from {config_path}: {e}")
    
    # Fallback to hardcoded defaults
    return {
        "algorithm_settings": {
            "group_size": 6,
            "debug_mode": True,
            "validation_enabled": True,
            "use_sparse_matrix": True,
            "use_parallel_processing": False,
            "max_workers": 4,
            "batch_size": 200
        },
        "scoring_weights": {
            "beta_diversity": 1.0,
            "gamma_similarity": 0.2,
            "alpha_constraints": 0.0,
            "categorical_diversity": 0.1,
            "multi_choice_overlap": 0.1,
            "balance_bonus": 0.05
        },
        "constraints": {
            "hard_categorical": {"fields": {}},
            "hard_multi_choice": {"fields": {}},
            "hard_numeric_tolerance": {"fields": {}},
            "soft_categorical": {"fields": {}},
            "soft_multi_choice": {"fields": {}},
            "soft_numeric_fields": {
                "fields": [
                    "אני אדם מופנם", "אני אדם יצירתי", "אני נוטה ללחץ",
                    "חשיבות הומור", "חשיבות רוחניות", "אני אוהב להתאמן",
                    "נהנה יותר בעיר/טבע", "נהנה משיח פוליטי"
                ]
            },
            "age_constraints": {
                "field": "גיל",
                "tolerance": 10
            }
        },
        "normalization": {
            "flexible_answers": [
                "לא משנה לי", "גם וגם", "אין", "לא חשוב", "שילוב", "בין לבין",
                "לא משנה", "כל האפשרויות", "אין העדפה", "לא רלוונטי"
            ]
        },
        "scalability": {
            "batch_processing_threshold": 500,
            "graph_clustering_threshold": 1000,
            "enable_community_detection": False
        },
        "explainability": {
            "log_constraint_details": True,
            "log_scoring_breakdown": True,
            "export_debug_info": True
        }
    }

# Load global config
CONFIG = load_config()

# =========================
# NORMALIZATION RULES FOR FLEXIBLE ANSWERS
# =========================
# Flexible answers that should match with all concrete options
FLEXIBLE_ANSWERS = set(CONFIG["normalization"]["flexible_answers"])

# Normalization rules per column - maps flexible answers to all valid concrete options
NORMALIZATION_RULES = {}

def build_normalization_rules(df: pd.DataFrame):
    """Build normalization rules by analyzing all unique values in each column."""
    global NORMALIZATION_RULES
    
    for col in df.columns:
        if col in ["Email", "שם מלא", "מספר טלפון"]:  # Skip non-survey columns
            continue
            
        unique_values = set(df[col].dropna().astype(str))
        
        # Separate flexible and concrete answers
        flexible_in_col = unique_values.intersection(FLEXIBLE_ANSWERS)
        concrete_in_col = unique_values - flexible_in_col
        
        if flexible_in_col and concrete_in_col:
            # Map each flexible answer to all concrete answers in this column
            NORMALIZATION_RULES[col] = {
                flexible: concrete_in_col 
                for flexible in flexible_in_col
            }
            debug_print(f"Normalization for '{col}': {len(flexible_in_col)} flexible → {len(concrete_in_col)} concrete")
        elif flexible_in_col:
            # If only flexible answers exist, map them to themselves (no normalization needed)
            debug_print(f"Column '{col}' has only flexible answers, no normalization needed")
        else:
            # If no flexible answers, no normalization rules needed
            debug_print(f"Column '{col}' has no flexible answers")

def normalize_answer(answer: str, column: str) -> set:
    """Normalize a single answer using the normalization rules."""
    if column not in NORMALIZATION_RULES:
        return {answer}  # No normalization rules for this column
    
    if answer in NORMALIZATION_RULES[column]:
        # This is a flexible answer - expand to all concrete options
        return NORMALIZATION_RULES[column][answer]
    else:
        # This is a concrete answer - return as is
        return {answer}

def normalize_multi_answer(answer: str, column: str) -> set:
    """Normalize a multi-choice answer (comma-separated)."""
    if pd.isna(answer) or answer == "":
        return set()
    
    # Split by comma and normalize each part
    parts = [part.strip() for part in str(answer).split(",")]
    normalized_parts = set()
    
    for part in parts:
        normalized_parts.update(normalize_answer(part, column))
    
    return normalized_parts

# =========================
# CONFIG
# =========================
# שדות שחותכים תת-מרחבים (categorical)
# FIXED: Remove language constraint to allow cross-language grouping with flexible answers
CUT_CATEGORICAL = CONFIG["constraints"]["hard_categorical"]["fields"]
# ריבוי-בחירה: דורשים חיתוך לא-ריק בין חברי קבוצה
# RELAXED: Made meeting area constraint more flexible
CUT_MULTI = CONFIG["constraints"]["hard_multi_choice"]["fields"]

# שדות חותכים מספריים עם טולרנס קשיח (pairwise)
# TESTING: Remove ALL numeric constraints to test basic functionality
CUT_NUMERIC_TOL = CONFIG["constraints"]["hard_numeric_tolerance"]["fields"]

# מאפיינים (numeric 1–10) לגיוון/איזון (משמשים גם כסף-טולרנס רך)
DEFINE_NUMERIC = CONFIG["constraints"]["soft_numeric_fields"]["fields"]
DEFINE_NUMERIC_SOFT_TOL = 3  # טולרנס "רך" להימנע מקצוות קשים מדי

# Age rules - data-driven configuration
AGE_RULES = CONFIG["constraints"].get("age_rules", None)

GROUP_SIZE = CONFIG["algorithm_settings"]["group_size"]

# Soft constraint fields
SOFT_CATEGORICAL = CONFIG["constraints"]["soft_categorical"]["fields"]
SOFT_MULTI_CHOICE = CONFIG["constraints"]["soft_multi_choice"]["fields"]

# Algorithm settings
DEBUG_MODE = CONFIG["algorithm_settings"]["debug_mode"]
VALIDATE_INPUT = CONFIG["algorithm_settings"]["validation_enabled"]
USE_SPARSE_MATRIX = CONFIG["algorithm_settings"]["use_sparse_matrix"] and SCIPY_AVAILABLE
USE_PARALLEL_PROCESSING = CONFIG["algorithm_settings"]["use_parallel_processing"]
MAX_WORKERS = CONFIG["algorithm_settings"]["max_workers"]
BATCH_SIZE = CONFIG["algorithm_settings"]["batch_size"]
USE_VECTORIZED_CHECKS = True

# Scoring weights
ALPHA_CONSTRAINTS = CONFIG["scoring_weights"]["alpha_constraints"]
BETA_DIVERSITY = CONFIG["scoring_weights"]["beta_diversity"]
GAMMA_SIMILARITY = CONFIG["scoring_weights"]["gamma_similarity"]
CATEGORICAL_DIVERSITY = CONFIG["scoring_weights"]["categorical_diversity"]
MULTI_CHOICE_OVERLAP = CONFIG["scoring_weights"]["multi_choice_overlap"]
BALANCE_BONUS = CONFIG["scoring_weights"]["balance_bonus"]

# Explainability settings
LOG_CONSTRAINT_DETAILS = CONFIG["explainability"]["log_constraint_details"]
LOG_SCORING_BREAKDOWN = CONFIG["explainability"]["log_scoring_breakdown"]
EXPORT_DEBUG_INFO = CONFIG["explainability"]["export_debug_info"]


# =========================
# Validation and Error Handling
# =========================
def validate_config() -> None:
    """Validate configuration parameters."""
    assert GROUP_SIZE > 0, "GROUP_SIZE must be positive"
    assert all(tol > 0 for tol in CUT_NUMERIC_TOL.values()), "Tolerances must be positive"
    assert all(weight >= 0 for weight in [ALPHA_CONSTRAINTS, BETA_DIVERSITY, GAMMA_SIMILARITY]), "Weights must be non-negative"
    
    # Validate age rules if present
    if AGE_RULES:
        assert "field" in AGE_RULES, "Age rules must specify field"
        assert "bands" in AGE_RULES, "Age rules must specify bands"
        assert len(AGE_RULES["bands"]) > 0, "Age rules must have at least one band"
        for band in AGE_RULES["bands"]:
            assert "min" in band and "max" in band, "Each age band must have min and max"
            assert band["min"] <= band["max"], "Age band min must be <= max"
            if "max_spread" in band and band["max_spread"] is not None:
                assert band["max_spread"] >= 0, "Age band max_spread must be non-negative"

def validate_dataframe(df: pd.DataFrame) -> None:
    """Validate that DataFrame has required columns."""
    missing_categorical = [col for col in CUT_CATEGORICAL.keys() if col not in df.columns]
    missing_multi = [col for col in CUT_MULTI.keys() if col not in df.columns]
    missing_numeric = [col for col in CUT_NUMERIC_TOL.keys() if col not in df.columns]
    missing_define = [col for col in DEFINE_NUMERIC if col not in df.columns]
    missing_age = [AGE_RULES["field"]] if AGE_RULES and AGE_RULES["field"] not in df.columns else []
    
    all_missing = missing_categorical + missing_multi + missing_numeric + missing_define + missing_age
    
    if all_missing:
        raise ValueError(f"Missing required columns: {all_missing}")
    
    # Check for empty DataFrame
    if len(df) == 0:
        raise ValueError("DataFrame is empty")
    
    # Check for minimum participants
    if len(df) < GROUP_SIZE:
        warnings.warn(f"Only {len(df)} participants available, but GROUP_SIZE is {GROUP_SIZE}")
    
    # Validate numeric fields
    for col in DEFINE_NUMERIC:
        if col in df.columns:
            # Check if column contains numeric data
            numeric_count = pd.to_numeric(df[col], errors="coerce").notna().sum()
            total_count = len(df[col].dropna())
            if total_count > 0 and numeric_count / total_count < 0.5:  # Less than 50% numeric
                debug_print(f"Warning: Field '{col}' appears to be non-numeric (only {numeric_count}/{total_count} values are numeric)")

def debug_print(message: str) -> None:
    """Print debug message if DEBUG_MODE is enabled."""
    if DEBUG_MODE:
        print(f"[DEBUG] {message}")

# =========================
# Age Band Helper Functions
# =========================
def get_age_band(age: float, age_rules: Dict) -> int:
    """Get the band index for a given age."""
    if not age_rules or pd.isna(age):
        return -1
    
    bands = age_rules["bands"]
    for i, band in enumerate(bands):
        if band["min"] <= age <= band["max"]:
            return i
    return -1

def check_age_compatibility(age1: float, age2: float, age_rules: Dict) -> bool:
    """Check if two ages are compatible based on age rules with overlapping bands."""
    if not age_rules or pd.isna(age1) or pd.isna(age2):
        return False
    
    # Simple max age difference rule (legacy support)
    if "max_age_difference" in age_rules:
        max_diff = age_rules["max_age_difference"]
        return abs(age1 - age2) <= max_diff
    
    # Overlapping band-based rules
    bands = age_rules["bands"]
    
    # Find all bands that each age belongs to
    bands1 = []
    bands2 = []
    
    for i, band in enumerate(bands):
        if band["min"] <= age1 <= band["max"]:
            bands1.append(i)
        if band["min"] <= age2 <= band["max"]:
            bands2.append(i)
    
    # If either age doesn't belong to any band, they're not compatible
    if not bands1 or not bands2:
        return False
    
    # Check if they share any common band
    common_bands = set(bands1).intersection(set(bands2))
    if common_bands:
        # They share at least one band, check max_spread for the most restrictive common band
        min_max_spread = float('inf')
        for band_idx in common_bands:
            max_spread = bands[band_idx].get("max_spread")
            if max_spread is not None:
                min_max_spread = min(min_max_spread, max_spread)
        
        if min_max_spread == float('inf'):
            return True  # No max_spread limit in any common band
        else:
            return abs(age1 - age2) <= min_max_spread
    
    # No common bands - check if cross-band is allowed
    if not age_rules.get("allow_cross_band", False):
        return False
    
    # For cross-band compatibility, use the most permissive max_spread
    max_max_spread = 0
    for band_idx in bands1 + bands2:
        max_spread = bands[band_idx].get("max_spread")
        if max_spread is not None:
            max_max_spread = max(max_max_spread, max_spread)
    
    return abs(age1 - age2) <= max_max_spread

# =========================
# עזר: המרת טקסט ריבוי-בחירה לסט
# =========================
def to_set(val, column: str = None) -> Set[str]:
    """Convert comma-separated string or list to set of strings, with normalization."""
    if pd.isna(val) or val == "":
        return set()
    if isinstance(val, list):
        result = set()
        for v in val:
            if str(v).strip():
                if column:
                    result.update(normalize_answer(str(v).strip(), column))
                else:
                    result.add(str(v).strip())
        return result
    
    # Handle comma-separated strings
    parts = [v.strip() for v in str(val).split(",") if v.strip()]
    if column:
        result = set()
        for part in parts:
            result.update(normalize_answer(part, column))
        return result
    else:
        return set(parts)


# =========================
# בדיקות חותכות בין שני משתתפים
# =========================
def pass_pairwise_cuts(a: Dict, b: Dict, explain: bool = False) -> Tuple[bool, Dict]:
    """Check if two participants pass all pairwise constraints with normalization."""
    result = True
    details = {}
    
    # קטגוריות חד-ערכיות: זהות מלאה (with normalization)
    for col in CUT_CATEGORICAL:
        sa = normalize_answer(str(a.get(col, "")).strip(), col)
        sb = normalize_answer(str(b.get(col, "")).strip(), col)
        passed = not sa.isdisjoint(sb)
        if explain:
            details[f"categorical_{col}"] = {
                "passed": passed,
                "a_value": str(a.get(col, "")),
                "b_value": str(b.get(col, "")),
                "a_normalized": list(sa),
                "b_normalized": list(sb)
            }
        if not passed:
            result = False

    # ריבוי-בחירה: חיתוך לא-ריק (with normalization)
    for col in CUT_MULTI:
        A, B = to_set(a.get(col, ""), col), to_set(b.get(col, ""), col)
        passed = len(A.intersection(B)) > 0
        if explain:
            details[f"multi_choice_{col}"] = {
                "passed": passed,
                "a_value": str(a.get(col, "")),
                "b_value": str(b.get(col, "")),
                "a_set": list(A),
                "b_set": list(B),
                "intersection": list(A.intersection(B))
            }
        if not passed:
            result = False

    # מספריים עם טולרנס
    for col, tol in CUT_NUMERIC_TOL.items():
        va, vb = a.get(col, np.nan), b.get(col, np.nan)
        if pd.isna(va) or pd.isna(vb):
            passed = False
            if explain:
                details[f"numeric_{col}"] = {
                    "passed": False,
                    "reason": "missing_values",
                    "a_value": va,
                    "b_value": vb
                }
            result = False
        else:
            try:
                diff = abs(float(va) - float(vb))
                passed = diff <= tol
                if explain:
                    details[f"numeric_{col}"] = {
                        "passed": passed,
                        "a_value": float(va),
                        "b_value": float(vb),
                        "difference": diff,
                        "tolerance": tol
                    }
                if not passed:
                    result = False
            except (ValueError, TypeError):
                if explain:
                    details[f"numeric_{col}"] = {
                        "passed": False,
                        "reason": "invalid_values",
                        "a_value": va,
                        "b_value": vb
                    }
                debug_print(f"Invalid numeric values for {col}: {va}, {vb}")
                result = False

    return result, details if explain else {}


# =========================
# Performance Optimization: Vectorized Compatibility Matrix
# =========================
def build_compatibility_matrix_vectorized(df: pd.DataFrame, indices: List[int] = None) -> np.ndarray:
    """Build compatibility matrix using vectorized operations for better performance."""
    if indices is None:
        indices = list(range(len(df)))
    
    n = len(indices)
    if n == 0:
        return np.array([], dtype=bool).reshape(0, 0)
    
    debug_print(f"Building vectorized compatibility matrix for {n} participants...")
    start_time = time.time()
    
    # Initialize matrix - START WITH ALL TRUE, then apply constraints
    if USE_SPARSE_MATRIX and SCIPY_AVAILABLE:
        compat = csr_matrix(np.ones((n, n), dtype=bool))
    else:
        compat = np.ones((n, n), dtype=bool)  # Start with all compatible
    
    # Extract data for vectorized operations
    df_subset = df.iloc[indices]
    
    # Vectorized categorical checks (with normalization)
    for col in CUT_CATEGORICAL:
        if col in df_subset.columns:
            # Apply normalization to each value
            normalized_values = []
            for val in df_subset[col]:
                normalized_set = normalize_answer(str(val).strip(), col)
                normalized_values.append(normalized_set)
            
            # Create compatibility matrix based on set intersection
            compat_cat = np.zeros((n, n), dtype=bool)
            for i in range(n):
                for j in range(n):
                    if not normalized_values[i].isdisjoint(normalized_values[j]):
                        compat_cat[i, j] = True
            
            if USE_SPARSE_MATRIX and SCIPY_AVAILABLE:
                compat_cat = csr_matrix(compat_cat)
                compat = compat.multiply(compat_cat)
            else:
                compat = compat & compat_cat
    
    # Vectorized multi-choice checks (with normalization)
    for col in CUT_MULTI:
        if col in df_subset.columns:
            sets_list = [to_set(val, col) for val in df_subset[col]]
            # Create compatibility matrix for multi-choice
            compat_multi = np.zeros((n, n), dtype=bool)
            for i in range(n):
                for j in range(i+1, n):
                    if len(sets_list[i].intersection(sets_list[j])) > 0:
                        compat_multi[i, j] = compat_multi[j, i] = True
            compat_multi[np.diag_indices(n)] = True  # Self-compatible
            
            if USE_SPARSE_MATRIX and SCIPY_AVAILABLE:
                compat_multi = csr_matrix(compat_multi)
                compat = compat.multiply(compat_multi)
            else:
                compat = compat & compat_multi
    
    # Vectorized age band checks
    if AGE_RULES and AGE_RULES["field"] in df_subset.columns:
        try:
            ages = pd.to_numeric(df_subset[AGE_RULES["field"]], errors='coerce')
            valid_mask = ~ages.isna()
            
            if valid_mask.sum() < n:
                debug_print(f"Warning: {AGE_RULES['field']} has {n - valid_mask.sum()} missing values")
            
            # Vectorized age compatibility check
            ages_array = ages.values
            compat_age = np.zeros((n, n), dtype=bool)
            
            for i in range(n):
                for j in range(n):
                    if i == j:
                        compat_age[i, j] = True  # Self-compatible
                    elif not (np.isnan(ages_array[i]) or np.isnan(ages_array[j])):
                        compat_age[i, j] = check_age_compatibility(ages_array[i], ages_array[j], AGE_RULES)
            
            if USE_SPARSE_MATRIX and SCIPY_AVAILABLE:
                compat_age = csr_matrix(compat_age)
                compat = compat.multiply(compat_age)
            else:
                compat = compat & compat_age
                
            debug_print(f"Age band compatibility applied: {AGE_RULES['field']}")
            
        except Exception as e:
            debug_print(f"Error in vectorized age check: {e}")
    
    # Vectorized numeric tolerance checks
    for col, tol in CUT_NUMERIC_TOL.items():
        if col in df_subset.columns:
            try:
                values = pd.to_numeric(df_subset[col], errors='coerce')
                valid_mask = ~values.isna()
                
                if valid_mask.sum() < n:
                    debug_print(f"Warning: {col} has {n - valid_mask.sum()} missing values")
                
                # Vectorized tolerance check
                values_array = values.values
                diff_matrix = np.abs(np.subtract.outer(values_array, values_array))
                compat_numeric = diff_matrix <= tol
                compat_numeric[np.diag_indices(n)] = True  # Self-compatible
                
                # Handle NaN values
                nan_mask = np.isnan(values_array)
                compat_numeric[nan_mask, :] = False
                compat_numeric[:, nan_mask] = False
                compat_numeric[np.diag_indices(n)] = True  # Re-enable self-compatibility
                
                if USE_SPARSE_MATRIX and SCIPY_AVAILABLE:
                    compat_numeric = csr_matrix(compat_numeric)
                    compat = compat.multiply(compat_numeric)
                else:
                    compat = compat & compat_numeric
                
            except Exception as e:
                debug_print(f"Error in vectorized numeric check for {col}: {e}")
                # Fallback to individual checks
                for i in range(n):
                    for j in range(i+1, n):
                        if pass_pairwise_cuts(df_subset.iloc[i], df_subset.iloc[j]):
                            compat[i, j] = compat[j, i] = True
    
    # Ensure diagonal is True (self-compatible)
    if USE_SPARSE_MATRIX and SCIPY_AVAILABLE:
        compat.setdiag(True)
    else:
        compat[np.diag_indices(n)] = True
    
    elapsed = time.time() - start_time
    total_pairs = n * (n - 1) // 2
    compatible_pairs = (compat.sum() - n) // 2  # Subtract diagonal and divide by 2 (symmetric matrix)
    
    debug_print(f"Vectorized compatibility matrix built in {elapsed:.3f}s")
    debug_print(f"Compatible pairs: {compatible_pairs}/{total_pairs} ({compatible_pairs/total_pairs*100:.1f}%)")
    
    return compat

def build_compatibility_matrix_per_subspace(df: pd.DataFrame, subspace_indices: List[int]) -> np.ndarray:
    """Build compatibility matrix only for participants in the same subspace."""
    return build_compatibility_matrix_vectorized(df, subspace_indices)

def get_compatible_pairs_optimized(compat_matrix, candidates: List[int]) -> Dict[int, List[int]]:
    """Get list of compatible participants for each candidate using optimized matrix operations."""
    compatible = {}
    
    if USE_SPARSE_MATRIX and SCIPY_AVAILABLE:
        # For sparse matrices, use efficient row operations
        for i, cand in enumerate(candidates):
            if cand < compat_matrix.shape[0]:
                # Get row of compatibility matrix
                row = compat_matrix[cand, :].toarray().flatten()
                compatible[cand] = [candidates[j] for j in range(len(candidates)) 
                                   if j != i and j < len(row) and row[j]]
    else:
        # For dense matrices
        for i, cand in enumerate(candidates):
            if cand < compat_matrix.shape[0]:
                compatible[cand] = [candidates[j] for j in range(len(candidates)) 
                                   if j != i and compat_matrix[cand, candidates[j]]]
    
    return compatible

# =========================
# פילוח ראשוני לתת-מרחבים לפי הקטגוריות החותכות
# =========================
def subspace_key(row):
    key = []
    for col in CUT_CATEGORICAL:
        key.append((col, str(row.get(col, "")).strip()))
    # לריבוי-בחירה אין “ערך מפתח” אחד – נשאיר לפילטר pairwise בהמשך
    return tuple(key)


def partition_into_subspaces(df):
    buckets = defaultdict(list)
    for idx, row in df.iterrows():
        buckets[subspace_key(row)].append(idx)
    return buckets  # dict: key -> list of row indices


# =========================
# Caching for Repeated Computations
# =========================
_score_cache = {}
_feature_cache = {}

def get_cached_features(df_group: pd.DataFrame, indices: List[int]) -> np.ndarray:
    """Get cached feature vectors for participants."""
    cache_key = tuple(sorted(indices))
    if cache_key in _feature_cache:
        return _feature_cache[cache_key]
    
    # Extract features for DEFINE_NUMERIC columns using vectorized operations
    try:
        # Create a matrix of NaN values first
        features_array = np.full((len(df_group), len(DEFINE_NUMERIC)), np.nan)
        
        # Fill in numeric values where possible
        for i, col in enumerate(DEFINE_NUMERIC):
            if col in df_group.columns:
                # Use pandas to_numeric with errors='coerce' for safe conversion
                numeric_values = pd.to_numeric(df_group[col], errors='coerce')
                features_array[:, i] = numeric_values.values
        
        _feature_cache[cache_key] = features_array
        return features_array
        
    except Exception as e:
        debug_print(f"Error in get_cached_features: {e}")
        # Return array of NaNs with correct shape
        features_array = np.full((len(df_group), len(DEFINE_NUMERIC)), np.nan)
        _feature_cache[cache_key] = features_array
        return features_array

def clear_caches():
    """Clear all caches to free memory."""
    global _score_cache, _feature_cache
    _score_cache.clear()
    _feature_cache.clear()

# =========================
# ציון איכות לקבוצה (גבוה יותר = עדיף) - OPTIMIZED
# =========================
def group_score(df_group: pd.DataFrame, explain: bool = False) -> Tuple[float, Dict]:
    """Calculate group quality score with caching and optional explanation."""
    if df_group.empty:
        return -1e9, {"error": "empty_group"}

    # Use cached features if available
    indices = df_group.index.tolist()
    cache_key = tuple(sorted(indices))
    
    if cache_key in _score_cache and not explain:
        return _score_cache[cache_key], {}

    # גיוון: ממוצע variance על DEFINE_NUMERIC (ככל שגבוה – מגוון יותר)
    div_vars = []
    field_variances = {}
    for col in DEFINE_NUMERIC:
        if col in df_group:
            # Use errors="coerce" to handle non-numeric values gracefully
            vals = pd.to_numeric(df_group[col], errors="coerce").dropna()
            if len(vals) > 1:
                var_val = vals.var()
                div_vars.append(var_val)
                if explain:
                    field_variances[col] = {
                        "variance": var_val,
                        "mean": vals.mean(),
                        "std": vals.std(),
                        "min": vals.min(),
                        "max": vals.max()
                    }
    diversity = np.mean(div_vars) if div_vars else 0.0

    # "דמיון" עדין: נמדוד מרחק ממוצע על DEFINE_NUMERIC ונקח הופכי קטן (לעודד מעט קירוב)
    sim_bonus = 0.0
    distance_details = {}
    if len(df_group) >= 2 and div_vars:
        try:
            # Use cached features
            X = get_cached_features(df_group, indices)
        except Exception as e:
            debug_print(f"Error getting cached features: {e}")
            sim_bonus = 0.0
            if explain:
                distance_details = {"error": "feature_extraction_failed"}
            X = None
        
        if X is not None:
            try:
                # נורמליזציה עמודתית - handle all-NaN columns
                col_min = np.nanmin(X, axis=0)
                col_max = np.nanmax(X, axis=0)
                
                # Check for all-NaN columns and skip them
                valid_cols = ~(np.isnan(col_min) & np.isnan(col_max))
                if not np.any(valid_cols):
                    # All columns are NaN, skip similarity calculation
                    sim_bonus = 0.0
                    if explain:
                        distance_details = {"error": "all_columns_nan"}
                else:
                    # Only use valid columns
                    X_valid = X[:, valid_cols]
                    col_min_valid = col_min[valid_cols]
                    col_max_valid = col_max[valid_cols]
                    
                    denom = (col_max_valid - col_min_valid)
                    denom[denom == 0] = 1.0
                    Xn = (X_valid - col_min_valid) / denom

                    # מרחק ממוצע בין כל הזוגות - VECTORIZED
                    if len(Xn) >= 2:
                        # Use vectorized distance calculation
                        valid_pairs = []
                        pair_distances = []
                        for i, j in combinations(range(len(Xn)), 2):
                            if not (np.any(np.isnan(Xn[i])) or np.any(np.isnan(Xn[j]))):
                                d = np.linalg.norm(Xn[i] - Xn[j])
                                valid_pairs.append(d)
                                if explain:
                                    pair_distances.append({
                                        "pair": (indices[i], indices[j]),
                                        "distance": d
                                    })
                        
                        if valid_pairs:
                            mean_dist = float(np.mean(valid_pairs))
                            sim_bonus = 1.0 / (1.0 + mean_dist)
                            if explain:
                                distance_details = {
                                    "mean_distance": mean_dist,
                                    "similarity_bonus": sim_bonus,
                                    "pair_distances": pair_distances
                                }
            except Exception as e:
                debug_print(f"Error in similarity calculation: {e}")
                sim_bonus = 0.0
                if explain:
                    distance_details = {"error": "similarity_calculation_failed"}

    # Soft categorical diversity scoring
    categorical_diversity_score = 0.0
    categorical_details = {}
    if SOFT_CATEGORICAL:
        for col, scoring_type in SOFT_CATEGORICAL.items():
            if col in df_group:
                values = df_group[col].astype(str).str.strip()
                unique_values = values.nunique()
                
                if scoring_type == "diversity":
                    # Reward diversity (more unique values = higher score)
                    diversity_bonus = unique_values / len(df_group)  # 0-1 scale
                    categorical_diversity_score += diversity_bonus
                    
                elif scoring_type == "balance":
                    # Reward balanced distribution (avoid all same, avoid all different)
                    value_counts = values.value_counts()
                    if len(value_counts) > 1:
                        # Calculate balance: prefer 2-3 different values over all same or all different
                        balance_score = min(1.0, len(value_counts) / 3.0)  # Peak at 3 different values
                        categorical_diversity_score += balance_score
                
                if explain:
                    categorical_details[col] = {
                        "scoring_type": scoring_type,
                        "unique_values": unique_values,
                        "value_distribution": value_counts.to_dict(),
                        "contribution": diversity_bonus if scoring_type == "diversity" else balance_score
                    }
    
    # Soft multi-choice overlap scoring
    multi_choice_overlap_score = 0.0
    multi_choice_details = {}
    if SOFT_MULTI_CHOICE:
        for col, scoring_type in SOFT_MULTI_CHOICE.items():
            if col in df_group and scoring_type == "overlap_bonus":
                # Calculate average overlap between all pairs
                sets_list = [to_set(val, col) for val in df_group[col]]
                total_overlap = 0
                pair_count = 0
                
                for i, j in combinations(range(len(sets_list)), 2):
                    intersection_size = len(sets_list[i].intersection(sets_list[j]))
                    union_size = len(sets_list[i].union(sets_list[j]))
                    if union_size > 0:
                        overlap_ratio = intersection_size / union_size
                        total_overlap += overlap_ratio
                        pair_count += 1
                
                if pair_count > 0:
                    avg_overlap = total_overlap / pair_count
                    multi_choice_overlap_score += avg_overlap
                    
                    if explain:
                        multi_choice_details[col] = {
                            "average_overlap": avg_overlap,
                            "total_pairs": pair_count,
                            "contribution": avg_overlap
                        }

    # ציון סופי
    score = (BETA_DIVERSITY * diversity + 
             GAMMA_SIMILARITY * sim_bonus +
             CATEGORICAL_DIVERSITY * categorical_diversity_score +
             MULTI_CHOICE_OVERLAP * multi_choice_overlap_score)
    
    # Cache the result
    _score_cache[cache_key] = score
    
    if explain:
        explanation = {
            "diversity_score": diversity,
            "similarity_bonus": sim_bonus,
            "categorical_diversity_score": categorical_diversity_score,
            "multi_choice_overlap_score": multi_choice_overlap_score,
            "final_score": score,
            "field_variances": field_variances,
            "distance_details": distance_details,
            "categorical_details": categorical_details,
            "multi_choice_details": multi_choice_details,
            "weights": {
                "beta_diversity": BETA_DIVERSITY,
                "gamma_similarity": GAMMA_SIMILARITY,
                "categorical_diversity": CATEGORICAL_DIVERSITY,
                "multi_choice_overlap": MULTI_CHOICE_OVERLAP
            }
        }
        return score, explanation
    
    return score, {}


# =========================
# בדיקות קבוצתיות (light sanity check for age bands)
# =========================
def pass_group_constraints(df_group):
    """Group-level constraints including age spread limits."""
    if AGE_RULES and AGE_RULES["field"] in df_group.columns:
        ages = pd.to_numeric(df_group[AGE_RULES["field"]], errors="coerce").values
        if np.isnan(ages).any():
            return False
        
        # Check group-level age constraints
        group_constraints = AGE_RULES.get("group_constraints", {})
        
        # Maximum age difference constraint
        max_age_diff = group_constraints.get("max_age_difference")
        if max_age_diff is not None:
            age_range = np.max(ages) - np.min(ages)
            if age_range > max_age_diff:
                debug_print(f"Group rejected: age range {age_range:.1f} > max {max_age_diff}")
                return False
        
        # Maximum age standard deviation constraint
        max_age_std = group_constraints.get("max_age_std")
        if max_age_std is not None:
            age_std = np.std(ages)
            if age_std > max_age_std:
                debug_print(f"Group rejected: age std {age_std:.1f} > max {max_age_std}")
                return False
        
        # Legacy band-based check (optional)
        bands = AGE_RULES.get("bands", [])
        if bands:
            def band_id(a):
                for i, b in enumerate(bands):
                    if b["min"] <= a <= b["max"]:
                        return i
                return -1
            
            group_bands = np.array([band_id(a) for a in ages])
            if not AGE_RULES.get("allow_cross_band", False) and len(set(group_bands)) > 1:
                return False
    
    return True


# =========================
# בניית קבוצה גרידית מתוך מועמדים: seed -> add best feasible
# =========================
def build_one_group_optimized(df: pd.DataFrame, candidates: List[int], compat_matrix, local_indices: List[int]) -> List[int]:
    """מחזיר אינדקסים גלובליים של קבוצה אחת (עד 6) או ריק אם לא ניתן - OPTIMIZED."""
    if not candidates or not local_indices:
        return []

    debug_print(f"Building optimized group from {len(candidates)} candidates")
    
    # Create mapping between local and global indices
    local_to_global = {local_idx: candidates[i] for i, local_idx in enumerate(local_indices)}
    global_to_local = {global_idx: local_idx for local_idx, global_idx in local_to_global.items()}

    # בחר seed "קשה" – מי שיש לו הכי פחות התאמות pairwise (מצמצם כשל בהמשך)
    # OPTIMIZED: Use pre-computed compatibility matrix with local indices
    compat_counts = {}
    for i, local_idx in enumerate(local_indices):
        global_idx = candidates[i]
        if USE_SPARSE_MATRIX and SCIPY_AVAILABLE:
            # For sparse matrices
            row = compat_matrix[local_idx, :].toarray().flatten()
            compat_counts[global_idx] = sum(row[j] for j in local_indices if j != local_idx)
        else:
            # For dense matrices
            compat_counts[global_idx] = sum(compat_matrix[local_idx, j] for j in local_indices if j != local_idx)
    
    seed_global = min(compat_counts, key=compat_counts.get)
    debug_print(f"Selected seed: {seed_global} with {compat_counts[seed_global]} compatible candidates")

    group_global = [seed_global]
    remaining_global = set(candidates) - {seed_global}

    while len(group_global) < GROUP_SIZE and remaining_global:
        feasibles_global = []
        
        for global_idx in list(remaining_global):
            local_idx = global_to_local[global_idx]
            
            # OPTIMIZED: Use pre-computed compatibility matrix (all local indices)
            group_local = [global_to_local[g] for g in group_global]
            ok = all(compat_matrix[local_idx, g_local] for g_local in group_local)
            
            if not ok:
                continue
                
            # בדיקה קבוצתית מוקדמת (כולל גיל) - use global indices for DataFrame
            df_try = df.loc[group_global + [global_idx]]
            if not pass_group_constraints(df_try):
                continue
                
            feasibles_global.append(global_idx)

        if not feasibles_global:
            debug_print(f"No feasible candidates found, stopping at group size {len(group_global)}")
            break

        # בוחרים את המועמד שנותן את הציון הטוב ביותר לקבוצה
        best_cand_global = None
        best_score = -1e9
        
        for global_idx in feasibles_global:
            score, _ = group_score(df.loc[group_global + [global_idx]])
            if score > best_score:
                best_score = score
                best_cand_global = global_idx

        group_global.append(best_cand_global)
        remaining_global.remove(best_cand_global)
        debug_print(f"Added candidate {best_cand_global} to group (score: {best_score:.3f})")

    # Allow smaller groups with priority: 6 → 5 → 4 (minimum)
    min_group_size = 4
    result = group_global if len(group_global) >= min_group_size else []
    debug_print(f"Final group size: {len(result)} (target: {GROUP_SIZE}, minimum: {min_group_size})")
    return result


# =========================
# אלגוריתם ראשי: מחלק לתת-מרחבים ובכל אחד מרכיב קבוצות
# =========================
def make_groups(df: pd.DataFrame) -> List[List[int]]:
    """Main algorithm: partition into subspaces and build groups in each - OPTIMIZED."""
    # Validate input
    if VALIDATE_INPUT:
        validate_config()
        validate_dataframe(df)
    
    debug_print(f"Starting OPTIMIZED group formation for {len(df)} participants")
    start_time = time.time()
    
    # Clear caches for fresh run
    clear_caches()
    
    subspaces = partition_into_subspaces(df)
    debug_print(f"Created {len(subspaces)} subspaces")
    
    all_groups = []
    used = set()

    for key, idxs in subspaces.items():
        debug_print(f"Processing subspace {key} with {len(idxs)} participants")
        
        # Pre-filter: remove already used participants
        pool = [i for i in idxs if i not in used]
        debug_print(f"Available candidates in subspace: {len(pool)}")
        
        min_group_size = 4
        if len(pool) < min_group_size:
            debug_print(f"Not enough candidates in subspace for any group (need at least {min_group_size})")
            continue
        
        # OPTIMIZATION: Build compatibility matrix only for this subspace
        compat_matrix = build_compatibility_matrix_per_subspace(df, pool)
        
        group_count = 0
        while True:
            # נסה לבנות קבוצה מתוך המאגר
            available_candidates = [i for i in pool if i not in used]
            if len(available_candidates) < min_group_size:
                debug_print(f"Not enough candidates ({len(available_candidates)}) for minimum group size ({min_group_size})")
                break
                
            # Map global indices to local subspace indices for compatibility matrix
            local_indices = [pool.index(idx) for idx in available_candidates]
            group = build_one_group_optimized(df, available_candidates, compat_matrix, local_indices)
            
            if not group:
                debug_print("No more groups can be formed in this subspace")
                break
            
            # group is already in global indices now
                
            all_groups.append(group)
            used.update(group)
            group_count += 1
            debug_print(f"Formed group {group_count} with participants: {group}")
            
            # Update pool
            pool = [i for i in pool if i not in used]

    elapsed = time.time() - start_time
    debug_print(f"Algorithm completed in {elapsed:.3f}s")
    debug_print(f"Total groups formed: {len(all_groups)}")
    debug_print(f"Total participants used: {len(used)} out of {len(df)}")

    return all_groups


# =========================
# דוגמת שימוש
# =========================
if __name__ == "__main__":
    try:
        print("=== SOTRIM GROUP FORMATION ALGORITHM ===")
        print(f"Target group size: {GROUP_SIZE}")
        print(f"Debug mode: {DEBUG_MODE}")
        print(f"Validation enabled: {VALIDATE_INPUT}")
        print()
        
        # קריאה ל-CSV שכבר יצרת בסימולציה
        print("Loading data from synthetic_survey_responses.csv...")
        df = pd.read_csv("synthetic_survey_responses.csv")

        # Build normalization rules for flexible answers
        build_normalization_rules(df)
        
        print(f"Loaded {len(df)} participants with {len(df.columns)} fields")
        
        # Show sample of data
        if DEBUG_MODE:
            print("\nSample data:")
            print(df[["שם מלא", "גיל", "שפת המפגש", "טווח תקציב"]].head(3))
            print()
        
        # Run the algorithm
        print("Starting group formation algorithm...")
        groups = make_groups(df)

        print(f"\n=== RESULTS ===")
        print(f"נוצרו {len(groups)} קבוצות:")
        
        # Show group size distribution
        group_sizes = [len(g) for g in groups]
        size_counts = {}
        for size in group_sizes:
            size_counts[size] = size_counts.get(size, 0) + 1
        
        size_summary = ", ".join([f"{count} קבוצות של {size}" for size, count in sorted(size_counts.items())])
        print(f"חלוקת גדלים: {size_summary}")
        
        # Create detailed results for CSV export
        group_results = []
        
        if groups:
            for k, g in enumerate(groups, 1):
                names = df.loc[g]["שם מלא"].tolist() if "שם מלא" in df else g
                ages = df.loc[g]["גיל"].tolist() if "גיל" in df else []
                emails = df.loc[g]["Email"].tolist() if "Email" in df else []
                
                # Calculate group score
                group_score_val, _ = group_score(df.loc[g])
                
                # Calculate age statistics
                age_mean = np.mean(ages) if ages else 0
                age_std = np.std(ages) if ages else 0
                
                print(f"  קבוצה {k}: {names}")
                if ages and DEBUG_MODE:
                    print(f"    גילאים: {ages} (ממוצע: {age_mean:.1f})")
                print(f"    ציון קבוצה: {group_score_val:.3f}")
                
                # Store detailed group information
                group_info = {
                    'group_id': k,
                    'participants': ', '.join(names),
                    'emails': ', '.join(emails),
                    'ages': ', '.join(map(str, ages)),
                    'age_mean': round(age_mean, 1),
                    'age_std': round(age_std, 1),
                    'group_score': round(group_score_val, 3),
                    'size': len(g),
                    'participant_indices': ', '.join(map(str, g))
                }
                group_results.append(group_info)
        else:
            print("  לא נוצרו קבוצות - בדוק את הקונפיגורציה והנתונים")
            
        # Show unused participants
        used = set()
        for group in groups:
            used.update(group)
        unused = set(range(len(df))) - used
        if unused:
            print(f"\nמשתתפים שלא שובצו ({len(unused)}): {list(unused)}")
            
        # Create and save CSV with group results
        if group_results:
            results_df = pd.DataFrame(group_results)
            csv_filename = "group_formation_results.csv"
            results_df.to_csv(csv_filename, index=False, encoding="utf-8-sig")
            print(f"\n=== CSV EXPORT ===")
            print(f"Group results saved to: {csv_filename}")
            print(f"Columns: {list(results_df.columns)}")
            print(f"Total groups exported: {len(results_df)}")
            
            # Show summary statistics
            print(f"\n=== SUMMARY STATISTICS ===")
            print(f"Average group score: {results_df['group_score'].mean():.3f}")
            print(f"Score range: {results_df['group_score'].min():.3f} - {results_df['group_score'].max():.3f}")
            print(f"Average age per group: {results_df['age_mean'].mean():.1f}")
            print(f"Total participants grouped: {results_df['size'].sum()}")
            print(f"Unused participants: {len(unused)}")
            
    except FileNotFoundError:
        print("ERROR: File 'synthetic_survey_responses.csv' not found!")
        print("Please make sure the CSV file exists in the current directory.")
    except Exception as e:
        print(f"ERROR: {e}")
        if DEBUG_MODE:
            import traceback
            traceback.print_exc()
