#!/usr/bin/env python3
"""
Script to create an initial survey in the database
Run this after setting up the database to have a working survey
"""

import json
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal, init_db
from app.models import Survey, GroupingPolicy

def create_initial_survey():
    """Create the main survey with Hebrew/English fields"""
    
    # Survey schema matching the original CSV structure
    survey_schema = {
        "fields": [
            # Identification fields
            {
                "name": "email",
                "label": {"he": "כתובת אימייל", "en": "Email"},
                "type": "email",
                "required": False,
                "role": "identifier"
            },
            {
                "name": "full_name",
                "label": {"he": "שם מלא", "en": "Full Name"},
                "type": "text",
                "required": True,
                "role": "identifier"
            },
            {
                "name": "age",
                "label": {"he": "גיל", "en": "Age"},
                "type": "number",
                "min": 18,
                "max": 120,
                "required": True,
                "role": "hard_constraint"
            },
            {
                "name": "phone",
                "label": {"he": "מספר טלפון", "en": "Phone Number"},
                "type": "phone",
                "required": False,
                "role": "identifier"
            },
            
            # Hard constraints - Logistics
            {
                "name": "meeting_area",
                "label": {"he": "אזור נוח למפגש", "en": "Preferred Meeting Area"},
                "type": "multi_select",
                "options": ["צפון", "מרכז", "דרום", "ירושלים", "צפון ת״א", "דרום ת״א", "לא משנה"],
                "required": True,
                "role": "hard_constraint",
                "normalization": {
                    "wildcards": ["לא משנה", "לא משנה לי"],
                    "expansion": ["צפון", "מרכז", "דרום", "ירושלים", "צפון ת״א", "דרום ת״א"]
                }
            },
            {
                "name": "meeting_days",
                "label": {"he": "ימים נוחים לפגישה", "en": "Available Days"},
                "type": "multi_select",
                "options": ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "מוצ״ש"],
                "required": True,
                "role": "hard_constraint"
            },
            {
                "name": "meeting_language",
                "label": {"he": "שפת המפגש", "en": "Meeting Language"},
                "type": "single_select",
                "options": ["עברית בלבד", "אנגלית בלבד", "גם וגם"],
                "required": True,
                "role": "hard_constraint",
                "normalization": {
                    "wildcards": ["גם וגם"],
                    "expansion": ["עברית בלבד", "אנגלית בלבד"]
                }
            },
            {
                "name": "budget_range",
                "label": {"he": "טווח תקציב", "en": "Budget Range"},
                "type": "single_select",
                "options": ["קליל ונגיש", "בינוני ונוח", "מיוחד ומושקע", "לא משנה לי"],
                "required": True,
                "role": "hard_constraint",
                "normalization": {
                    "wildcards": ["לא משנה לי"],
                    "expansion": ["קליל ונגיש", "בינוני ונוח", "מיוחד ומושקע"]
                }
            },
            {
                "name": "dietary_restrictions",
                "label": {"he": "מגבלות תזונתיות", "en": "Dietary Restrictions"},
                "type": "multi_select",
                "options": ["כשר", "צמחוני/ת", "טבעוני/ת", "ללא גלוטן", "אלרגיות", "אין"],
                "required": False,
                "role": "soft_constraint"
            },
            
            # Demographic/categorical for diversity
            {
                "name": "gender",
                "label": {"he": "איך אתה מגדיר את עצמך", "en": "Gender"},
                "type": "single_select",
                "options": ["גבר", "אשה", "אחר", "מעדיף לא לענות"],
                "required": False,
                "role": "soft_constraint"
            },
            {
                "name": "profession",
                "label": {"he": "מקצוע/תחום", "en": "Profession/Field"},
                "type": "single_select",
                "options": ["טכנולוגיה", "חינוך", "בריאות", "עסקים", "אמנות", "מסעדנות", "סטודנט/ית", "אחר"],
                "required": False,
                "role": "soft_constraint"
            },
            {
                "name": "life_stage",
                "label": {"he": "שלב בחיים", "en": "Life Stage"},
                "type": "single_select",
                "options": ["סטודנט/ית", "בתחילת הקריירה", "עובד/ת ומבוסס/ת", "בתקופת מעבר", "חדש/ה בעיר"],
                "required": False,
                "role": "soft_constraint"
            },
            {
                "name": "relationship_status",
                "label": {"he": "סטטוס", "en": "Relationship Status"},
                "type": "single_select",
                "options": ["רווק/ה", "בזוגיות", "נשוי/אה", "It's complicated"],
                "required": False,
                "role": "soft_constraint"
            },
            
            # Numeric features for diversity/similarity scoring
            {
                "name": "energy_end_day",
                "label": {"he": "אנרגיה בסוף יום", "en": "Energy at End of Day"},
                "type": "scale",
                "min": 1,
                "max": 10,
                "required": True,
                "role": "soft_constraint",
                "help_text": {"he": "1 = מותש לגמרי, 10 = מלא אנרגיה", "en": "1 = Exhausted, 10 = Full of energy"}
            },
            {
                "name": "introversion",
                "label": {"he": "אני אדם מופנם", "en": "I'm Introverted"},
                "type": "scale",
                "min": 1,
                "max": 10,
                "required": True,
                "role": "soft_constraint",
                "help_text": {"he": "1 = מאוד מוחצן, 10 = מאוד מופנם", "en": "1 = Very extroverted, 10 = Very introverted"}
            },
            {
                "name": "creativity",
                "label": {"he": "אני אדם יצירתי", "en": "I'm Creative"},
                "type": "scale",
                "min": 1,
                "max": 10,
                "required": True,
                "role": "soft_constraint"
            },
            {
                "name": "stress_prone",
                "label": {"he": "אני נוטה ללחץ", "en": "I'm Prone to Stress"},
                "type": "scale",
                "min": 1,
                "max": 10,
                "required": True,
                "role": "soft_constraint"
            },
            {
                "name": "humor_importance",
                "label": {"he": "חשיבות הומור", "en": "Importance of Humor"},
                "type": "scale",
                "min": 1,
                "max": 10,
                "required": True,
                "role": "soft_constraint"
            },
            {
                "name": "spirituality",
                "label": {"he": "חשיבות רוחניות", "en": "Spirituality Importance"},
                "type": "scale",
                "min": 1,
                "max": 10,
                "required": True,
                "role": "soft_constraint"
            },
            {
                "name": "fitness_love",
                "label": {"he": "אני אוהב להתאמן", "en": "I Love to Exercise"},
                "type": "scale",
                "min": 1,
                "max": 10,
                "required": True,
                "role": "soft_constraint"
            },
            {
                "name": "city_nature",
                "label": {"he": "נהנה יותר בעיר/טבע", "en": "Prefer City/Nature"},
                "type": "scale",
                "min": 1,
                "max": 10,
                "required": True,
                "role": "soft_constraint",
                "help_text": {"he": "1 = עיר, 10 = טבע", "en": "1 = City, 10 = Nature"}
            },
            {
                "name": "political_discussion",
                "label": {"he": "נהנה משיח פוליטי", "en": "Enjoy Political Discussion"},
                "type": "scale",
                "min": 1,
                "max": 10,
                "required": True,
                "role": "soft_constraint"
            },
            
            # Free text for context
            {
                "name": "expectations",
                "label": {"he": "מה הייתי רוצה לחוות החודש", "en": "What I'd Like to Experience"},
                "type": "text",
                "max_length": 500,
                "required": False,
                "role": "explain_only"
            },
            {
                "name": "additional_notes",
                "label": {"he": "הערות נוספות", "en": "Additional Notes"},
                "type": "text",
                "max_length": 500,
                "required": False,
                "role": "explain_only"
            }
        ]
    }
    
    ui_config = {
        "title": {"he": "סקר קיבוץ לקבוצות", "en": "Group Formation Survey"},
        "description": {
            "he": "אנא מלא את השאלון הבא כדי שנוכל לשבץ אותך לקבוצה המתאימה ביותר",
            "en": "Please fill out this survey so we can match you with the most suitable group"
        },
        "submit_button": {"he": "שלח", "en": "Submit"},
        "thank_you_message": {
            "he": "תודה על מילוי הסקר! נעדכן אותך כשהקבוצות יהיו מוכנות",
            "en": "Thank you for completing the survey! We'll notify you when groups are ready"
        },
        "rtl": True
    }
    
    # Create default grouping policy
    default_policy = {
        "group_size": 6,
        "subspaces": [],  # No subspaces by default
        "hard": {
            "categorical_equal": [],
            "multi_overlap": ["meeting_days", "meeting_area"],
            "numeric_tol": {}
        },
        "age_rules": {
            "field": "age",
            "bands": [
                {"name": "20s", "min": 20, "max": 29, "max_spread": 8},
                {"name": "20s-30s", "min": 25, "max": 35, "max_spread": 10},
                {"name": "30s-40s", "min": 30, "max": 45, "max_spread": 12},
                {"name": "40s-50s", "min": 40, "max": 55, "max_spread": 15},
                {"name": "50plus", "min": 50, "max": 120, "max_spread": 20}
            ],
            "allow_cross_band": True,
            "group_constraints": {
                "max_age_difference": 15,
                "max_age_std": 7.0
            }
        },
        "soft": {
            "numeric_features": [
                "introversion", "creativity", "stress_prone",
                "humor_importance", "spirituality", "fitness_love",
                "city_nature", "political_discussion"
            ],
            "weights": {
                "diversity_numeric": 1.0,
                "similarity_bonus": 0.2,
                "categorical_diversity": 0.3,
                "multi_overlap_bonus": 0.2
            }
        },
        "fallback": {
            "defer_if_infeasible": True,
            "min_group_size": 4,
            "max_group_size": 8
        }
    }
    
    normalization_config = {
        "flexible_answers": [
            "לא משנה לי", "גם וגם", "אין", "לא חשוב",
            "שילוב", "בין לבין", "לא משנה", "כל האפשרויות",
            "אין העדפה", "לא רלוונטי"
        ]
    }
    
    # Save to database
    db = SessionLocal()
    try:
        # Check if survey already exists
        existing = db.query(Survey).filter(
            Survey.name == "main",
            Survey.version == 1
        ).first()
        
        if existing:
            print("Survey 'main' version 1 already exists")
            return
        
        # Create survey
        survey = Survey(
            name="main",
            version=1,
            is_active=True,
            schema_json=survey_schema,
            ui_config_json=ui_config
        )
        db.add(survey)
        db.flush()
        
        # Create policy
        policy = GroupingPolicy(
            survey_id=survey.id,
            is_active=True,
            rules_json=default_policy,
            weights_json=default_policy["soft"]["weights"],
            normalization_json=normalization_config,
            subspace_json=default_policy["subspaces"]
        )
        db.add(policy)
        
        db.commit()
        print(f"✓ Created survey 'main' version 1 (ID: {survey.id})")
        print(f"✓ Created default grouping policy (ID: {policy.id})")
        
    except Exception as e:
        print(f"Error creating survey: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    print("Creating initial survey...")
    init_db()
    create_initial_survey()
    print("Done!")

