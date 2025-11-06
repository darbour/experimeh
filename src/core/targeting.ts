/**
 * Targeting Rule Evaluation Engine
 *
 * This module provides a flexible, type-safe rule evaluation system for
 * targeting specific users or contexts in experiments and feature flags.
 *
 * Supports:
 * - Comparison operators (equals, not_equals, greater_than, less_than, etc.)
 * - Set operations (in, not_in)
 * - Pattern matching (matches_regex, contains)
 * - Boolean logic (AND, OR, NOT)
 * - Nested conditions
 * - Type coercion and null handling
 *
 * Performance: O(n) where n is number of conditions in rule tree
 *
 * References:
 * - "Rule Engines in Feature Flag Systems" - LaunchDarkly
 * - "Expression Evaluation Best Practices" - Martin Fowler
 */

/**
 * Supported operators for rule evaluation
 */
export type Operator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'not_contains'
  | 'matches_regex'
  | 'not_matches_regex'
  | 'exists'
  | 'not_exists'
  | 'starts_with'
  | 'ends_with';

/**
 * Logical operators for combining conditions
 */
export type LogicalOperator = 'AND' | 'OR' | 'NOT';

/**
 * Supported value types in conditions
 */
export type ConditionValue = string | number | boolean | null | string[] | number[];

/**
 * Context object containing user attributes and environment data
 */
export interface EvaluationContext {
  [key: string]: ConditionValue | EvaluationContext;
}

/**
 * Single condition in a targeting rule
 */
export interface Condition {
  attribute: string; // Dot-notation path (e.g., "user.country", "device.os")
  operator: Operator;
  value: ConditionValue;
}

/**
 * Composite rule with logical operators
 */
export interface Rule {
  operator: LogicalOperator;
  conditions?: Condition[];
  rules?: Rule[]; // Nested rules for complex logic
}

/**
 * Result of rule evaluation
 */
export interface EvaluationResult {
  matches: boolean;
  reason?: string;
  evaluatedConditions?: number;
  errors?: string[];
}

/**
 * Configuration for evaluation behavior
 */
export interface EvaluationConfig {
  strictMode?: boolean; // Throw on errors vs. return false
  caseInsensitive?: boolean; // Case-insensitive string comparisons
  coerceTypes?: boolean; // Automatic type coercion
}

/**
 * Main evaluation function for targeting rules
 * Recursively evaluates rule tree with logical operators
 *
 * Time Complexity: O(n) where n = total conditions
 * Space Complexity: O(d) where d = max depth of rule nesting
 *
 * @param rule - Rule to evaluate
 * @param context - Context with attributes to evaluate against
 * @param config - Optional evaluation configuration
 * @returns Evaluation result with match status
 *
 * @example
 * ```typescript
 * const rule = {
 *   operator: 'AND',
 *   conditions: [
 *     { attribute: 'user.country', operator: 'equals', value: 'US' },
 *     { attribute: 'user.age', operator: 'greater_than', value: 18 }
 *   ]
 * };
 * const context = { user: { country: 'US', age: 25 } };
 * const result = evaluateRule(rule, context);
 * // result.matches = true
 * ```
 */
