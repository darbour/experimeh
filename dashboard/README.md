# ExperimentHub Dashboard

A comprehensive React dashboard for managing and analyzing feature flag experiments. Built with React 18, TypeScript, and Tailwind CSS.

## Features

### Core Functionality

- **Experiment Management**: Create, start, pause, stop, and archive experiments
- **Real-time Updates**: Live updates for running experiments (5-second polling)
- **Multiple Design Types**: Support for A/B tests, factorial designs, switchback tests, and stepped wedge rollouts
- **Rich Analytics**: Interactive charts and statistical analysis
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Dark Mode**: Full dark mode support

### Dashboard Pages

1. **Home Dashboard**
   - Overview statistics (total, running, completed experiments)
   - Quick actions
   - Recent experiments list
   - Recent analysis results

2. **Experiments List**
   - Filterable and sortable table
   - Search functionality
   - Status badges
   - Real-time updates

3. **Experiment Detail**
   - Experiment configuration
   - Real-time metrics
   - Assignment distribution
   - Interactive charts (line and bar)
   - Statistical results table
   - Guardrail monitoring
   - Control actions (start/pause/stop)

4. **Create Experiment**
   - Multi-step form
   - Dynamic variant configuration
   - Metric configuration (primary, secondary, guardrail)
   - Design type selection
   - Validation

5. **Analytics**
   - Cross-experiment insights (coming soon)
   - Trend analysis (coming soon)

### Components

#### Core Components

- **Layout**: Responsive sidebar navigation with dark mode toggle
- **ExperimentList**: Paginated, filterable experiment table
- **ExperimentDetail**: Comprehensive experiment view with real-time updates
- **MetricsChart**: Interactive Recharts visualizations (line and bar charts)
- **ResultsTable**: Statistical results with confidence intervals and significance indicators
- **CreateExperiment**: Multi-step form for experiment creation

#### Custom Hooks

- **useExperiments**: Query and mutate experiments
- **useAnalysis**: Fetch and analyze experiment results
- **useRealtime**: Real-time updates via polling

#### API Client

- **client.ts**: Axios-based API client with interceptors
- Authentication support
- Error handling
- TypeScript types

## Tech Stack

