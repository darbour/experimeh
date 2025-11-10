#!/usr/bin/env python3
"""
Survey Experiment Example 3: Quality Diagnostics Showcase

Scenario: Demonstrating comprehensive survey quality checks
- Intentionally includes data quality issues
- Shows how to detect and handle:
  * Straightliners
  * Speeders
  * Failed attention checks
  * Order effects
  * Response biases

Purpose: Educational example showing quality diagnostics
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../python'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../plugins'))

import numpy as np
import pandas as pd
from experimeh_plugins import (
    ExperimentalContext,
    ExperimentalDesign,
    MetricSpecification,
    AnalysisConfig,
    WithinSubjectsStructure
)

from survey_experiments import (
    PairedComparisonSurvey,
    SurveyQualityChecks,
    SurveyBiasDetection,
    SurveyMetrics,
    run_comprehensive_survey_checks
)

print("=" * 80)
print("SURVEY EXPERIMENT 3: Quality Diagnostics Showcase")
print("=" * 80)

# Simulate survey with intentional quality issues
np.random.seed(789)
n_respondents = 200

# Create different respondent types
respondent_types = []
for i in range(n_respondents):
    if i < 150:  # 75% good quality
        respondent_types.append('good')
    elif i < 170:  # 10% straightliners
        respondent_types.append('straightliner')
    elif i < 185:  # 7.5% speeders
        respondent_types.append('speeder')
    else:  # 7.5% inattentive
        respondent_types.append('inattentive')

# Generate data
data_list = []

for i in range(n_respondents):
    resp_type = respondent_types[i]
    baseline = np.random.normal(3, 0.8, 1)[0]

    # Three items rated: Product A, Product B, Attention Check
    items = ['Product_A', 'Product_B', 'Product_C', 'Product_D']

    for item_idx, item in enumerate(items):
        # Good respondents: meaningful variation
        if resp_type == 'good':
            if item == 'Product_A':
                rating = baseline + np.random.normal(0, 0.7)
            elif item == 'Product_B':
                rating = baseline + 0.5 + np.random.normal(0, 0.7)  # B is better
            elif item == 'Product_C':
                rating = baseline + 0.3 + np.random.normal(0, 0.7)
            else:
                rating = baseline - 0.2 + np.random.normal(0, 0.7)

            response_time = np.random.gamma(5, 3)  # 15 seconds average
            attention_pass = True

        # Straightliners: same rating for everything
        elif resp_type == 'straightliner':
            rating = np.random.choice([3, 4])  # Always 3 or 4
            response_time = np.random.gamma(3, 2)
            attention_pass = np.random.rand() < 0.5

        # Speeders: random ratings, very fast
        elif resp_type == 'speeder':
            rating = np.random.choice([1, 2, 3, 4, 5])
            response_time = np.random.gamma(1, 1)  # ~1 second
            attention_pass = np.random.rand() < 0.3  # Often fail

        # Inattentive: fail attention checks
        else:
            rating = np.random.normal(3, 1)
            response_time = np.random.gamma(4, 2.5)
            attention_pass = False

        rating = np.clip(rating, 1, 5)

        data_list.append({
            'respondent_id': f'resp_{i}',
            'respondent_type': resp_type,
            'item': item,
            'rating': rating,
            'position': item_idx + 1,
            'response_time_sec': response_time,
            'attention_correct': attention_pass,
            'age': np.random.choice(['18-29', '30-44', '45-60', '60+']),
            'gender': np.random.choice(['M', 'F', 'Other'])
        })

data = pd.DataFrame(data_list)

print("\n📊 Study Overview:")
print(f"  Total respondents: {n_respondents}")
print(f"  Items per respondent: 4")
print(f"  Total responses: {len(data)}")

print("\nRespondent Quality Distribution (Ground Truth):")
type_counts = data.groupby('respondent_id')['respondent_type'].first().value_counts()
for resp_type, count in type_counts.items():
    print(f"  {resp_type}: {count} ({count/n_respondents*100:.1f}%)")

print("\n" + "=" * 80)
print("QUALITY DIAGNOSTICS")
print("=" * 80)

qc = SurveyQualityChecks()
bc = SurveyBiasDetection()
sm = SurveyMetrics()

# 1. Straightlining Detection
print("\n1. STRAIGHTLINING DETECTION")
print("-" * 80)
straightline_check = qc.check_straightlining(
    data,
    rating_columns=['rating'],
    respondent_col='respondent_id',
    threshold=0.75
)

print(f"Detected Straightliners: {straightline_check['n_straightliners']} "
      f"({straightline_check['pct_straightliners']:.1%})")
print(f"Average straightline rate: {straightline_check['avg_straightline_rate']:.1%}")

# Compare with ground truth
actual_straightliners = set(data[data['respondent_type'] == 'straightliner']['respondent_id'].unique())
detected_straightliners = set(straightline_check['flagged_respondents'])
true_positives = len(actual_straightliners & detected_straightliners)
false_positives = len(detected_straightliners - actual_straightliners)
false_negatives = len(actual_straightliners - detected_straightliners)

print(f"\nDetection Accuracy:")
print(f"  True Positives: {true_positives}")
print(f"  False Positives: {false_positives}")
print(f"  False Negatives: {false_negatives}")
if len(actual_straightliners) > 0:
    recall = true_positives / len(actual_straightliners)
    print(f"  Recall: {recall:.1%}")

# 2. Speeding Detection
print("\n2. SPEEDING DETECTION")
print("-" * 80)
speed_check = qc.check_speeding(
    data,
    duration_col='response_time_sec',
    respondent_col='respondent_id',
    threshold_percentile=10
)

print(f"Detected Speeders: {speed_check['n_speeders']} ({speed_check['pct_speeders']:.1%})")
print(f"Speed threshold: <{speed_check['threshold_seconds']:.1f} seconds total")
print(f"Median duration: {speed_check['median_duration']:.1f} seconds")
print(f"Mean duration: {speed_check['mean_duration']:.1f} seconds")

# Compare with ground truth
actual_speeders = set(data[data['respondent_type'] == 'speeder']['respondent_id'].unique())
detected_speeders = set(speed_check['flagged_respondents'])
true_positives_speed = len(actual_speeders & detected_speeders)

print(f"\nDetection Accuracy:")
print(f"  True Positives: {true_positives_speed}/{len(actual_speeders)}")

# 3. Attention Check Validation
print("\n3. ATTENTION CHECK VALIDATION")
print("-" * 80)
attention_check = qc.validate_attention_checks(
    data,
    attention_col='attention_correct',
    correct_answer=True,
    respondent_col='respondent_id'
)

print(f"Failed Attention Check: {attention_check['n_failed']} ({attention_check['pct_failed']:.1%})")
print(f"Pass Rate: {attention_check['pass_rate']:.1%}")

# Compare with ground truth
actual_inattentive = set(data[data['respondent_type'] == 'inattentive']['respondent_id'].unique())
failed_attention = set(attention_check['failed_respondents'])
print(f"\nGround Truth Inattentive: {len(actual_inattentive)}")
print(f"Detected via Attention Check: {len(failed_attention)}")

# 4. Response Variance Check
print("\n4. RESPONSE VARIANCE CHECK")
print("-" * 80)
variance_check = qc.check_response_variance(
    data,
    rating_columns=['rating'],
    respondent_col='respondent_id',
    min_variance=0.15
)

print(f"Low Variance Respondents: {variance_check['n_low_variance']} "
      f"({variance_check['pct_low_variance']:.1%})")
print(f"Average Variance: {variance_check['avg_variance']:.3f}")

# 5. Order/Position Bias
print("\n5. ORDER/POSITION BIAS DETECTION")
print("-" * 80)
order_bias = bc.check_order_bias(
    data,
    rating_col='rating',
    order_col='position',
    item_col='item'
)

print(f"Order Bias Detected: {order_bias.get('order_bias_detected', 'N/A')}")
if 'spearman_correlation' in order_bias:
    print(f"Spearman Correlation: {order_bias['spearman_correlation']:.3f}")
    print(f"P-value: {order_bias['p_value']:.4f}")
    print(f"Linear Slope: {order_bias['linear_slope']:.4f}")
    print(f"Interpretation: {order_bias['interpretation']}")
    print(f"Direction: {order_bias['direction']}")

# 6. Response Scale Bias
print("\n6. RESPONSE SCALE BIAS")
print("-" * 80)
scale_bias = bc.check_response_scale_bias(
    data,
    rating_col='rating',
    scale_min=1,
    scale_max=5
)

print(f"Extreme Usage: {scale_bias['extreme_usage']:.1%}")
print(f"Midpoint Usage: {scale_bias['midpoint_usage']:.1%}")
print(f"Extreme Avoidance: {scale_bias['extreme_avoidance']}")
print(f"Midpoint Bias: {scale_bias['midpoint_bias']}")
print(f"Chi-square test: χ² = {scale_bias['chi_square']:.2f}, p = {scale_bias['p_value']:.4f}")
print(f"Interpretation: {scale_bias['interpretation']}")

print("\nScale Point Usage:")
for point, usage in sorted(scale_bias['scale_usage'].items()):
    print(f"  {point}: {usage:.1%}")

# 7. Composite Quality Score
print("\n7. COMPOSITE QUALITY SCORES")
print("-" * 80)
quality_scores = sm.calculate_response_quality_score(
    data,
    rating_columns=['rating'],
    respondent_col='respondent_id',
    duration_col='response_time_sec',
    attention_col='attention_correct',
    correct_attention_answer=True
)

print(f"Mean Quality Score: {quality_scores.mean():.1f}/100")
print(f"Median Quality Score: {quality_scores.median():.1f}/100")
print(f"Std Dev: {quality_scores.std():.1f}")

print("\nQuality Score Distribution:")
print(f"  Excellent (>80): {(quality_scores > 80).sum()} ({(quality_scores > 80).mean():.1%})")
print(f"  Good (60-80): {((quality_scores >= 60) & (quality_scores <= 80)).sum()} "
      f"({((quality_scores >= 60) & (quality_scores <= 80)).mean():.1%})")
print(f"  Fair (40-60): {((quality_scores >= 40) & (quality_scores < 60)).sum()} "
      f"({((quality_scores >= 40) & (quality_scores < 60)).mean():.1%})")
print(f"  Poor (<40): {(quality_scores < 40).sum()} ({(quality_scores < 40).mean():.1%})")

# Identify low quality respondents
low_quality_threshold = 50
low_quality_respondents = quality_scores[quality_scores < low_quality_threshold].index.tolist()

print(f"\nLow Quality Respondents (<{low_quality_threshold}): {len(low_quality_respondents)}")

# 8. Comprehensive Check Summary
print("\n" + "=" * 80)
print("DATA CLEANING RECOMMENDATIONS")
print("=" * 80)

# Combine all quality flags
flagged_respondents = set()
flagged_respondents.update(straightline_check['flagged_respondents'])
flagged_respondents.update(speed_check['flagged_respondents'])
flagged_respondents.update(attention_check['failed_respondents'])
flagged_respondents.update(variance_check['flagged_respondents'])
flagged_respondents.update(low_quality_respondents)

print(f"\nTotal Unique Respondents Flagged: {len(flagged_respondents)} "
      f"({len(flagged_respondents)/n_respondents:.1%})")

# Breakdown by flag type
print("\nBreakdown by Quality Issue:")
print(f"  Straightlining: {straightline_check['n_straightliners']}")
print(f"  Speeding: {speed_check['n_speeders']}")
print(f"  Failed Attention: {attention_check['n_failed']}")
print(f"  Low Variance: {variance_check['n_low_variance']}")
print(f"  Low Quality Score: {len(low_quality_respondents)}")

# Data cleaning impact
data_cleaned = data[~data['respondent_id'].isin(flagged_respondents)]
print(f"\nData After Cleaning:")
print(f"  Original: {n_respondents} respondents, {len(data)} responses")
print(f"  Cleaned: {data_cleaned['respondent_id'].nunique()} respondents, {len(data_cleaned)} responses")
print(f"  Removed: {n_respondents - data_cleaned['respondent_id'].nunique()} respondents "
      f"({(n_respondents - data_cleaned['respondent_id'].nunique())/n_respondents:.1%})")

# Compare ground truth
actual_bad = set(data[data['respondent_type'] != 'good']['respondent_id'].unique())
detected_bad = flagged_respondents
true_positives_overall = len(actual_bad & detected_bad)
false_positives_overall = len(detected_bad - actual_bad)
false_negatives_overall = len(actual_bad - detected_bad)

print(f"\nOverall Detection Performance:")
print(f"  True Positives: {true_positives_overall}/{len(actual_bad)} "
      f"({true_positives_overall/len(actual_bad):.1%})")
print(f"  False Positives: {false_positives_overall}")
print(f"  False Negatives: {false_negatives_overall}")

precision = true_positives_overall / len(detected_bad) if len(detected_bad) > 0 else 0
recall = true_positives_overall / len(actual_bad) if len(actual_bad) > 0 else 0
f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0

print(f"  Precision: {precision:.1%}")
print(f"  Recall: {recall:.1%}")
print(f"  F1 Score: {f1:.1%}")

print("\n" + "=" * 80)
print("KEY TAKEAWAYS")
print("=" * 80)
print("1. Multiple quality checks catch different issues")
print("2. Combining checks improves detection accuracy")
print("3. Quality scores provide nuanced respondent assessment")
print("4. Always validate quality checks against ground truth when possible")
print("5. Document all data cleaning decisions for transparency")
print("\n" + "=" * 80)

# Show recommended workflow
print("\nRECOMMENDED QUALITY CHECK WORKFLOW:")
print("=" * 80)
print("Step 1: Run all quality checks")
print("Step 2: Review flagged respondents individually")
print("Step 3: Set clear exclusion criteria (document rationale)")
print("Step 4: Analyze with and without flagged respondents")
print("Step 5: Report both results for sensitivity analysis")
print("Step 6: If results differ substantially, investigate further")
print("\n" + "=" * 80)
