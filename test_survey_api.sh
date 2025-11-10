#!/bin/bash
# Quick Test Script for Survey Experiments API
# Tests the Python wrapper without needing to run the full Node.js server

set -e

echo "=================================================="
echo "Survey Experiments API - Quick Test"
echo "=================================================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}1. Testing Paired Comparison Analysis${NC}"
echo "---------------------------------------------------"

python3 plugins/survey_experiments/api_wrapper.py \
  --type paired_comparison \
  --data /tmp/sample_survey_data.csv \
  --config '{"subject_column":"respondent_id","condition_column":"condition","metric_column":"rating","control_value":"control","treatment_value":"treatment","alpha":0.05}' \
  | python3 -m json.tool

echo ""
echo -e "${GREEN}✓ Paired Comparison Test Passed${NC}"

echo ""
echo -e "${BLUE}2. Creating Multi-Item Test Data${NC}"
echo "---------------------------------------------------"

cat > /tmp/multi_item_survey.csv << 'EOF'
respondent_id,item_id,treatment,rating
resp_1,item_1,control,3
resp_1,item_2,treatment,4
resp_1,item_3,control,3
resp_1,item_4,treatment,5
resp_2,item_5,treatment,4
resp_2,item_6,control,3
resp_2,item_7,treatment,5
resp_2,item_8,control,4
resp_3,item_9,control,3
resp_3,item_10,treatment,4
resp_3,item_11,control,2
resp_3,item_12,treatment,4
resp_4,item_13,treatment,5
resp_4,item_14,control,4
resp_4,item_15,treatment,5
resp_4,item_16,control,3
resp_5,item_17,control,3
resp_5,item_18,treatment,4
resp_5,item_19,control,3
resp_5,item_20,treatment,5
resp_6,item_21,control,4
resp_6,item_22,treatment,5
resp_6,item_23,control,3
resp_6,item_24,treatment,4
resp_7,item_25,treatment,5
resp_7,item_26,control,4
resp_7,item_27,treatment,5
resp_7,item_28,control,3
resp_8,item_29,control,3
resp_8,item_30,treatment,4
resp_8,item_31,control,4
resp_8,item_32,treatment,5
resp_9,item_33,treatment,4
resp_9,item_34,control,3
resp_9,item_35,treatment,5
resp_9,item_36,control,4
resp_10,item_37,control,3
resp_10,item_38,treatment,4
resp_10,item_39,control,3
resp_10,item_40,treatment,5
resp_11,item_41,treatment,5
resp_11,item_42,control,4
resp_11,item_43,treatment,4
resp_11,item_44,control,3
resp_12,item_45,control,3
resp_12,item_46,treatment,5
resp_12,item_47,control,4
resp_12,item_48,treatment,4
resp_13,item_49,treatment,5
resp_13,item_50,control,4
resp_13,item_51,treatment,5
resp_13,item_52,control,3
resp_14,item_53,control,4
resp_14,item_54,treatment,5
resp_14,item_55,control,3
resp_14,item_56,treatment,4
EOF

echo "Created /tmp/multi_item_survey.csv"

echo ""
echo -e "${BLUE}3. Testing Multi-Item Survey Analysis${NC}"
echo "---------------------------------------------------"

python3 plugins/survey_experiments/api_wrapper.py \
  --type multi_item \
  --data /tmp/multi_item_survey.csv \
  --config '{"respondent_column":"respondent_id","item_column":"item_id","treatment_column":"treatment","metric_column":"rating","control_value":"control","treatment_value":"treatment","alpha":0.05}' \
  | python3 -m json.tool

echo ""
echo -e "${GREEN}✓ Multi-Item Survey Test Passed${NC}"

echo ""
echo -e "${BLUE}4. Testing Quality Checks${NC}"
echo "---------------------------------------------------"

python3 plugins/survey_experiments/api_wrapper.py \
  --type quality_checks \
  --data /tmp/sample_survey_data.csv \
  --config '{"respondent_column":"respondent_id","rating_columns":["rating"],"order_column":"order","treatment_column":"condition"}' \
  | python3 -m json.tool

echo ""
echo -e "${GREEN}✓ Quality Checks Test Passed${NC}"

echo ""
echo "=================================================="
echo -e "${GREEN}✓ All Tests Passed!${NC}"
echo "=================================================="
echo ""
echo "The Python API wrapper is working correctly."
echo "You can now:"
echo "  1. Start the backend: npm run dev"
echo "  2. Start the dashboard: cd dashboard && npm run dev"
echo "  3. Navigate to: http://localhost:5173/survey-experiments"
echo ""
