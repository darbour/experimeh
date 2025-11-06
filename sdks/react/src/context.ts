/**
 * React Context for Experimeh
 */

import { createContext } from 'react';
import { ExperimentContextValue } from './types';

export const ExperimentContext = createContext<ExperimentContextValue | null>(null);

ExperimentContext.displayName = 'ExperimentContext';
