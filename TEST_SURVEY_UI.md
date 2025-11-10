# Survey Experiments UI - Test Guide

## ✅ Prerequisites Installed

- ✅ Backend dependencies: `multer`, `uuid`, `@types/multer`
- ✅ Python dependencies: `pandas`, `numpy`, `scipy`, `pydantic`
- ✅ Python API wrapper tested successfully

## 🧪 Test Results

### Python Wrapper Test
```bash
python3 plugins/survey_experiments/api_wrapper.py --type paired_comparison --data /tmp/sample_survey_data.csv --config '{"subject_column":"respondent_id","condition_column":"condition","metric_column":"rating","control_value":"control","treatment_value":"treatment","alpha":0.05}'
```

**Result**: ✅ SUCCESS
- Treatment effect: 1.1 points
- P-value: 1.6e-06 (highly significant)
- Cohen's d: 3.48 (very large effect)
- Correlation: 0.88 (strong pairing benefit)

## 🚀 How to Test the Full UI

### 1. Start the Backend Server

```bash
cd /home/user/experimeh
npm run dev
# or
npm start
```

Backend will run on: `http://localhost:3000`

### 2. Start the Dashboard (in another terminal)

```bash
cd /home/user/experimeh/dashboard
npm install  # if not done yet
npm run dev
```

Dashboard will run on: `http://localhost:5173` (Vite default)

### 3. Test the Web Interface

#### Access the Survey Experiments page:
```
http://localhost:5173/survey-experiments
```

#### Create New Analysis:
1. Click **"New Analysis"** button
2. **Upload Data**:
   - Name: "Test Survey Analysis"
   - File: Upload `/tmp/sample_survey_data.csv` (created during testing)
3. **Configure**:
   - Analysis Type: "Paired Comparison"
   - Columns:
     - Subject Column: `respondent_id`
     - Condition Column: `condition`
     - Metric Column: `rating`
     - Control Value: `control`
     - Treatment Value: `treatment`
     - Order Column: `order` (optional)
4. **Run Analysis**
5. **View Results**: Auto-redirects to results page with:
   - Treatment effect: 1.1
   - 95% CI: [0.87, 1.33]
   - P-value: < 0.001
   - Cohen's d: 3.48
   - Quality checks
   - Warnings and diagnostics

## 📝 Sample Data Structure

The test file `/tmp/sample_survey_data.csv` contains:
- 10 respondents
- 2 conditions per respondent (paired comparison)
- Columns: `respondent_id`, `condition`, `rating`, `order`

```csv
respondent_id,condition,rating,order
user_1,control,3,1
user_1,treatment,4,2
user_2,treatment,5,1
user_2,control,4,2
...
```

## 🔍 API Endpoints to Test

### Upload Data
```bash
curl -X POST http://localhost:3000/api/v1/survey-experiments/upload \
  -F "file=@/tmp/sample_survey_data.csv" \
  -F "name=Test Analysis"
```

### Run Analysis
```bash
curl -X POST http://localhost:3000/api/v1/survey-experiments/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "analysisId": "YOUR_ANALYSIS_ID",
    "analysisType": "paired_comparison",
    "config": {
      "subject_column": "respondent_id",
      "condition_column": "condition",
      "metric_column": "rating",
      "control_value": "control",
      "treatment_value": "treatment",
      "alpha": 0.05
    }
  }'
```

### Get Results
```bash
curl http://localhost:3000/api/v1/survey-experiments/YOUR_ANALYSIS_ID
```

### List All Analyses
```bash
curl http://localhost:3000/api/v1/survey-experiments
```

## 🎯 Expected Features to Test

### Main List Page
- [ ] Shows list of all analyses
- [ ] Status badges (pending/running/completed/failed)
- [ ] Filter by status
- [ ] Stats cards (total, completed, running, failed)
- [ ] Real-time updates (5s polling for running analyses)
- [ ] Delete functionality

### New Analysis Wizard
- [ ] Step 1: File upload (drag & drop or click)
- [ ] Step 2: Configuration form
- [ ] Analysis type switcher (Paired vs Multi-Item)
- [ ] Dynamic form fields based on type
- [ ] Column name inputs with placeholders
- [ ] Step 3: Success message & navigation

### Analysis Detail Page
- [ ] Statistical results display
- [ ] Effect sizes and p-values
- [ ] Confidence intervals
- [ ] Sample size information
- [ ] Quality checks section
- [ ] Warnings display
- [ ] Auto-refresh for running analyses
- [ ] Dark mode support

## 🐛 Known Issues / Notes

1. **TypeScript Compilation**: Some existing TS errors in other files (not survey-experiments related)
2. **In-Memory Storage**: Analyses are stored in memory (restart = data loss). In production, use database.
3. **File Storage**: Uploaded files go to `/tmp/survey-uploads/`. Clean up periodically.
4. **Python Path**: Ensure Python 3 is available and modules are installed globally or in venv.

## ✨ Success Criteria

- ✅ Python wrapper runs successfully
- ✅ Backend routes defined and importable
- ✅ Frontend components created
- ✅ Navigation added to main menu
- ✅ TypeScript types defined
- ⏳ Full end-to-end test (requires running servers)

## 📚 Related Files

**Backend:**
- `src/api/routes/survey-experiments.ts` - API routes
- `plugins/survey_experiments/api_wrapper.py` - Python bridge

**Frontend:**
- `dashboard/src/pages/SurveyExperiments.tsx` - List page
- `dashboard/src/pages/NewSurveyAnalysis.tsx` - Upload/config wizard
- `dashboard/src/pages/SurveyAnalysisDetail.tsx` - Results page
- `dashboard/src/hooks/useSurveyExperiments.ts` - API hooks
- `dashboard/src/types/index.ts` - TypeScript types

**Python Analysis:**
- `plugins/survey_experiments/paired_comparison.py`
- `plugins/survey_experiments/multi_item_survey.py`
- `plugins/survey_experiments/survey_utils.py`
