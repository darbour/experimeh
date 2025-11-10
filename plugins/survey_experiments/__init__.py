"""
Survey Experiments Module

Specialized analysis tools for survey experiments with:
- Paired comparison designs (within-subjects A/B testing)
- Multi-item surveys (hierarchical/clustered designs)
- Survey quality checks
- Bias detection
- Response validation

Plugins:
- PairedComparisonSurvey: For within-subjects paired comparisons
- MultiItemSurvey: For item-level randomization with respondent clustering

Utilities:
- SurveyQualityChecks: Response quality validation
- SurveyBiasDetection: Detect response biases
- SurveyBalanceChecks: Verify randomization balance
- SurveyMetrics: Calculate survey-specific metrics

Example:
    from survey_experiments import PairedComparisonSurvey
    from experimeh_plugins import ExperimentalContext, AnalysisConfig

    plugin = PairedComparisonSurvey()
    result = plugin.analyze(context, config)
"""

__version__ = "1.0.0"

from .paired_comparison import PairedComparisonSurvey
from .multi_item_survey import MultiItemSurvey
from .survey_utils import (
    SurveyQualityChecks,
    SurveyBiasDetection,
    SurveyBalanceChecks,
    SurveyMetrics,
    run_comprehensive_survey_checks
)

__all__ = [
    # Plugins
    'PairedComparisonSurvey',
    'MultiItemSurvey',

    # Utilities
    'SurveyQualityChecks',
    'SurveyBiasDetection',
    'SurveyBalanceChecks',
    'SurveyMetrics',
    'run_comprehensive_survey_checks',
]
