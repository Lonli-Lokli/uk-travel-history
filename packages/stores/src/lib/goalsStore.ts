/**
 * Goals Store
 * Manages user tracking goals and their calculations
 *
 * HYDRATION STRATEGY:
 * - Goals and calculations are loaded server-side in loadAccessContext()
 * - This store is hydrated from AccessContext in Providers.tsx
 * - Client-side recalculations happen when trips change
 *
 * IMPORTANT: This store does NOT fetch data itself. All initial data comes from:
 * 1. Initial hydration via AccessContext (from loadAccessContext())
 * 2. Re-hydration after router.refresh() when auth state changes
 * 3. API calls for CRUD operations (create, update, delete)
 */

import {
  makeAutoObservable,
  runInAction,
  reaction,
  IReactionDisposer,
} from 'mobx';
import type {
  TrackingGoalData,
  GoalCalculationData,
  CreateTrackingGoalData,
  UpdateTrackingGoalData,
  GoalTemplateWithAccess,
  GoalType,
  GoalJurisdiction,
} from '@uth/db';

class GoalsStore {
  // ============================================================================
  // State
  // ============================================================================

  /** User's tracking goals (hydrated from server) */
  goals: TrackingGoalData[] = [];

  /** Pre-computed calculations for each goal (keyed by goal ID) */
  calculations: Map<string, GoalCalculationData> = new Map();

  /** Currently selected/active goal ID */
  activeGoalId: string | null = null;

  /** Loading state for API operations */
  isLoading = false;

  /** Error message from last failed operation */
  error: string | null = null;

  /** Whether the multi-goal feature is enabled for this user */
  isFeatureEnabled = false;

  /** Whether store has been hydrated with server data */
  isHydrated = false;

  /** Reaction disposer for trip change observation (not observable) */
  tripReactionDisposer: IReactionDisposer | null = null;

  // ============================================================================
  // Templates State (hydrated from server)
  // ============================================================================

  /** Available goal templates (hydrated from server) */
  templates: GoalTemplateWithAccess[] = [];

  // ============================================================================
  // Add Goal Modal UI State
  // ============================================================================

  /** Whether the add goal modal is open */
  isAddModalOpen = false;

  /** Current step in add goal wizard */
  addModalStep: 'category' | 'template' | 'configure' = 'category';

  /** Selected goal category */
  selectedCategory: 'immigration' | 'tax' | 'personal' | null = null;

  /** Selected template for new goal */
  selectedTemplate: GoalTemplateWithAccess | null = null;

  /** Form data for configuring new goal */
  addModalFormData: Record<string, string> = {};

  /** Whether goal is being created */
  isCreating = false;

  /** Error from add modal operations */
  addModalError: string | null = null;

  constructor() {
    makeAutoObservable(this, {
      // Exclude disposer from observability
      tripReactionDisposer: false,
      // Exclude private methods from being treated as actions
      disposeTripReaction: false,
    });
  }

  // ============================================================================
  // Computed Properties
  // ============================================================================

  /** Check if user has any goals */
  get hasGoals(): boolean {
    return this.goals.length > 0;
  }

