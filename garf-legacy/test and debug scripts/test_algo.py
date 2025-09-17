#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import pandas as pd
import numpy as np
import sys

# Set UTF-8 encoding
sys.stdout.reconfigure(encoding='utf-8')

print("=== TESTING SOTRIM ALGORITHM ===")

try:
    # Load data
    print("Loading CSV...")
    df = pd.read_csv("synthetic_survey_responses.csv")
    print(f"Loaded {len(df)} participants")
    
    # Import the algorithm
    print("Importing algorithm...")
    from sotrim_algo import make_groups, validate_dataframe, validate_config
    
    # Validate
    print("Validating...")
    validate_config()
    validate_dataframe(df)
    print("Validation passed!")
    
    # Run algorithm
    print("Running algorithm...")
    groups = make_groups(df)
    
    print(f"Algorithm completed. Found {len(groups)} groups.")
    
    if groups:
        print("Groups:")
        for i, group in enumerate(groups, 1):
            print(f"  Group {i}: {group}")
    else:
        print("No groups formed!")
        
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
