/**
 * Rule Engine Registry
 *
 * Central registry for all rule engines. Allows looking up engines by goal type.
 */

import type { GoalType, Jurisdiction, RuleEngine, GoalConfig } from './types';

class RuleEngineRegistry {
  private engines = new Map<GoalType, RuleEngine>();

  /**
   * Register a rule engine
   */
  register<T extends GoalConfig>(engine: RuleEngine<T>): void {
    this.engines.set(engine.goalType, engine as RuleEngine);
  }

  /**
   * Get a rule engine by goal type
   */
  get(type: GoalType): RuleEngine | undefined {
    return this.engines.get(type);
  }

  /**
   * Get all registered rule engines
   */
  getAll(): RuleEngine[] {
    return Array.from(this.engines.values());
  }

  /**
   * Get rule engines for a specific jurisdiction
   */
  getByJurisdiction(jurisdiction: Jurisdiction): RuleEngine[] {
    return this.getAll().filter(e => e.jurisdiction === jurisdiction);
  }

  /**
   * Check if a goal type is supported
   */
  isSupported(type: GoalType): boolean {
    return this.engines.has(type);
  }
}

// Singleton instance
export const ruleEngineRegistry = new RuleEngineRegistry();
