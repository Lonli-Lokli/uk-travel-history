/**
 * Type converters between domain types and database types for goals
 * Handles conversion of Date objects <-> ISO strings
 */

import type {
  TrackingGoalData,
  CreateTrackingGoalData,
  UpdateTrackingGoalData,
} from '@uth/db';
import type {
  TrackingGoal,
  CreateGoalInput,
  UpdateGoalInput,
} from '../../types/goal-domain';

/**
 * Convert database goal to domain goal
 * Converts Date objects to ISO strings
 */
export function goalFromDb(dbGoal: TrackingGoalData): TrackingGoal {
  return {
    id: dbGoal.id,
    userId: dbGoal.userId,
    type: dbGoal.type,
    jurisdiction: dbGoal.jurisdiction,
    name: dbGoal.name,
    config: dbGoal.config,
    startDate: dbGoal.startDate, // Already ISO string in DB
    targetDate: dbGoal.targetDate, // Already ISO string in DB
    isActive: dbGoal.isActive,
    isArchived: dbGoal.isArchived,
    displayOrder: dbGoal.displayOrder,
    color: dbGoal.color,
    createdAt: dbGoal.createdAt, // Already ISO string in DB
    updatedAt: dbGoal.updatedAt, // Already ISO string in DB
  };
}

/**
 * Convert domain goal to database goal
 * Converts ISO strings to Date objects (if needed by DB layer)
 */
export function goalToDb(goal: TrackingGoal): TrackingGoalData {
  return {
    id: goal.id,
    userId: goal.userId,
    type: goal.type,
    jurisdiction: goal.jurisdiction,
    name: goal.name,
    config: goal.config,
    startDate: goal.startDate,
    targetDate: goal.targetDate,
    isActive: goal.isActive,
    isArchived: goal.isArchived,
    displayOrder: goal.displayOrder,
    color: goal.color,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  };
}

/**
 * Convert domain create input to DB create data
 */
export function createGoalInputToDb(
  input: CreateGoalInput,
): CreateTrackingGoalData {
  return {
    type: input.type,
    jurisdiction: input.jurisdiction,
    name: input.name,
    config: input.config,
    startDate: input.startDate,
    targetDate: input.targetDate,
    isActive: input.isActive,
    displayOrder: input.displayOrder,
    color: input.color,
  };
}

/**
 * Convert domain update input to DB update data
 */
export function updateGoalInputToDb(
  input: UpdateGoalInput,
): UpdateTrackingGoalData {
  return {
    name: input.name,
    config: input.config,
    targetDate: input.targetDate,
    isActive: input.isActive,
    isArchived: input.isArchived,
    displayOrder: input.displayOrder,
    color: input.color,
  };
}
