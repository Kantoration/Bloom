"""Grouping engine that integrates with the existing SOTRIM algorithm"""

import sys
import os
import json
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional, Tuple, Set
from datetime import datetime
import hashlib

# Add path to import the existing algorithm (now in garf-legacy)
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../../garf-legacy')))
from sotrim_algo import (
    build_compatibility_matrix_vectorized,
    build_one_group_optimized,
    group_score,
    pass_pairwise_cuts,
    pass_group_constraints
)


class GroupingEngine:
    """Engine for running the grouping algorithm with policy configuration"""
    
    def __init__(self, policy: Dict[str, Any], features_df: pd.DataFrame):
        """
        Initialize grouping engine
        
        Args:
            policy: Grouping policy configuration
            features_df: DataFrame with participant features
        """
        self.policy = policy
        self.features_df = features_df
        self.groups = []
        self.ungrouped = set(range(len(features_df)))
        self.explanations = []
        
        # Parse policy into algorithm parameters
        self._parse_policy()
    
    def _parse_policy(self):
        """Parse policy into algorithm-compatible parameters"""
        self.group_size = self.policy.get("group_size", 6)
        self.subspaces = self.policy.get("subspaces", [])
        
        # Hard constraints
        hard = self.policy.get("hard", {})
        self.categorical_equal = hard.get("categorical_equal", [])
        self.multi_overlap = hard.get("multi_overlap", [])
        self.numeric_tol = hard.get("numeric_tol", {})
        
        # Soft constraints
        soft = self.policy.get("soft", {})
        self.numeric_features = soft.get("numeric_features", [])
        self.weights = soft.get("weights", {})
        
        # Age rules
        self.age_rules = self.policy.get("age_rules")
        
        # Normalization
        self.normalization = self.policy.get("normalization", {})
        self.flexible_answers = set(self.normalization.get("flexible_answers", []))
        
        # Fallback rules
        fallback = self.policy.get("fallback", {})
        self.min_group_size = fallback.get("min_group_size", 4)
        self.max_group_size = fallback.get("max_group_size", 8)
        self.defer_if_infeasible = fallback.get("defer_if_infeasible", True)
    
    def run(self) -> Tuple[List[List[int]], List[Dict[str, Any]]]:
        """
        Run the grouping algorithm
        
        Returns:
            Tuple of (groups, explanations)
        """
        # Partition into subspaces if configured
        if self.subspaces:
            subspace_partitions = self._partition_by_subspaces()
        else:
            # Single global space
            subspace_partitions = {"global": list(range(len(self.features_df)))}
        
        # Process each subspace
        for subspace_key, indices in subspace_partitions.items():
            self._process_subspace(subspace_key, indices)
        
        return self.groups, self.explanations
    
    def _partition_by_subspaces(self) -> Dict[str, List[int]]:
        """
        Partition participants into subspaces based on configured keys
        
        Returns:
            Dictionary mapping subspace keys to participant indices
        """
        partitions = {}
        
        for idx, row in self.features_df.iterrows():
            # Build subspace key from row data
            key_parts = []
            for subspace_fields in self.subspaces:
                field_values = []
                for field in subspace_fields:
                    value = row.get(field)
                    if isinstance(value, list):
                        value = ",".join(sorted(value))
                    field_values.append(f"{field}={value}")
                key_parts.append("|".join(field_values))
            
            key = "||".join(key_parts)
            if key not in partitions:
                partitions[key] = []
            partitions[key].append(idx)
        
        return partitions
    
    def _process_subspace(self, subspace_key: str, indices: List[int]) -> None:
        """
        Process a single subspace to form groups
        
        Args:
            subspace_key: Key identifying the subspace
            indices: List of participant indices in this subspace
        """
        # Filter to available participants
        available = [i for i in indices if i in self.ungrouped]
        
        if len(available) < self.min_group_size:
            return
        
        # Build compatibility matrix for this subspace
        df_subset = self.features_df.iloc[available]
        compat_matrix = self._build_compatibility_matrix(df_subset, available)
        
        # Form groups greedily
        while len(available) >= self.min_group_size:
            # Map to local indices for compatibility matrix
            local_indices = list(range(len(available)))
            
            # Build one group
            group = self._build_group(df_subset, available, compat_matrix, local_indices)
            
            if not group:
                break
            
            # Record group and explanation
            self.groups.append(group)
            self.ungrouped -= set(group)
            
            # Create explanation
            explanation = self._create_group_explanation(group, subspace_key)
            self.explanations.append(explanation)
            
            # Update available participants
            available = [i for i in available if i in self.ungrouped]
            df_subset = self.features_df.iloc[available] if available else pd.DataFrame()
            
            # Rebuild compatibility matrix for remaining participants
            if available:
                compat_matrix = self._build_compatibility_matrix(df_subset, available)
    
    def _build_compatibility_matrix(self, df: pd.DataFrame, indices: List[int]) -> np.ndarray:
        """
        Build compatibility matrix for participants
        
        Args:
            df: DataFrame subset
            indices: Participant indices
            
        Returns:
            Compatibility matrix
        """
        n = len(indices)
        compat = np.ones((n, n), dtype=bool)
        
        # Apply hard constraints
        for i in range(n):
            for j in range(i+1, n):
                # Check categorical equality
                for field in self.categorical_equal:
                    if field in df.columns:
                        val_i = df.iloc[i][field]
                        val_j = df.iloc[j][field]
                        if not self._check_categorical_match(val_i, val_j):
                            compat[i, j] = compat[j, i] = False
                            break
                
                if not compat[i, j]:
                    continue
                
                # Check multi-choice overlap
                for field in self.multi_overlap:
                    if field in df.columns:
                        val_i = df.iloc[i][field]
                        val_j = df.iloc[j][field]
                        if not self._check_multi_overlap(val_i, val_j):
                            compat[i, j] = compat[j, i] = False
                            break
                
                if not compat[i, j]:
                    continue
                
                # Check numeric tolerance
                for field, tol in self.numeric_tol.items():
                    if field in df.columns:
                        val_i = df.iloc[i][field]
                        val_j = df.iloc[j][field]
                        if pd.notna(val_i) and pd.notna(val_j):
                            if abs(float(val_i) - float(val_j)) > tol:
                                compat[i, j] = compat[j, i] = False
                                break
                
                # Check age compatibility
                if self.age_rules and not compat[i, j]:
                    continue
                    
                if self.age_rules and self.age_rules["field"] in df.columns:
                    age_i = df.iloc[i][self.age_rules["field"]]
                    age_j = df.iloc[j][self.age_rules["field"]]
                    if pd.notna(age_i) and pd.notna(age_j):
                        if not self._check_age_compatibility(age_i, age_j):
                            compat[i, j] = compat[j, i] = False
        
        # Ensure self-compatibility
        np.fill_diagonal(compat, True)
        
        return compat
    
    def _check_categorical_match(self, val1: Any, val2: Any) -> bool:
        """Check if two categorical values match (with normalization)"""
        # Handle lists (from normalized multi-select that became categorical)
        if isinstance(val1, list):
            set1 = set(val1)
        else:
            set1 = {str(val1).strip()} if pd.notna(val1) else set()
        
        if isinstance(val2, list):
            set2 = set(val2)
        else:
            set2 = {str(val2).strip()} if pd.notna(val2) else set()
        
        # Check for overlap (normalized values may expand to sets)
        return len(set1.intersection(set2)) > 0 if set1 and set2 else False
    
    def _check_multi_overlap(self, val1: Any, val2: Any) -> bool:
        """Check if two multi-choice values have overlap"""
        set1 = set(val1) if isinstance(val1, list) else set()
        set2 = set(val2) if isinstance(val2, list) else set()
        return len(set1.intersection(set2)) > 0
    
    def _check_age_compatibility(self, age1: float, age2: float) -> bool:
        """Check age compatibility based on age rules"""
        if not self.age_rules:
            return True
        
        bands = self.age_rules.get("bands", [])
        
        # Find which bands each age belongs to
        bands1 = []
        bands2 = []
        
        for i, band in enumerate(bands):
            if band["min"] <= age1 <= band["max"]:
                bands1.append(i)
            if band["min"] <= age2 <= band["max"]:
                bands2.append(i)
        
        # Check if they share a band
        if set(bands1).intersection(bands2):
            # Check max_spread within band
            for band_idx in set(bands1).intersection(bands2):
                max_spread = bands[band_idx].get("max_spread")
                if max_spread is None or abs(age1 - age2) <= max_spread:
                    return True
        
        # Check cross-band compatibility
        if self.age_rules.get("allow_cross_band", False):
            return abs(age1 - age2) <= self.age_rules.get("boundary_slack_years", 0)
        
        return False
    
    def _build_group(
        self,
        df: pd.DataFrame,
        candidates: List[int],
        compat_matrix: np.ndarray,
        local_indices: List[int]
    ) -> List[int]:
        """
        Build a single group using the existing optimized algorithm
        
        Returns:
            List of participant indices in the group
        """
        # Use the existing optimized group builder
        return build_one_group_optimized(self.features_df, candidates, compat_matrix, local_indices)
    
    def _create_group_explanation(self, group: List[int], subspace_key: str) -> Dict[str, Any]:
        """
        Create explanation for a group
        
        Args:
            group: List of participant indices
            subspace_key: Subspace identifier
            
        Returns:
            Explanation dictionary
        """
        df_group = self.features_df.iloc[group]
        
        # Calculate group score with explanation
        score, score_details = group_score(df_group, explain=True)
        
        # Parse subspace key
        subspace_dict = {}
        if subspace_key != "global":
            for part in subspace_key.split("||"):
                for field_val in part.split("|"):
                    if "=" in field_val:
                        field, val = field_val.split("=", 1)
                        subspace_dict[field] = val
        
        # Determine age band
        age_band = None
        if self.age_rules and self.age_rules["field"] in df_group.columns:
            ages = df_group[self.age_rules["field"]].dropna()
            if len(ages) > 0:
                age_band = f"{ages.min():.0f}-{ages.max():.0f} years"
        
        # Build member explanations
        members = []
        for idx in group:
            participant = self.features_df.iloc[idx]
            bound_by = []
            
            # List constraints that affect this participant
            if self.categorical_equal:
                bound_by.extend([f"{f}={participant[f]}" for f in self.categorical_equal if f in participant])
            if self.multi_overlap:
                bound_by.extend([f"{f}_overlap" for f in self.multi_overlap if f in participant])
            if self.numeric_tol:
                bound_by.extend([f"{f}±{t}" for f, t in self.numeric_tol.items() if f in participant])
            if age_band:
                bound_by.append(f"age_band:{age_band}")
            
            members.append({
                "participant_id": int(idx),
                "bound_by": bound_by
            })
        
        return {
            "policy_hash": hashlib.sha256(json.dumps(self.policy, sort_keys=True).encode()).hexdigest()[:8],
            "subspace": subspace_dict,
            "age_rules": age_band,
            "hard_constraints": {
                "categorical_equal": self.categorical_equal,
                "multi_overlap": self.multi_overlap,
                "numeric_tol": self.numeric_tol
            },
            "soft_scores": score_details if isinstance(score_details, dict) else {},
            "members": members,
            "group_score": float(score),
            "group_size": len(group)
        }
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about the grouping run
        
        Returns:
            Dictionary with run statistics
        """
        return {
            "total_participants": len(self.features_df),
            "total_groups": len(self.groups),
            "grouped_participants": len(self.features_df) - len(self.ungrouped),
            "ungrouped_participants": len(self.ungrouped),
            "group_sizes": [len(g) for g in self.groups],
            "average_group_size": np.mean([len(g) for g in self.groups]) if self.groups else 0,
            "average_group_score": np.mean([e["group_score"] for e in self.explanations]) if self.explanations else 0
        }