  /** Get active (non-archived) goals sorted by display order */
  get activeGoals(): TrackingGoalData[] {
    return this.goals
      .filter((g) => g.isActive && !g.isArchived)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  /** Get the currently selected goal (or first active goal if none selected) */
  get activeGoal(): TrackingGoalData | null {
    if (this.activeGoalId) {
      const goal = this.goals.find((g) => g.id === this.activeGoalId);
      if (goal) return goal;
    }
    return this.activeGoals[0] ?? null;
  }

  /** Get the calculation for the currently active goal */
  get activeCalculation(): GoalCalculationData | null {
    if (!this.activeGoal) return null;
    return this.calculations.get(this.activeGoal.id) ?? null;
  }

  /** Get count of active (non-archived) goals */
  get activeGoalCount(): number {
    return this.activeGoals.length;
  }

  /** Get templates filtered by selected category */
  get filteredTemplates(): GoalTemplateWithAccess[] {
    if (!this.selectedCategory) return [];
    return this.templates.filter((t) => t.category === this.selectedCategory);
  }

  /** Check if templates are loading (for backward compat - always false with server hydration) */
  get isLoadingTemplates(): boolean {
    return false; // Templates are hydrated from server, no client-side loading
  }

  // ============================================================================
  // Hydration (called from Providers.tsx with server-loaded data)
  // ============================================================================

  /**
   * Hydrate store with server-loaded goals data.
   * This prevents flicker by having data ready immediately on page render.
   *
   * @param goals - User's goals from AccessContext (null if feature disabled)
   * @param calculations - Pre-computed calculations from AccessContext
   * @param isFeatureEnabled - Whether the multi-goal feature is enabled
   * @param templates - Available goal templates from AccessContext
   */
  hydrate(
    goals: TrackingGoalData[] | null,
    calculations: Record<string, GoalCalculationData> | null,
    isFeatureEnabled = false,
    templates: GoalTemplateWithAccess[] | null = null,
  ): void {
    this.isFeatureEnabled = isFeatureEnabled;

    // Hydrate templates
    this.templates = templates ?? [];

    if (!goals) {
      this.goals = [];
      this.calculations.clear();
      this.isHydrated = true;
      return;
    }

    // Store goals
    this.goals = goals;

    // Hydrate calculations map
    if (calculations) {
      this.calculations = new Map(Object.entries(calculations));
    } else {
      this.calculations.clear();
    }

    // Set first goal as active if none selected
    if (this.goals.length > 0 && !this.activeGoalId) {
      this.activeGoalId = this.activeGoals[0]?.id ?? null;
    }

    this.isHydrated = true;
  }

  // ============================================================================
  // Actions - Goal Selection
  // ============================================================================

  /**
   * Set the active goal
   * @param goalId - ID of goal to select, or null to clear selection
   */
  setActiveGoal(goalId: string | null): void {
    this.activeGoalId = goalId;
  }

  // ============================================================================
  // Actions - Add Goal Modal
  // ============================================================================

  /**
   * Open the add goal modal and reset state
   */
  openAddModal(): void {
    this.isAddModalOpen = true;
    this.addModalStep = 'category';
    this.selectedCategory = null;
    this.selectedTemplate = null;
    this.addModalFormData = {};
    this.addModalError = null;
    this.isCreating = false;
  }

  /**
   * Close the add goal modal
   */
  closeAddModal(): void {
    this.isAddModalOpen = false;
  }

  /**
   * Select a category and move to template step
   */
  selectCategory(category: 'immigration' | 'tax' | 'personal'): void {
    this.selectedCategory = category;
    this.addModalStep = 'template';
  }

  /**
   * Select a template and move to configure step (if not requiring upgrade)
   */
  selectTemplate(template: GoalTemplateWithAccess): void {
    if (template.requiresUpgrade) {
      // Don't proceed if upgrade required
      return;
    }
    this.selectedTemplate = template;
    // Initialize form data with template defaults
    this.addModalFormData = {
      name: template.name,
      startDate: new Date().toISOString().split('T')[0],
    };
    // Add default config values to form
    Object.entries(template.defaultConfig).forEach(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number') {
        this.addModalFormData[key] = String(value);
      }
    });
    this.addModalStep = 'configure';
  }

  /**
   * Update a form field value
   */
  setFormField(field: string, value: string): void {
    this.addModalFormData[field] = value;
  }

  /**
   * Go back to the previous step
   */
  goBackInModal(): void {
    if (this.addModalStep === 'template') {
      this.addModalStep = 'category';
      this.selectedCategory = null;
    } else if (this.addModalStep === 'configure') {
      this.addModalStep = 'template';
      this.selectedTemplate = null;
    }
  }

  /**
   * Create the goal from the current form data
   * @returns Created goal, or null on error
   */
  async createGoalFromModal(): Promise<TrackingGoalData | null> {
    if (!this.selectedTemplate) return null;

    this.isCreating = true;
    this.addModalError = null;

    try {
      // Convert form data to proper types
      const config: Record<string, unknown> = {};
      Object.entries(this.addModalFormData).forEach(([key, value]) => {
        // Handle number fields
        if (['thresholdDays', 'windowDays'].includes(key)) {
          config[key] = parseInt(value, 10);
        } else if (key !== 'name' && key !== 'startDate') {
          config[key] = value;
        }
      });

      const goalData: CreateTrackingGoalData = {
        type: this.selectedTemplate.type as GoalType,
        jurisdiction: this.selectedTemplate.jurisdiction as GoalJurisdiction,
        name: this.addModalFormData.name || this.selectedTemplate.name,
        config: { ...this.selectedTemplate.defaultConfig, ...config },
        startDate:
          this.addModalFormData.startDate ||
          new Date().toISOString().split('T')[0],
      };

      const goal = await this.createGoal(goalData);

      if (goal) {
        runInAction(() => {
          this.isCreating = false;
          this.closeAddModal();
        });
        return goal;
      } else {
        runInAction(() => {
          this.addModalError = this.error || 'Failed to create goal';
          this.isCreating = false;
        });
        return null;
      }
    } catch (err) {
      runInAction(() => {
        this.addModalError =
          err instanceof Error ? err.message : 'Failed to create goal';
        this.isCreating = false;
      });
      return null;
    }
  }

  // ============================================================================
  // Actions - API Operations
  // ============================================================================

  /**
   * Fetch goals from API (for refresh/sync)
   * Note: Initial data comes from hydration, this is for manual refresh
   */
  async fetchGoals(): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      const response = await fetch('/api/goals');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch goals');
      }

      runInAction(() => {
        this.goals = data.goals;
        this.isLoading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error =
          err instanceof Error ? err.message : 'Failed to fetch goals';
        this.isLoading = false;
      });
    }
  }

  /**
   * Create a new tracking goal
   * @param input - Goal creation data
   * @returns Created goal, or null on error
   */
  async createGoal(
    input: CreateTrackingGoalData,
  ): Promise<TrackingGoalData | null> {
    this.isLoading = true;
    this.error = null;

    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create goal');
      }

      runInAction(() => {
        this.goals.push(data.goal);
        // Set as active goal
        this.activeGoalId = data.goal.id;
        this.isLoading = false;
      });

      return data.goal;
    } catch (err) {
      runInAction(() => {
        this.error =
          err instanceof Error ? err.message : 'Failed to create goal';
        this.isLoading = false;
      });
      return null;
    }
  }

  /**
   * Update an existing goal
   * @param goalId - ID of goal to update
   * @param updates - Fields to update
   * @returns Updated goal, or null on error
   */
  async updateGoal(
    goalId: string,
    updates: UpdateTrackingGoalData,
  ): Promise<TrackingGoalData | null> {
    this.isLoading = true;
    this.error = null;

    try {
      const response = await fetch(`/api/goals/${goalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update goal');
      }

      runInAction(() => {
        // Replace goal in array
        const index = this.goals.findIndex((g) => g.id === goalId);
        if (index !== -1) {
          this.goals[index] = data.goal;
        }
        this.isLoading = false;
      });

      return data.goal;
    } catch (err) {
      runInAction(() => {
        this.error =
          err instanceof Error ? err.message : 'Failed to update goal';
        this.isLoading = false;
      });
      return null;
    }
  }

  /**
   * Archive (soft delete) a goal
   * @param goalId - ID of goal to archive
   * @returns true on success, false on error
   */
  async archiveGoal(goalId: string): Promise<boolean> {
    this.isLoading = true;
    this.error = null;

    try {
      const response = await fetch(`/api/goals/${goalId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to archive goal');
      }

      runInAction(() => {
        // Mark as archived locally
        const goal = this.goals.find((g) => g.id === goalId);
        if (goal) {
          goal.isArchived = true;
        }

        // If this was the active goal, select another
        if (this.activeGoalId === goalId) {
          this.activeGoalId = this.activeGoals[0]?.id ?? null;
        }

        this.isLoading = false;
      });

      return true;
    } catch (err) {
      runInAction(() => {
        this.error =
          err instanceof Error ? err.message : 'Failed to archive goal';
        this.isLoading = false;
      });
      return false;
    }
  }

  // ============================================================================
  // Actions - Calculations
  // ============================================================================

  /**
   * Update calculation for a specific goal
   * Called by travelStore when trips change
   *
   * @param goalId - ID of goal
   * @param calculation - New calculation result
   */
  setCalculation(goalId: string, calculation: GoalCalculationData): void {
    this.calculations.set(goalId, calculation);
  }

  /**
   * Clear all calculations (e.g., before recalculating)
   */
  clearCalculations(): void {
    this.calculations.clear();
  }

  // ============================================================================
  // Reset
  // ============================================================================

  /**
   * Reset store to initial state
   * Called on sign-out or when feature is disabled
   */
  reset(): void {
    this.disposeTripReaction();
    this.goals = [];
    this.calculations.clear();
    this.activeGoalId = null;
    this.isLoading = false;
    this.error = null;
    this.isFeatureEnabled = false;
    this.isHydrated = false;
    // Reset templates and modal state
    this.templates = [];
    this.isAddModalOpen = false;
    this.addModalStep = 'category';
    this.selectedCategory = null;
    this.selectedTemplate = null;
    this.addModalFormData = {};
    this.isCreating = false;
    this.addModalError = null;
  }

  // ============================================================================
  // Trip Change Reaction
  // ============================================================================

  /**
   * Initialize reaction to recalculate goals when trips change
   * Should be called after hydration when feature is enabled
   *
   * @param travelStore - The travel store to observe for trip changes
   */
  initializeTripReaction(travelStore: {
    trips: Array<{
      id: string;
      outDate: string;
      inDate: string;
      outRoute: string;
      inRoute: string;
    }>;
  }): void {
    // Dispose any existing reaction first
    this.disposeTripReaction();

    if (!this.isFeatureEnabled) {
      return;
    }

    // Create reaction that observes trips array
    this.tripReactionDisposer = reaction(
      // Observe the trips array (using slice to trigger on any change)
      () => travelStore.trips.slice(),
      // When trips change, recalculate all active goals
      () => {
        if (this.isFeatureEnabled && this.hasGoals) {
          this.recalculateAllGoals(travelStore);
        }
      },
      {
        // Debounce to avoid excessive recalculations during rapid edits
        delay: 300,
        // Run immediately on first observation to compute initial calculations
        fireImmediately: true,
      },
    );
  }

  /**
   * Dispose the trip reaction (cleanup)
   */
  disposeTripReaction(): void {
    if (this.tripReactionDisposer) {
      this.tripReactionDisposer();
      this.tripReactionDisposer = null;
    }
  }

  /**
   * Recalculate all active goals using the rule engines
   * Called when trips change or goals are modified
   *
   * @param travelStore - The travel store containing trip data
   */
  recalculateAllGoals(travelStore: {
    trips: Array<{
      id: string;
      outDate: string;
      inDate: string;
      outRoute: string;
      inRoute: string;
    }>;
  }): void {
    // Dynamically import rule engines to avoid circular dependencies
    // and to ensure this works in both client and server contexts
    import('@uth/rules')
      .then(({ ruleEngineRegistry }) => {
        runInAction(() => {
          for (const goal of this.activeGoals) {
            const engine = ruleEngineRegistry.get(
              goal.type as Parameters<typeof ruleEngineRegistry.get>[0],
            );

            if (!engine) {
              console.warn(`No rule engine found for goal type: ${goal.type}`);
              continue;
            }

            try {
              const calculation = engine.calculate(
                travelStore.trips,
                goal.config as unknown as Parameters<
                  typeof engine.calculate
                >[1],
                new Date(goal.startDate),
              );

              // Set the goal ID on the calculation
              calculation.goalId = goal.id;

              // Store the calculation
              this.calculations.set(
                goal.id,
                calculation as GoalCalculationData,
              );
            } catch (error) {
              console.error(`Failed to calculate goal ${goal.id}:`, error);
            }
          }
        });
      })
      .catch((error) => {
        console.error('Failed to load rule engines:', error);
      });
  }

  /**
   * Recalculate a single goal
   * @param goalId - ID of goal to recalculate
   * @param travelStore - The travel store containing trip data
   */
  recalculateGoal(
    goalId: string,
    travelStore: {
      trips: Array<{
        id: string;
        outDate: string;
        inDate: string;
        outRoute: string;
        inRoute: string;
      }>;
    },
  ): void {
    const goal = this.goals.find((g) => g.id === goalId);
    if (!goal) return;

    import('@uth/rules')
      .then(({ ruleEngineRegistry }) => {
        const engine = ruleEngineRegistry.get(
          goal.type as Parameters<typeof ruleEngineRegistry.get>[0],
        );

        if (!engine) {
          console.warn(`No rule engine found for goal type: ${goal.type}`);
          return;
        }

        try {
          const calculation = engine.calculate(
            travelStore.trips,
            goal.config as unknown as Parameters<typeof engine.calculate>[1],
            new Date(goal.startDate),
          );

          calculation.goalId = goal.id;

          runInAction(() => {
            this.calculations.set(goal.id, calculation as GoalCalculationData);
          });
        } catch (error) {
          console.error(`Failed to calculate goal ${goal.id}:`, error);
        }
      })
      .catch((error) => {
        console.error('Failed to load rule engines:', error);
      });
  }
}

export const goalsStore = new GoalsStore();
