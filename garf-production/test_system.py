#!/usr/bin/env python3
"""
Simple test to verify the system components work
"""

import sys
import os

print("=== GARF SYSTEM TEST ===")
print("Python version:", sys.version)

# Test 1: Check if we can import the algorithm
try:
    print("\n1. Testing algorithm import...")
    sys.path.insert(0, os.path.abspath('../garf-legacy'))
    from sotrim_algo import make_groups, group_score
    print("✅ Algorithm imported successfully!")
except Exception as e:
    print(f"❌ Algorithm import failed: {e}")

# Test 2: Check if we can import the API components
try:
    print("\n2. Testing API components...")
    sys.path.insert(0, os.path.abspath('./api'))
    from app.services.grouping_engine import GroupingEngine
    print("✅ API components imported successfully!")
except Exception as e:
    print(f"❌ API import failed: {e}")

# Test 3: Check if we can load sample data
try:
    print("\n3. Testing data loading...")
    import pandas as pd
    df = pd.read_csv('../garf-legacy/synthetic_survey_responses.csv')
    print(f"✅ Data loaded: {len(df)} participants, {len(df.columns)} columns")
except Exception as e:
    print(f"❌ Data loading failed: {e}")

print("\n=== TEST COMPLETE ===")
