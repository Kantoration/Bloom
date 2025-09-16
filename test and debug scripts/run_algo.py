#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import pandas as pd
import numpy as np
import sys

# Set UTF-8 encoding
sys.stdout.reconfigure(encoding='utf-8')

print("=== RUNNING OPTIMIZED SOTRIM ALGORITHM ===")

try:
    # Load data
    print("Loading CSV...")
    df = pd.read_csv("synthetic_survey_responses.csv")
    print(f"Loaded {len(df)} participants with {len(df.columns)} columns")
    
    # Import the algorithm
    print("Importing optimized algorithm...")
    from sotrim_algo import make_groups, group_score
    
    # Run algorithm
    print("Running optimized algorithm...")
    groups = make_groups(df)
    
    print(f"\n=== RESULTS ===")
    print(f"Found {len(groups)} groups")
    
    if groups:
        # Create detailed results for CSV export
        group_results = []
        
        for k, g in enumerate(groups, 1):
            names = df.loc[g]["שם מלא"].tolist() if "שם מלא" in df else g
            ages = df.loc[g]["גיל"].tolist() if "גיל" in df else []
            emails = df.loc[g]["Email"].tolist() if "Email" in df else []
            
            # Calculate group score
            group_score_val = group_score(df.loc[g])
            
            # Calculate age statistics
            age_mean = np.mean(ages) if ages else 0
            age_std = np.std(ages) if ages else 0
            
            print(f"Group {k}: {names}")
            print(f"  Ages: {ages} (mean: {age_mean:.1f})")
            print(f"  Score: {group_score_val:.3f}")
            
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
        
        # Create and save CSV with group results
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
        
        # Show unused participants
        used = set()
        for group in groups:
            used.update(group)
        unused = set(range(len(df))) - used
        if unused:
            print(f"Unused participants: {len(unused)}")
            print(f"Unused indices: {list(unused)}")
    else:
        print("No groups formed!")
        
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
