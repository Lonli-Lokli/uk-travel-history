/**
 * POST /api/calculate
 *
 * Server-side calculation endpoint for anonymous users
 *
 * This endpoint allows anonymous users to calculate goal metrics server-side
 * without storing trips in the database. It takes trips and goal configuration
 * from the request body and returns calculated metrics.
 *
 * PUBLIC ENDPOINT: No authentication required
 *
 * Architecture:
 * - Anonymous users store trips client-side (localStorage/sessionStorage)
 * - When trips change, client calls this endpoint to get fresh calculations
 * - Calculations use the same rule engines as authenticated users
 * - This eliminates client-side calculation logic duplication
 */

import { NextRequest, NextResponse } from 'next/server';
import { ruleEngineRegistry } from '@uth/rules';
import type { GoalType } from '@uth/db';

/**
 * Trip data format expected in request body
 */
interface TripInput {
  id: string;
  outDate: string;
  inDate: string;
  outRoute?: string;
  inRoute?: string;
}

/**
 * Goal configuration expected in request body
 */
interface CalculateRequest {
  trips: TripInput[];
  goalType: GoalType;
  goalConfig: Record<string, unknown>;
  startDate: string;
}

/**
 * Calculate goal metrics for anonymous users
 *
 * Request body:
 * {
 *   trips: Array of trip objects
 *   goalType: Goal type (e.g., 'uk_ilr', 'schengen_90_180')
 *   goalConfig: Goal-specific configuration
 *   startDate: Goal start date (ISO format)
 * }
 *
 * Response:
 * {
 *   calculation: GoalCalculationData object
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CalculateRequest;

    // Validate request body
    if (!body.trips || !Array.isArray(body.trips)) {
      return NextResponse.json(
        { error: 'Invalid request: trips array is required' },
        { status: 400 }
      );
    }

    if (!body.goalType) {
      return NextResponse.json(
        { error: 'Invalid request: goalType is required' },
        { status: 400 }
      );
    }

    if (!body.startDate) {
      return NextResponse.json(
        { error: 'Invalid request: startDate is required' },
        { status: 400 }
      );
    }

    // Get the rule engine for this goal type
    const engine = ruleEngineRegistry.get(body.goalType);

    if (!engine) {
      return NextResponse.json(
        { error: `Unknown goal type: ${body.goalType}` },
        { status: 400 }
      );
    }

    // Convert trips to format expected by rule engines
    const tripRecords = body.trips.map((trip) => ({
      id: trip.id,
      outDate: trip.outDate,
      inDate: trip.inDate,
      outRoute: trip.outRoute || '',
      inRoute: trip.inRoute || '',
    }));

    // Calculate metrics using the rule engine
     
    const calculation = engine.calculate(
      tripRecords,
      body.goalConfig as any,
      new Date(body.startDate),
    );

    // Return the calculation
    return NextResponse.json(
      { calculation },
      { status: 200 }
    );
  } catch (error) {
    console.error('[/api/calculate] Error calculating metrics:', error);

    return NextResponse.json(
      {
        error: 'Internal server error calculating metrics',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
