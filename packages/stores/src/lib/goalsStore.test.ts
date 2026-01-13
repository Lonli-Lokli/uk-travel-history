import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { goalsStore } from './goalsStore';
import type {
  TrackingGoalData,
  GoalCalculationData,
  GoalTemplateWithAccess,
  CreateTrackingGoalData,
} from '@uth/db';

// Mock fetch
global.fetch = vi.fn();

// Mock @uth/rules module
vi.mock('@uth/rules', () => ({
  ruleEngineRegistry: {
    get: vi.fn(() => ({
      calculate: vi.fn((_trips, _config, _startDate) => ({
        goalId: '',
        goalType: 'uk_ilr',
        status: 'in_progress',
        progressPercent: 50,
        eligibilityDate: '2027-03-01',
        daysUntilEligible: 365,
        metrics: [
          {
            key: 'days_outside',
            label: 'Days Outside UK',
            value: 100,
            limit: 450,
            unit: 'days',
            status: 'ok',
          },
        ],
        warnings: [],
      })),
    })),
  },
}));

describe('GoalsStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    goalsStore.reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // No cleanup needed - trip reactions removed in Phase 1 (Issue #162)
  });

  describe('Initial State', () => {
    it('should have empty goals array', () => {
      expect(goalsStore.goals).toEqual([]);
    });

    it('should have no active goal', () => {
      expect(goalsStore.activeGoal).toBeNull();
    });

    it('should not be hydrated', () => {
      expect(goalsStore.isHydrated).toBe(false);
    });

    it('should not have feature enabled', () => {
      expect(goalsStore.isFeatureEnabled).toBe(false);
    });

    it('should have empty templates', () => {
      expect(goalsStore.templates).toEqual([]);
    });
  });

  describe('Hydration', () => {
    const mockGoals: TrackingGoalData[] = [
      {
        id: 'goal-1',
        userId: 'user-123',
        type: 'uk_ilr',
        jurisdiction: 'uk',
        name: 'UK ILR (5-Year)',
        config: { trackYears: 5, visaStartDate: '2022-03-01' },
        startDate: '2022-03-01',
        targetDate: '2027-03-01',
        isActive: true,
        isArchived: false,
        displayOrder: 0,
        color: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'goal-2',
        userId: 'user-123',
        type: 'days_counter',
        jurisdiction: 'global',
        name: 'Days Away',
        config: { countDirection: 'days_away', referenceLocation: 'Home' },
        startDate: '2024-01-01',
        targetDate: null,
        isActive: true,
        isArchived: false,
        displayOrder: 1,
        color: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];

    const mockCalculations: Record<string, GoalCalculationData> = {
      'goal-1': {
        goalId: 'goal-1',
        goalType: 'uk_ilr',
        status: 'in_progress',
        progressPercent: 50,
        eligibilityDate: '2027-03-01',
        daysUntilEligible: 365,
        metrics: [],
        warnings: [],
      },
    };

    const mockTemplates: GoalTemplateWithAccess[] = [
      {
        id: 'uk_ilr_5yr',
        jurisdiction: 'uk',
        category: 'immigration',
        name: 'UK ILR (5-Year)',
        description: 'Indefinite Leave to Remain via standard 5-year route',
        icon: 'home',
        type: 'uk_ilr',
        defaultConfig: { trackYears: 5 },
        requiredFields: ['visaStartDate'],
        displayOrder: 1,
        isAvailable: true,
        minTier: 'anonymous',
        requiresUpgrade: false,
      },
    ];

    it('should hydrate with goals and calculations', () => {
      goalsStore.hydrate(mockGoals, mockCalculations, true, mockTemplates);

      expect(goalsStore.goals).toEqual(mockGoals);
      expect(goalsStore.calculations.size).toBe(1);
      expect(goalsStore.calculations.get('goal-1')).toEqual(
        mockCalculations['goal-1'],
      );
      expect(goalsStore.isFeatureEnabled).toBe(true);
      expect(goalsStore.isHydrated).toBe(true);
      expect(goalsStore.templates).toEqual(mockTemplates);
    });

    it('should handle null goals', () => {
      goalsStore.hydrate(null, null, false);

      expect(goalsStore.goals).toEqual([]);
      expect(goalsStore.calculations.size).toBe(0);
      expect(goalsStore.isHydrated).toBe(true);
      expect(goalsStore.isFeatureEnabled).toBe(false);
    });

    it('should set first active goal as active goal', () => {
      goalsStore.hydrate(mockGoals, mockCalculations, true);

      expect(goalsStore.activeGoalId).toBe('goal-1');
    });

    it('should skip archived goals when selecting active goal', () => {
      const goalsWithArchived = [
        { ...mockGoals[0], isArchived: true },
        mockGoals[1],
      ];
      goalsStore.hydrate(goalsWithArchived, {}, true);

      expect(goalsStore.activeGoalId).toBe('goal-2');
    });
  });

  describe('Computed Properties', () => {
    const mockGoals: TrackingGoalData[] = [
      {
        id: 'goal-1',
        userId: 'user-123',
        type: 'uk_ilr',
        jurisdiction: 'uk',
        name: 'UK ILR',
        config: {},
        startDate: '2022-03-01',
        targetDate: null,
        isActive: true,
        isArchived: false,
        displayOrder: 0,
        color: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'goal-2',
        userId: 'user-123',
        type: 'days_counter',
        jurisdiction: 'global',
        name: 'Days Away',
        config: {},
        startDate: '2024-01-01',
        targetDate: null,
        isActive: false,
        isArchived: false,
        displayOrder: 1,
        color: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'goal-3',
        userId: 'user-123',
        type: 'uk_citizenship',
        jurisdiction: 'uk',
        name: 'UK Citizenship',
        config: {},
        startDate: '2023-01-01',
        targetDate: null,
        isActive: true,
        isArchived: true,
        displayOrder: 2,
        color: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];

    beforeEach(() => {
      goalsStore.hydrate(mockGoals, {}, true);
    });

    it('should return hasGoals as true when goals exist', () => {
      expect(goalsStore.hasGoals).toBe(true);
    });

    it('should return only active, non-archived goals', () => {
      const activeGoals = goalsStore.activeGoals;
      expect(activeGoals.length).toBe(1);
      expect(activeGoals[0].id).toBe('goal-1');
    });

    it('should return active goals sorted by display order', () => {
      const goalsUnsorted = [
        { ...mockGoals[0], displayOrder: 2 },
        { ...mockGoals[0], id: 'goal-4', displayOrder: 0 },
        { ...mockGoals[0], id: 'goal-5', displayOrder: 1 },
      ];
      goalsStore.hydrate(goalsUnsorted, {}, true);

      const activeGoals = goalsStore.activeGoals;
      expect(activeGoals[0].id).toBe('goal-4');
      expect(activeGoals[1].id).toBe('goal-5');
      expect(activeGoals[2].id).toBe('goal-1');
    });

    it('should return activeGoal from activeGoalId', () => {
      goalsStore.setActiveGoal('goal-1');
      expect(goalsStore.activeGoal?.id).toBe('goal-1');
    });

    it('should return first active goal when activeGoalId is null', () => {
      goalsStore.setActiveGoal(null);
      expect(goalsStore.activeGoal?.id).toBe('goal-1');
    });

    it('should return null for activeCalculation when no calculation exists', () => {
      expect(goalsStore.activeCalculation).toBeNull();
    });

    it('should return activeCalculation when calculation exists', () => {
      const calc: GoalCalculationData = {
        goalId: 'goal-1',
        goalType: 'uk_ilr',
        status: 'in_progress',
        progressPercent: 50,
        eligibilityDate: null,
        daysUntilEligible: null,
        metrics: [],
        warnings: [],
      };
      goalsStore.setCalculation('goal-1', calc);

      expect(goalsStore.activeCalculation).toEqual(calc);
    });

    it('should return active goal count', () => {
      expect(goalsStore.activeGoalCount).toBe(1);
    });
  });

  describe('Actions - Goal Selection', () => {
    it('should set active goal', () => {
      goalsStore.setActiveGoal('goal-123');
      expect(goalsStore.activeGoalId).toBe('goal-123');
    });

    it('should clear active goal with null', () => {
      goalsStore.setActiveGoal('goal-123');
      goalsStore.setActiveGoal(null);
      expect(goalsStore.activeGoalId).toBeNull();
    });
  });

  describe('Actions - Add Goal Modal', () => {
    const mockTemplate: GoalTemplateWithAccess = {
      id: 'uk_ilr_5yr',
      jurisdiction: 'uk',
      category: 'immigration',
      name: 'UK ILR (5-Year)',
      description: 'Indefinite Leave to Remain via standard 5-year route',
      icon: 'home',
      type: 'uk_ilr',
      defaultConfig: { trackYears: 5 },
      requiredFields: ['visaStartDate'],
      displayOrder: 1,
      isAvailable: true,
      minTier: 'anonymous',
      requiresUpgrade: false,
    };

    beforeEach(() => {
      goalsStore.hydrate([], {}, true, [mockTemplate]);
    });

    it('should open add modal with initial state', () => {
      goalsStore.openAddModal();

      expect(goalsStore.isAddModalOpen).toBe(true);
      expect(goalsStore.addModalStep).toBe('category');
      expect(goalsStore.selectedCategory).toBeNull();
      expect(goalsStore.selectedTemplate).toBeNull();
      expect(goalsStore.addModalFormData).toEqual({});
    });

    it('should close add modal', () => {
      goalsStore.openAddModal();
      goalsStore.closeAddModal();

      expect(goalsStore.isAddModalOpen).toBe(false);
    });

    it('should select category and move to template step', () => {
      goalsStore.openAddModal();
      goalsStore.selectCategory('immigration');

      expect(goalsStore.selectedCategory).toBe('immigration');
      expect(goalsStore.addModalStep).toBe('template');
    });

    it('should filter templates by selected category', () => {
      goalsStore.openAddModal();
      goalsStore.selectCategory('immigration');

      expect(goalsStore.filteredTemplates.length).toBe(1);
      expect(goalsStore.filteredTemplates[0].id).toBe('uk_ilr_5yr');
    });

    it('should select template and move to configure step', () => {
      goalsStore.openAddModal();
      goalsStore.selectCategory('immigration');
      goalsStore.selectTemplate(mockTemplate);

      expect(goalsStore.selectedTemplate).toEqual(mockTemplate);
      expect(goalsStore.addModalStep).toBe('configure');
      expect(goalsStore.addModalFormData.name).toBe('UK ILR (5-Year)');
    });

    it('should not proceed if template requires upgrade', () => {
      const premiumTemplate = { ...mockTemplate, requiresUpgrade: true };
      goalsStore.openAddModal();
      goalsStore.selectCategory('immigration');
      goalsStore.selectTemplate(premiumTemplate);

      expect(goalsStore.selectedTemplate).toBeNull();
      expect(goalsStore.addModalStep).toBe('template');
    });

    it('should update form field', () => {
      goalsStore.openAddModal();
      goalsStore.setFormField('visaStartDate', '2022-03-01');

      expect(goalsStore.addModalFormData.visaStartDate).toBe('2022-03-01');
    });

    it('should go back to previous step', () => {
      goalsStore.openAddModal();
      goalsStore.selectCategory('immigration');
      goalsStore.selectTemplate(mockTemplate);
      goalsStore.goBackInModal();

      expect(goalsStore.addModalStep).toBe('template');
      expect(goalsStore.selectedTemplate).toBeNull();

      goalsStore.goBackInModal();
      expect(goalsStore.addModalStep).toBe('category');
      expect(goalsStore.selectedCategory).toBeNull();
    });
  });

  describe('Actions - API Operations', () => {
    const mockGoal: TrackingGoalData = {
      id: 'goal-1',
      userId: 'user-123',
      type: 'uk_ilr',
      jurisdiction: 'uk',
      name: 'UK ILR',
      config: {},
      startDate: '2022-03-01',
      targetDate: null,
      isActive: true,
      isArchived: false,
      displayOrder: 0,
      color: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };


    it('should create a goal', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ goal: mockGoal }),
      });

      const input: CreateTrackingGoalData = {
        type: 'uk_ilr',
        jurisdiction: 'uk',
        name: 'UK ILR',
        config: {},
        startDate: '2022-03-01',
      };

      const result = await goalsStore.createGoal(input);

      expect(result).toEqual(mockGoal);
      expect(goalsStore.goals).toContainEqual(mockGoal);
      expect(goalsStore.activeGoalId).toBe('goal-1');
    });

    it('should handle create error', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to create' }),
      });

      const input: CreateTrackingGoalData = {
        type: 'uk_ilr',
        jurisdiction: 'uk',
        name: 'UK ILR',
        config: {},
        startDate: '2022-03-01',
      };

      const result = await goalsStore.createGoal(input);

      expect(result).toBeNull();
      expect(goalsStore.error).toBe('Failed to create');
    });

    it('should update a goal', async () => {
      goalsStore.hydrate([mockGoal], {}, true);

      const updatedGoal = { ...mockGoal, name: 'Updated Name' };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ goal: updatedGoal }),
      });

      const result = await goalsStore.updateGoal('goal-1', {
        name: 'Updated Name',
      });

      expect(result).toEqual(updatedGoal);
      expect(goalsStore.goals[0].name).toBe('Updated Name');
    });

    it('should archive a goal', async () => {
      goalsStore.hydrate([mockGoal], {}, true);

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
      });

      const result = await goalsStore.archiveGoal('goal-1');

      expect(result).toBe(true);
      expect(goalsStore.goals[0].isArchived).toBe(true);
    });

    it('should select another goal when archiving active goal', async () => {
      const goals = [mockGoal, { ...mockGoal, id: 'goal-2' }];
      goalsStore.hydrate(goals, {}, true);
      goalsStore.setActiveGoal('goal-1');

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
      });

      await goalsStore.archiveGoal('goal-1');

      expect(goalsStore.activeGoalId).toBe('goal-2');
    });
  });

  describe('Actions - Calculations', () => {
    it('should set calculation for a goal', () => {
      const calc: GoalCalculationData = {
        goalId: 'goal-1',
        goalType: 'uk_ilr',
        status: 'in_progress',
        progressPercent: 50,
        eligibilityDate: null,
        daysUntilEligible: null,
        metrics: [],
        warnings: [],
      };

      goalsStore.setCalculation('goal-1', calc);

      expect(goalsStore.calculations.get('goal-1')).toEqual(calc);
    });

    it('should clear all calculations', () => {
      const calc: GoalCalculationData = {
        goalId: 'goal-1',
        goalType: 'uk_ilr',
        status: 'in_progress',
        progressPercent: 50,
        eligibilityDate: null,
        daysUntilEligible: null,
        metrics: [],
        warnings: [],
      };

      goalsStore.setCalculation('goal-1', calc);
      goalsStore.clearCalculations();

      expect(goalsStore.calculations.size).toBe(0);
    });
  });

  describe('Reset', () => {
    it('should reset store to initial state', () => {
      const mockGoal: TrackingGoalData = {
        id: 'goal-1',
        userId: 'user-123',
        type: 'uk_ilr',
        jurisdiction: 'uk',
        name: 'UK ILR',
        config: {},
        startDate: '2022-03-01',
        targetDate: null,
        isActive: true,
        isArchived: false,
        displayOrder: 0,
        color: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      goalsStore.hydrate([mockGoal], {}, true);
      goalsStore.setActiveGoal('goal-1');
      goalsStore.openAddModal();

      goalsStore.reset();

      expect(goalsStore.goals).toEqual([]);
      expect(goalsStore.calculations.size).toBe(0);
      expect(goalsStore.activeGoalId).toBeNull();
      expect(goalsStore.isFeatureEnabled).toBe(false);
      expect(goalsStore.isHydrated).toBe(false);
      expect(goalsStore.isAddModalOpen).toBe(false);
      expect(goalsStore.templates).toEqual([]);
    });
  });

  // NOTE: Trip Reaction tests removed as part of Phase 1 (Issue #162)
  // Client-side trip reactions have been removed in favor of server-side calculations
  // Calculations are now pre-computed server-side and hydrated via AccessContext
  // After mutations, components trigger router.refresh() to re-hydrate with fresh calculations
});