- **React 18**: Modern React with hooks
- **TypeScript**: Full type safety
- **React Router**: Client-side routing
- **TanStack Query (React Query)**: Data fetching and caching
- **Recharts**: Chart visualizations
- **Tailwind CSS**: Utility-first styling
- **Lucide React**: Icon library
- **date-fns**: Date formatting
- **Vite**: Fast build tool and dev server
- **Axios**: HTTP client

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Backend API running (default: http://localhost:8000)

### Installation

1. **Install dependencies**

```bash
cd dashboard
npm install
```

2. **Configure environment variables**

Create a `.env` file in the dashboard directory:

```env
# API Configuration
VITE_API_URL=http://localhost:8000/api
VITE_API_KEY=your-api-key-here
```

3. **Start development server**

```bash
npm run dev
```

The dashboard will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

The production build will be in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
dashboard/
├── public/
│   └── index.html              # HTML template
├── src/
│   ├── api/
│   │   └── client.ts           # API client with Axios
│   ├── components/
│   │   ├── Layout.tsx          # Main layout with sidebar
│   │   ├── ExperimentList.tsx  # Experiments table
│   │   ├── ExperimentDetail.tsx # Experiment details page
│   │   ├── MetricsChart.tsx    # Chart visualizations
│   │   ├── ResultsTable.tsx    # Statistical results
│   │   └── CreateExperiment.tsx # Create form
│   ├── hooks/
│   │   ├── useExperiments.ts   # Experiment queries/mutations
│   │   ├── useAnalysis.ts      # Analysis queries
│   │   └── useRealtime.ts      # Real-time updates
│   ├── pages/
│   │   ├── Dashboard.tsx       # Home dashboard
│   │   └── Analytics.tsx       # Analytics page
│   ├── types/
│   │   └── index.ts            # TypeScript types
│   ├── App.tsx                 # Main app component
│   ├── index.tsx               # Entry point
│   └── index.css               # Global styles
├── package.json
├── tsconfig.json               # TypeScript config
├── vite.config.ts              # Vite config
├── tailwind.config.js          # Tailwind config
└── README.md
```

## API Integration

The dashboard expects the backend API to provide the following endpoints:

### Experiments

- `GET /api/experiments` - List experiments
- `GET /api/experiments/:id` - Get experiment
- `POST /api/experiments` - Create experiment
- `PUT /api/experiments/:id` - Update experiment
- `DELETE /api/experiments/:id` - Delete experiment
- `POST /api/experiments/:id/start` - Start experiment
- `POST /api/experiments/:id/pause` - Pause experiment
- `POST /api/experiments/:id/stop` - Stop experiment

### Analysis

- `GET /api/experiments/:id/analysis` - Get all analyses
- `GET /api/experiments/:id/analysis/latest` - Get latest analysis
- `POST /api/experiments/:id/analysis` - Run new analysis

### Assignments

- `GET /api/experiments/:id/assignments` - Get assignments
- `GET /api/experiments/:id/assignments/distribution` - Get distribution
- `POST /api/experiments/:id/assign` - Assign user

### Dashboard

- `GET /api/dashboard/stats` - Get dashboard statistics

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `/api` |
| `VITE_API_KEY` | API authentication key | - |

### Vite Proxy

The Vite dev server is configured to proxy `/api` requests to `http://localhost:8000` by default. You can modify this in `vite.config.ts`:

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

## Development

### Code Style

The project uses ESLint and Prettier for code formatting:

```bash
# Lint code
npm run lint

# Format code
npm run format
```

### TypeScript

TypeScript strict mode is enabled. All types are defined in `src/types/index.ts`.

### Dark Mode

Dark mode is controlled by the `dark` class on the root element. Toggle it using the moon/sun icon in the header.

### Real-time Updates

Running experiments automatically update every 5 seconds via polling. This can be configured in the `useRealtime` hook.

## Key Features Explained

### Real-time Monitoring

The dashboard uses React Query with polling to provide real-time updates for:
- Running experiments (5-second interval)
- Latest analysis results (5-second interval when running)
- Assignment distributions (10-second interval)

### Statistical Visualization

**MetricsChart Component**:
- Line charts for time-series data
- Bar charts for variant comparison
- Color-coded significance
- Interactive tooltips

**ResultsTable Component**:
- Primary, secondary, and guardrail metrics
- Confidence intervals (95%)
- P-values and statistical significance
- Effect size and relative lift
- Guardrail violation warnings

### Form Validation

The CreateExperiment form includes:
- Required field validation
- Variant allocation validation (must sum to 100%)
- At least 2 variants required
- At least 1 metric required

### Error Handling

- API errors shown in UI
- Loading states for all async operations
- Empty states for no data
- 401 redirects to login (if configured)

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Performance

- Code splitting with React Router
- React Query caching
- Lazy loading of routes
- Optimized bundle size

## Troubleshooting

### API Connection Issues

If the dashboard can't connect to the API:

1. Check that the backend is running
2. Verify `VITE_API_URL` in `.env`
3. Check the browser console for CORS errors
4. Verify the Vite proxy configuration

### Build Errors

If you encounter build errors:

1. Delete `node_modules` and `package-lock.json`
2. Run `npm install` again
3. Ensure Node.js version is 18+

### TypeScript Errors

If you see TypeScript errors:

1. Run `npm run build` to see full error details
2. Check `tsconfig.json` configuration
3. Ensure all types are properly imported

## Future Enhancements

- [ ] WebSocket support for true real-time updates
- [ ] Advanced analytics page
- [ ] Experiment templates
- [ ] Bulk operations
- [ ] Export results to CSV/PDF
- [ ] User permissions and roles
- [ ] Experiment scheduling
- [ ] A/A test detection
- [ ] Power analysis calculator
- [ ] Sequential testing support

## License

See parent project LICENSE file.

## Support

For issues and questions, please refer to the main project repository.
