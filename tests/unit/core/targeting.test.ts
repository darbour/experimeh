/**
 * Unit Tests for Targeting Rule Evaluation
 * Tests all operators, nested rules, and edge cases
 */

import {
  evaluateRule,
  validateRule,
  createCondition,
  createANDRule,
  createORRule,
  createNOTRule,
  parseRule,
  serializeRule,
  optimizeRule,
  Operator,
  Rule,
  EvaluationContext,
} from '../../../src/core/targeting';

describe('Targeting Rule Evaluation', () => {
  describe('Simple Condition Operators', () => {
    describe('equals operator', () => {
      it('should match when values are equal', () => {
        const rule = createANDRule([
          createCondition('user.country', 'equals', 'US'),
        ]);
        const context = { user: { country: 'US' } };

        const result = evaluateRule(rule, context);
        expect(result.matches).toBe(true);
      });

      it('should not match when values are different', () => {
        const rule = createANDRule([
          createCondition('user.country', 'equals', 'US'),
        ]);
        const context = { user: { country: 'UK' } };

        const result = evaluateRule(rule, context);
        expect(result.matches).toBe(false);
      });

      it('should handle case sensitivity', () => {
        const rule = createANDRule([
          createCondition('user.name', 'equals', 'John'),
        ]);
        const context = { user: { name: 'john' } };

        const result = evaluateRule(rule, context);
        expect(result.matches).toBe(false);
      });

      it('should handle case insensitive mode', () => {
        const rule = createANDRule([
          createCondition('user.name', 'equals', 'John'),
        ]);
        const context = { user: { name: 'john' } };

        const result = evaluateRule(rule, context, { caseInsensitive: true });
        expect(result.matches).toBe(true);
      });
    });

    describe('not_equals operator', () => {
      it('should match when values are different', () => {
        const rule = createANDRule([
          createCondition('user.country', 'not_equals', 'US'),
        ]);
        const context = { user: { country: 'UK' } };

        const result = evaluateRule(rule, context);
        expect(result.matches).toBe(true);
      });

      it('should not match when values are equal', () => {
        const rule = createANDRule([
          createCondition('user.country', 'not_equals', 'US'),
        ]);
        const context = { user: { country: 'US' } };

        const result = evaluateRule(rule, context);
        expect(result.matches).toBe(false);
      });
    });

    describe('numeric comparison operators', () => {
      it('should handle greater_than', () => {
        const rule = createANDRule([
          createCondition('user.age', 'greater_than', 18),
        ]);

        expect(evaluateRule(rule, { user: { age: 25 } }).matches).toBe(true);
        expect(evaluateRule(rule, { user: { age: 18 } }).matches).toBe(false);
        expect(evaluateRule(rule, { user: { age: 10 } }).matches).toBe(false);
      });

      it('should handle greater_than_or_equal', () => {
        const rule = createANDRule([
          createCondition('user.age', 'greater_than_or_equal', 18),
        ]);

        expect(evaluateRule(rule, { user: { age: 25 } }).matches).toBe(true);
        expect(evaluateRule(rule, { user: { age: 18 } }).matches).toBe(true);
        expect(evaluateRule(rule, { user: { age: 10 } }).matches).toBe(false);
      });

      it('should handle less_than', () => {
        const rule = createANDRule([
          createCondition('user.age', 'less_than', 18),
        ]);

        expect(evaluateRule(rule, { user: { age: 10 } }).matches).toBe(true);
        expect(evaluateRule(rule, { user: { age: 18 } }).matches).toBe(false);
        expect(evaluateRule(rule, { user: { age: 25 } }).matches).toBe(false);
      });

      it('should handle less_than_or_equal', () => {
        const rule = createANDRule([
          createCondition('user.age', 'less_than_or_equal', 18),
        ]);

        expect(evaluateRule(rule, { user: { age: 10 } }).matches).toBe(true);
        expect(evaluateRule(rule, { user: { age: 18 } }).matches).toBe(true);
        expect(evaluateRule(rule, { user: { age: 25 } }).matches).toBe(false);
      });

      it('should handle type coercion for numbers', () => {
        const rule = createANDRule([
          createCondition('user.age', 'greater_than', 18),
        ]);
        const context = { user: { age: '25' } };

        const result = evaluateRule(rule, context, { coerceTypes: true });
        expect(result.matches).toBe(true);
      });

      it('should fail without type coercion', () => {
        const rule = createANDRule([
          createCondition('user.age', 'greater_than', 18),
        ]);
        const context = { user: { age: '25' } };

        const result = evaluateRule(rule, context, { coerceTypes: false });
        expect(result.matches).toBe(false);
      });
    });

    describe('in and not_in operators', () => {
      it('should match when value is in array', () => {
        const rule = createANDRule([
          createCondition('user.country', 'in', ['US', 'UK', 'CA']),
        ]);

        expect(evaluateRule(rule, { user: { country: 'US' } }).matches).toBe(true);
        expect(evaluateRule(rule, { user: { country: 'UK' } }).matches).toBe(true);
        expect(evaluateRule(rule, { user: { country: 'FR' } }).matches).toBe(false);
      });

      it('should match when value is not in array', () => {
        const rule = createANDRule([
          createCondition('user.country', 'not_in', ['US', 'UK', 'CA']),
        ]);

        expect(evaluateRule(rule, { user: { country: 'FR' } }).matches).toBe(true);
        expect(evaluateRule(rule, { user: { country: 'US' } }).matches).toBe(false);
      });

      it('should handle numeric arrays', () => {
        const rule = createANDRule([
          createCondition('user.tier', 'in', [1, 2, 3]),
        ]);

        expect(evaluateRule(rule, { user: { tier: 2 } }).matches).toBe(true);
        expect(evaluateRule(rule, { user: { tier: 5 } }).matches).toBe(false);
      });
    });

    describe('contains operator', () => {
      it('should match when string contains substring', () => {
        const rule = createANDRule([
          createCondition('user.email', 'contains', '@example.com'),
        ]);

        expect(evaluateRule(rule, { user: { email: 'test@example.com' } }).matches).toBe(true);
        expect(evaluateRule(rule, { user: { email: 'test@other.com' } }).matches).toBe(false);
      });

      it('should match when array contains value', () => {
        const rule = createANDRule([
          createCondition('user.tags', 'contains', 'premium'),
        ]);

        const context = { user: { tags: ['premium', 'verified'] } };
        expect(evaluateRule(rule, context).matches).toBe(true);

        const context2 = { user: { tags: ['basic', 'verified'] } };
        expect(evaluateRule(rule, context2).matches).toBe(false);
      });

      it('should handle case insensitive contains', () => {
        const rule = createANDRule([
          createCondition('user.name', 'contains', 'john'),
        ]);

        const context = { user: { name: 'Johnny' } };
        expect(evaluateRule(rule, context, { caseInsensitive: true }).matches).toBe(true);
      });
    });

    describe('starts_with and ends_with operators', () => {
      it('should match string prefix', () => {
        const rule = createANDRule([
          createCondition('user.email', 'starts_with', 'admin'),
        ]);

        expect(evaluateRule(rule, { user: { email: 'admin@example.com' } }).matches).toBe(true);
        expect(evaluateRule(rule, { user: { email: 'user@example.com' } }).matches).toBe(false);
      });

      it('should match string suffix', () => {
        const rule = createANDRule([
          createCondition('user.email', 'ends_with', '.com'),
        ]);

        expect(evaluateRule(rule, { user: { email: 'test@example.com' } }).matches).toBe(true);
        expect(evaluateRule(rule, { user: { email: 'test@example.org' } }).matches).toBe(false);
      });
    });

    describe('matches_regex operator', () => {
      it('should match regex pattern', () => {
        const rule = createANDRule([
          createCondition('user.email', 'matches_regex', '^[a-z]+@[a-z]+\\.[a-z]+$'),
        ]);

        expect(evaluateRule(rule, { user: { email: 'test@example.com' } }).matches).toBe(true);
        expect(evaluateRule(rule, { user: { email: 'Test@Example.Com' } }).matches).toBe(false);
      });

      it('should handle case insensitive regex', () => {
        const rule = createANDRule([
          createCondition('user.email', 'matches_regex', '^[a-z]+@[a-z]+\\.[a-z]+$'),
        ]);

        const context = { user: { email: 'Test@Example.Com' } };
        expect(evaluateRule(rule, context, { caseInsensitive: true }).matches).toBe(true);
      });

      it('should handle invalid regex gracefully', () => {
        const rule = createANDRule([
          createCondition('user.email', 'matches_regex', '[invalid(regex'),
        ]);

        const result = evaluateRule(rule, { user: { email: 'test@example.com' } });
        expect(result.matches).toBe(false);
        expect(result.errors).toBeDefined();
      });
    });

    describe('exists and not_exists operators', () => {
      it('should check if field exists', () => {
        const rule = createANDRule([
          createCondition('user.email', 'exists', true),
        ]);

        expect(evaluateRule(rule, { user: { email: 'test@example.com' } }).matches).toBe(true);
        expect(evaluateRule(rule, { user: {} }).matches).toBe(false);
      });

      it('should check if field does not exist', () => {
        const rule = createANDRule([
          createCondition('user.premium', 'not_exists', true),
        ]);

        expect(evaluateRule(rule, { user: {} }).matches).toBe(true);
        expect(evaluateRule(rule, { user: { premium: true } }).matches).toBe(false);
      });

      it('should treat null as not exists', () => {
        const rule = createANDRule([
          createCondition('user.value', 'not_exists', true),
        ]);

        expect(evaluateRule(rule, { user: { value: null } }).matches).toBe(true);
      });
    });
  });

  describe('Logical Operators', () => {
    describe('AND operator', () => {
      it('should match when all conditions are true', () => {
        const rule = createANDRule([
          createCondition('user.country', 'equals', 'US'),
          createCondition('user.age', 'greater_than', 18),
          createCondition('user.premium', 'equals', true),
        ]);

        const context = { user: { country: 'US', age: 25, premium: true } };
        expect(evaluateRule(rule, context).matches).toBe(true);
      });

      it('should not match when any condition is false', () => {
        const rule = createANDRule([
          createCondition('user.country', 'equals', 'US'),
          createCondition('user.age', 'greater_than', 18),
          createCondition('user.premium', 'equals', true),
        ]);

        const context = { user: { country: 'US', age: 25, premium: false } };
        expect(evaluateRule(rule, context).matches).toBe(false);
      });

      it('should short-circuit on first false condition', () => {
        const rule = createANDRule([
          createCondition('user.country', 'equals', 'UK'),
          createCondition('user.nonexistent', 'equals', 'value'),
        ]);

        const context = { user: { country: 'US' } };
        const result = evaluateRule(rule, context);
        expect(result.matches).toBe(false);
      });
    });

    describe('OR operator', () => {
      it('should match when any condition is true', () => {
        const rule = createORRule([
          createCondition('user.country', 'equals', 'US'),
          createCondition('user.country', 'equals', 'UK'),
          createCondition('user.country', 'equals', 'CA'),
        ]);

        expect(evaluateRule(rule, { user: { country: 'UK' } }).matches).toBe(true);
        expect(evaluateRule(rule, { user: { country: 'FR' } }).matches).toBe(false);
      });

      it('should not match when all conditions are false', () => {
        const rule = createORRule([
          createCondition('user.age', 'less_than', 13),
          createCondition('user.age', 'greater_than', 65),
        ]);

        const context = { user: { age: 30 } };
        expect(evaluateRule(rule, context).matches).toBe(false);
      });

      it('should short-circuit on first true condition', () => {
        const rule = createORRule([
          createCondition('user.country', 'equals', 'US'),
          createCondition('user.nonexistent', 'equals', 'value'),
        ]);

        const context = { user: { country: 'US' } };
        const result = evaluateRule(rule, context);
        expect(result.matches).toBe(true);
      });
    });

    describe('NOT operator', () => {
      it('should negate condition result', () => {
        const rule = createNOTRule(
          createCondition('user.country', 'equals', 'US')
        );

        expect(evaluateRule(rule, { user: { country: 'UK' } }).matches).toBe(true);
        expect(evaluateRule(rule, { user: { country: 'US' } }).matches).toBe(false);
      });

      it('should negate nested rule result', () => {
        const innerRule = createANDRule([
          createCondition('user.age', 'greater_than', 18),
          createCondition('user.country', 'equals', 'US'),
        ]);
        const rule = createNOTRule(innerRule);

        const context = { user: { age: 25, country: 'US' } };
        expect(evaluateRule(rule, context).matches).toBe(false);

        const context2 = { user: { age: 25, country: 'UK' } };
        expect(evaluateRule(rule, context2).matches).toBe(true);
      });
    });
  });

  describe('Nested Rules', () => {
    it('should handle deeply nested AND/OR combinations', () => {
      const rule: Rule = {
        operator: 'AND',
        conditions: [
          createCondition('user.age', 'greater_than', 18),
        ],
        rules: [
          {
            operator: 'OR',
            conditions: [
              createCondition('user.country', 'equals', 'US'),
              createCondition('user.country', 'equals', 'UK'),
            ],
          },
        ],
      };

      const context1 = { user: { age: 25, country: 'US' } };
      expect(evaluateRule(rule, context1).matches).toBe(true);

      const context2 = { user: { age: 25, country: 'FR' } };
      expect(evaluateRule(rule, context2).matches).toBe(false);

      const context3 = { user: { age: 15, country: 'US' } };
      expect(evaluateRule(rule, context3).matches).toBe(false);
    });

    it('should handle complex nested structure', () => {
      const rule: Rule = {
        operator: 'OR',
        rules: [
          {
            operator: 'AND',
            conditions: [
              createCondition('user.tier', 'equals', 'premium'),
              createCondition('user.verified', 'equals', true),
            ],
          },
          {
            operator: 'AND',
            conditions: [
              createCondition('user.tier', 'equals', 'enterprise'),
            ],
          },
        ],
      };

      const context1 = { user: { tier: 'premium', verified: true } };
      expect(evaluateRule(rule, context1).matches).toBe(true);

      const context2 = { user: { tier: 'premium', verified: false } };
      expect(evaluateRule(rule, context2).matches).toBe(false);

      const context3 = { user: { tier: 'enterprise', verified: false } };
      expect(evaluateRule(rule, context3).matches).toBe(true);
    });
  });

  describe('Dot Notation Path Resolution', () => {
    it('should resolve nested object paths', () => {
      const rule = createANDRule([
        createCondition('user.profile.country', 'equals', 'US'),
      ]);

      const context = { user: { profile: { country: 'US' } } };
      expect(evaluateRule(rule, context).matches).toBe(true);
    });

    it('should handle deep nesting', () => {
      const rule = createANDRule([
        createCondition('user.settings.privacy.sharing', 'equals', true),
      ]);

      const context = {
        user: {
          settings: {
            privacy: {
              sharing: true,
            },
          },
        },
      };
      expect(evaluateRule(rule, context).matches).toBe(true);
    });

    it('should return false for non-existent paths', () => {
      const rule = createANDRule([
        createCondition('user.nonexistent.field', 'equals', 'value'),
      ]);

      const context = { user: {} };
      expect(evaluateRule(rule, context).matches).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null values', () => {
      const rule = createANDRule([
        createCondition('user.value', 'equals', null),
      ]);

      expect(evaluateRule(rule, { user: { value: null } }).matches).toBe(true);
      expect(evaluateRule(rule, { user: { value: 'something' } }).matches).toBe(false);
    });

    it('should handle undefined values', () => {
      const rule = createANDRule([
        createCondition('user.missing', 'equals', 'value'),
      ]);

      const context = { user: {} };
      expect(evaluateRule(rule, context).matches).toBe(false);
    });

    it('should handle boolean values', () => {
      const rule = createANDRule([
        createCondition('user.active', 'equals', true),
      ]);

      expect(evaluateRule(rule, { user: { active: true } }).matches).toBe(true);
      expect(evaluateRule(rule, { user: { active: false } }).matches).toBe(false);
    });

    it('should handle numeric zero', () => {
      const rule = createANDRule([
        createCondition('user.count', 'equals', 0),
      ]);

      expect(evaluateRule(rule, { user: { count: 0 } }).matches).toBe(true);
      expect(evaluateRule(rule, { user: { count: 1 } }).matches).toBe(false);
    });

    it('should handle empty strings', () => {
      const rule = createANDRule([
        createCondition('user.name', 'equals', ''),
      ]);

      expect(evaluateRule(rule, { user: { name: '' } }).matches).toBe(true);
      expect(evaluateRule(rule, { user: { name: 'John' } }).matches).toBe(false);
    });

    it('should handle empty arrays', () => {
      const rule = createANDRule([
        createCondition('user.tags', 'contains', 'test'),
      ]);

      const context = { user: { tags: [] } };
      expect(evaluateRule(rule, context).matches).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should collect errors without throwing in non-strict mode', () => {
      const rule = createANDRule([
        createCondition('user.value', 'matches_regex', '[invalid('),
      ]);

      const result = evaluateRule(rule, { user: { value: 'test' } });
      expect(result.matches).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should throw in strict mode', () => {
      const rule = createANDRule([
        createCondition('user.value', 'matches_regex', '[invalid('),
      ]);

      expect(() => {
        evaluateRule(rule, { user: { value: 'test' } }, { strictMode: true });
      }).toThrow();
    });
  });

  describe('validateRule', () => {
    it('should accept valid rules', () => {
      const rule = createANDRule([
        createCondition('user.country', 'equals', 'US'),
      ]);

      const errors = validateRule(rule);
      expect(errors).toEqual([]);
    });

    it('should detect missing operator', () => {
      const rule = { conditions: [] } as any;
      const errors = validateRule(rule);
      expect(errors.some(e => e.includes('operator'))).toBe(true);
    });

    it('should detect invalid operator', () => {
      const rule = { operator: 'INVALID' as any, conditions: [] };
      const errors = validateRule(rule);
      expect(errors.some(e => e.includes('Invalid logical operator'))).toBe(true);
    });

    it('should detect NOT with multiple items', () => {
      const rule = {
        operator: 'NOT' as const,
        conditions: [
          createCondition('user.a', 'equals', 'A'),
          createCondition('user.b', 'equals', 'B'),
        ],
      };
      const errors = validateRule(rule);
      expect(errors.some(e => e.includes('exactly one'))).toBe(true);
    });

    it('should recursively validate nested rules', () => {
      const rule: Rule = {
        operator: 'AND',
        rules: [
          {
            operator: 'INVALID' as any,
            conditions: [],
          },
        ],
      };
      const errors = validateRule(rule);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('parseRule and serializeRule', () => {
    it('should parse valid JSON rule', () => {
      const json = JSON.stringify({
        operator: 'AND',
        conditions: [
          { attribute: 'user.country', operator: 'equals', value: 'US' },
        ],
      });

      const rule = parseRule(json);
      expect(rule.operator).toBe('AND');
      expect(rule.conditions).toBeDefined();
    });

    it('should throw on invalid JSON', () => {
      expect(() => parseRule('invalid json')).toThrow();
    });

    it('should throw on invalid rule structure', () => {
      const json = JSON.stringify({
        operator: 'INVALID',
        conditions: [],
      });

      expect(() => parseRule(json)).toThrow();
    });

    it('should serialize and parse round-trip', () => {
      const rule = createANDRule([
        createCondition('user.country', 'equals', 'US'),
        createCondition('user.age', 'greater_than', 18),
      ]);

      const json = serializeRule(rule);
      const parsed = parseRule(json);

      expect(parsed).toEqual(rule);
    });
  });

  describe('optimizeRule', () => {
    it('should flatten nested rules with same operator', () => {
      const rule: Rule = {
        operator: 'AND',
        rules: [
          {
            operator: 'AND',
            conditions: [
              createCondition('user.a', 'equals', 'A'),
              createCondition('user.b', 'equals', 'B'),
            ],
          },
        ],
      };

      const optimized = optimizeRule(rule);
      expect(optimized.conditions?.length).toBe(2);
    });

    it('should not flatten NOT rules', () => {
      const rule: Rule = {
        operator: 'NOT',
        rules: [
          {
            operator: 'AND',
            conditions: [
              createCondition('user.a', 'equals', 'A'),
            ],
          },
        ],
      };

      const optimized = optimizeRule(rule);
      expect(optimized.rules?.length).toBe(1);
    });
  });
});