export function evaluateRule(
  rule: Rule,
  context: EvaluationContext,
  config: EvaluationConfig = {}
): EvaluationResult {
  const errors: string[] = [];
  let evaluatedConditions = 0;

  try {
    const matches = evaluateRuleInternal(rule, context, config, errors, evaluatedConditions);

    return {
      matches,
      evaluatedConditions,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    if (config.strictMode) {
      throw error;
    }

    return {
      matches: false,
      reason: 'evaluation_error',
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Internal recursive rule evaluation
 */
function evaluateRuleInternal(
  rule: Rule,
  context: EvaluationContext,
  config: EvaluationConfig,
  errors: string[],
  evaluatedConditions: number
): boolean {
  switch (rule.operator) {
    case 'AND':
      return evaluateAND(rule, context, config, errors, evaluatedConditions);

    case 'OR':
      return evaluateOR(rule, context, config, errors, evaluatedConditions);

    case 'NOT':
      return evaluateNOT(rule, context, config, errors, evaluatedConditions);

    default:
      throw new Error(`Unknown logical operator: ${rule.operator}`);
  }
}

/**
 * Evaluate AND rule (all conditions must be true)
 */
function evaluateAND(
  rule: Rule,
  context: EvaluationContext,
  config: EvaluationConfig,
  errors: string[],
  evaluatedConditions: number
): boolean {
  // Evaluate direct conditions
  if (rule.conditions) {
    for (const condition of rule.conditions) {
      evaluatedConditions++;
      if (!evaluateCondition(condition, context, config, errors)) {
        return false;
      }
    }
  }

  // Evaluate nested rules
  if (rule.rules) {
    for (const nestedRule of rule.rules) {
      if (!evaluateRuleInternal(nestedRule, context, config, errors, evaluatedConditions)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Evaluate OR rule (at least one condition must be true)
 */
function evaluateOR(
  rule: Rule,
  context: EvaluationContext,
  config: EvaluationConfig,
  errors: string[],
  evaluatedConditions: number
): boolean {
  // Evaluate direct conditions
  if (rule.conditions) {
    for (const condition of rule.conditions) {
      evaluatedConditions++;
      if (evaluateCondition(condition, context, config, errors)) {
        return true;
      }
    }
  }

  // Evaluate nested rules
  if (rule.rules) {
    for (const nestedRule of rule.rules) {
      if (evaluateRuleInternal(nestedRule, context, config, errors, evaluatedConditions)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Evaluate NOT rule (negation)
 */
function evaluateNOT(
  rule: Rule,
  context: EvaluationContext,
  config: EvaluationConfig,
  errors: string[],
  evaluatedConditions: number
): boolean {
  if (rule.rules && rule.rules.length > 0) {
    return !evaluateRuleInternal(rule.rules[0], context, config, errors, evaluatedConditions);
  }

  if (rule.conditions && rule.conditions.length > 0) {
    return !evaluateCondition(rule.conditions[0], context, config, errors);
  }

  throw new Error('NOT operator requires at least one condition or rule');
}

/**
 * Evaluate a single condition
 * Extracts attribute from context and applies operator
 *
 * @param condition - Condition to evaluate
 * @param context - Context with attributes
 * @param config - Evaluation configuration
 * @param errors - Array to collect errors
 * @returns true if condition matches
 */
function evaluateCondition(
  condition: Condition,
  context: EvaluationContext,
  config: EvaluationConfig,
  errors: string[]
): boolean {
  try {
    // Extract attribute value from context using dot notation
    const attributeValue = getAttributeValue(context, condition.attribute);

    // Apply operator
    return applyOperator(
      condition.operator,
      attributeValue,
      condition.value,
      config
    );
  } catch (error) {
    errors.push(`Error evaluating condition ${condition.attribute}: ${error}`);
    return false;
  }
}

/**
 * Extract attribute value from context using dot notation
 * Supports nested objects: "user.profile.country"
 *
 * @param context - Context object
 * @param path - Dot-notation path to attribute
 * @returns Attribute value or undefined
 */
function getAttributeValue(
  context: EvaluationContext,
  path: string
): ConditionValue | EvaluationContext | undefined {
  const parts = path.split('.');
  let current: any = context;

  for (const part of parts) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

/**
 * Apply comparison operator to values
 * Handles type coercion, null values, and various comparison types
 *
 * @param operator - Comparison operator
 * @param attributeValue - Value from context
 * @param conditionValue - Value from condition
 * @param config - Evaluation configuration
 * @returns true if comparison passes
 */
function applyOperator(
  operator: Operator,
  attributeValue: ConditionValue | EvaluationContext | undefined,
  conditionValue: ConditionValue,
  config: EvaluationConfig
): boolean {
  switch (operator) {
    case 'equals':
      return compareEquals(attributeValue, conditionValue, config);

    case 'not_equals':
      return !compareEquals(attributeValue, conditionValue, config);

    case 'greater_than':
      return compareNumeric(attributeValue, conditionValue, (a, b) => a > b, config);

    case 'greater_than_or_equal':
      return compareNumeric(attributeValue, conditionValue, (a, b) => a >= b, config);

    case 'less_than':
      return compareNumeric(attributeValue, conditionValue, (a, b) => a < b, config);

    case 'less_than_or_equal':
      return compareNumeric(attributeValue, conditionValue, (a, b) => a <= b, config);

    case 'in':
      return compareIn(attributeValue, conditionValue, config);

    case 'not_in':
      return !compareIn(attributeValue, conditionValue, config);

    case 'contains':
      return compareContains(attributeValue, conditionValue, config);

    case 'not_contains':
      return !compareContains(attributeValue, conditionValue, config);

    case 'matches_regex':
      return compareRegex(attributeValue, conditionValue, config);

    case 'not_matches_regex':
      return !compareRegex(attributeValue, conditionValue, config);

    case 'exists':
      return attributeValue !== undefined && attributeValue !== null;

    case 'not_exists':
      return attributeValue === undefined || attributeValue === null;

    case 'starts_with':
      return compareStartsWith(attributeValue, conditionValue, config);

    case 'ends_with':
      return compareEndsWith(attributeValue, conditionValue, config);

    default:
      throw new Error(`Unknown operator: ${operator}`);
  }
}

/**
 * Equality comparison with type coercion support
 */
function compareEquals(
  attributeValue: any,
  conditionValue: ConditionValue,
  config: EvaluationConfig
): boolean {
  // Handle null/undefined
  if (attributeValue == null || conditionValue == null) {
    return attributeValue === conditionValue;
  }

  // String comparison with case sensitivity option
  if (typeof attributeValue === 'string' && typeof conditionValue === 'string') {
    if (config.caseInsensitive) {
      return attributeValue.toLowerCase() === conditionValue.toLowerCase();
    }
    return attributeValue === conditionValue;
  }

  // Type coercion if enabled
  if (config.coerceTypes) {
    return String(attributeValue) === String(conditionValue);
  }

  // Strict equality
  return attributeValue === conditionValue;
}

/**
 * Numeric comparison with type coercion
 */
function compareNumeric(
  attributeValue: any,
  conditionValue: ConditionValue,
  compareFn: (a: number, b: number) => boolean,
  config: EvaluationConfig
): boolean {
  const attrNum = typeof attributeValue === 'number'
    ? attributeValue
    : config.coerceTypes
    ? Number(attributeValue)
    : NaN;

  const condNum = typeof conditionValue === 'number'
    ? conditionValue
    : config.coerceTypes
    ? Number(conditionValue)
    : NaN;

  if (isNaN(attrNum) || isNaN(condNum)) {
    return false;
  }

  return compareFn(attrNum, condNum);
}

/**
 * Set membership comparison (in/not_in)
 */
function compareIn(
  attributeValue: any,
  conditionValue: ConditionValue,
  config: EvaluationConfig
): boolean {
  if (!Array.isArray(conditionValue)) {
    throw new Error('in/not_in operator requires array value');
  }

  if (attributeValue == null) {
    return false;
  }

  return conditionValue.some((item) => compareEquals(attributeValue, item, config));
}

/**
 * String/array contains comparison
 */
function compareContains(
  attributeValue: any,
  conditionValue: ConditionValue,
  config: EvaluationConfig
): boolean {
  if (attributeValue == null || conditionValue == null) {
    return false;
  }

  // Array contains
  if (Array.isArray(attributeValue)) {
    return attributeValue.some((item) => compareEquals(item, conditionValue, config));
  }

  // String contains
  if (typeof attributeValue === 'string' && typeof conditionValue === 'string') {
    if (config.caseInsensitive) {
      return attributeValue.toLowerCase().includes(conditionValue.toLowerCase());
    }
    return attributeValue.includes(conditionValue);
  }

  return false;
}

/**
 * Regex pattern matching
 */
function compareRegex(
  attributeValue: any,
  conditionValue: ConditionValue,
  config: EvaluationConfig
): boolean {
  if (attributeValue == null || typeof conditionValue !== 'string') {
    return false;
  }

  try {
    const flags = config.caseInsensitive ? 'i' : '';
    const regex = new RegExp(conditionValue, flags);
    return regex.test(String(attributeValue));
  } catch (error) {
    throw new Error(`Invalid regex pattern: ${conditionValue}`);
  }
}

/**
 * String starts_with comparison
 */
function compareStartsWith(
  attributeValue: any,
  conditionValue: ConditionValue,
  config: EvaluationConfig
): boolean {
  if (typeof attributeValue !== 'string' || typeof conditionValue !== 'string') {
    return false;
  }

  if (config.caseInsensitive) {
    return attributeValue.toLowerCase().startsWith(conditionValue.toLowerCase());
  }

  return attributeValue.startsWith(conditionValue);
}

/**
 * String ends_with comparison
 */
function compareEndsWith(
  attributeValue: any,
  conditionValue: ConditionValue,
  config: EvaluationConfig
): boolean {
  if (typeof attributeValue !== 'string' || typeof conditionValue !== 'string') {
    return false;
  }

  if (config.caseInsensitive) {
    return attributeValue.toLowerCase().endsWith(conditionValue.toLowerCase());
  }

  return attributeValue.endsWith(conditionValue);
}

/**
 * Validate rule structure
 * Checks for common configuration errors
 *
 * @param rule - Rule to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateRule(rule: Rule): string[] {
  const errors: string[] = [];

  if (!rule.operator) {
    errors.push('Rule must have an operator');
    return errors;
  }

  if (!['AND', 'OR', 'NOT'].includes(rule.operator)) {
    errors.push(`Invalid logical operator: ${rule.operator}`);
  }

  if (rule.operator === 'NOT') {
    const totalItems = (rule.conditions?.length || 0) + (rule.rules?.length || 0);
    if (totalItems !== 1) {
      errors.push('NOT operator requires exactly one condition or rule');
    }
  }

  if (!rule.conditions && !rule.rules) {
    errors.push('Rule must have conditions or nested rules');
  }

  // Validate conditions
  if (rule.conditions) {
    for (let i = 0; i < rule.conditions.length; i++) {
      const condition = rule.conditions[i];
      if (!condition.attribute) {
        errors.push(`Condition ${i}: attribute is required`);
      }
      if (!condition.operator) {
        errors.push(`Condition ${i}: operator is required`);
      }
      if (condition.value === undefined) {
        errors.push(`Condition ${i}: value is required`);
      }
    }
  }

  // Recursively validate nested rules
  if (rule.rules) {
    for (let i = 0; i < rule.rules.length; i++) {
      const nestedErrors = validateRule(rule.rules[i]);
      errors.push(...nestedErrors.map((e) => `Nested rule ${i}: ${e}`));
    }
  }

  return errors;
}

/**
 * Helper to create simple condition rules
 */
export function createCondition(
  attribute: string,
  operator: Operator,
  value: ConditionValue
): Condition {
  return { attribute, operator, value };
}

/**
 * Helper to create AND rule
 */
export function createANDRule(conditions: Condition[], rules?: Rule[]): Rule {
  return {
    operator: 'AND',
    conditions,
    rules,
  };
}

/**
 * Helper to create OR rule
 */
export function createORRule(conditions: Condition[], rules?: Rule[]): Rule {
  return {
    operator: 'OR',
    conditions,
    rules,
  };
}

/**
 * Helper to create NOT rule
 */
export function createNOTRule(condition: Condition | Rule): Rule {
  if ('attribute' in condition) {
    return {
      operator: 'NOT',
      conditions: [condition],
    };
  } else {
    return {
      operator: 'NOT',
      rules: [condition],
    };
  }
}

/**
 * Performance testing utility
 * Measures rule evaluation performance
 *
 * @param rule - Rule to benchmark
 * @param context - Context for evaluation
 * @param iterations - Number of iterations
 * @returns Average evaluation time in milliseconds
 */
export function benchmarkRuleEvaluation(
  rule: Rule,
  context: EvaluationContext,
  iterations: number = 10000
): number {
  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    evaluateRule(rule, context);
  }

  const endTime = performance.now();
  return (endTime - startTime) / iterations;
}

/**
 * Parse rule from JSON string
 * Validates and returns typed rule object
 *
 * @param json - JSON string representation of rule
 * @returns Parsed rule
 */
export function parseRule(json: string): Rule {
  try {
    const rule = JSON.parse(json) as Rule;
    const errors = validateRule(rule);

    if (errors.length > 0) {
      throw new Error(`Invalid rule: ${errors.join(', ')}`);
    }

    return rule;
  } catch (error) {
    throw new Error(`Failed to parse rule: ${error}`);
  }
}

/**
 * Serialize rule to JSON string
 *
 * @param rule - Rule to serialize
 * @returns JSON string representation
 */
export function serializeRule(rule: Rule): string {
  return JSON.stringify(rule, null, 2);
}

/**
 * Optimize rule by removing redundant conditions
 * Simplifies rule tree for faster evaluation
 *
 * @param rule - Rule to optimize
 * @returns Optimized rule
 */
export function optimizeRule(rule: Rule): Rule {
  // Remove empty conditions/rules
  const optimized: Rule = { operator: rule.operator };

  if (rule.conditions && rule.conditions.length > 0) {
    optimized.conditions = rule.conditions;
  }

  if (rule.rules && rule.rules.length > 0) {
    optimized.rules = rule.rules.map(optimizeRule);
  }

  // Flatten nested rules with same operator
  if (optimized.rules && rule.operator !== 'NOT') {
    const flattened: Rule[] = [];
    for (const nestedRule of optimized.rules) {
      if (nestedRule.operator === rule.operator) {
        // Same operator - can flatten
        if (nestedRule.conditions) {
          optimized.conditions = [...(optimized.conditions || []), ...nestedRule.conditions];
        }
        if (nestedRule.rules) {
          flattened.push(...nestedRule.rules);
        }
      } else {
        flattened.push(nestedRule);
      }
    }
    optimized.rules = flattened.length > 0 ? flattened : undefined;
  }

  return optimized;
}
