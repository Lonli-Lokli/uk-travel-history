/**
 * Typed Channel Definitions
 *
 * This file defines the contract for all cross-window messages.
 * Both main and child windows import this for full type safety.
 */

import type { Event, Effect, Store } from 'effector';

// ============================================================================
// Core Message Types
// ============================================================================

/**
 * Direction of message flow
 */
export type MessageDirection =
  | 'broadcast' // Main → All children
  | 'to-main' // Child → Main
  | 'to-window' // Targeted to specific window
  | 'peer'; // Any window → All other windows

/**
 * Base message structure with full type information
 */
export interface TypedMessage<TChannel extends string, TPayload> {
  channel: TChannel;
  payload: TPayload;
  direction: MessageDirection;
  sourceWindowId: string;
  targetWindowId?: string; // For targeted messages
  timestamp: number;
  correlationId?: string; // For request/response patterns
}

/**
 * Window registration message
 */
export interface WindowRegistration {
  windowId: string;
  windowType: string;
  capabilities: string[]; // What channels this window handles
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Channel Definition Helper Types
// ============================================================================

/**
 * Defines a typed channel with its payload type
 */
export interface ChannelDefinition<
  TName extends string,
  TPayload,
  TDirection extends MessageDirection = 'broadcast',
> {
  name: TName;
  direction: TDirection;
  // Phantom type to carry payload type
  _payload?: TPayload;
}

/**
 * Helper to define a broadcast channel (main → children)
 */
export function defineBroadcastChannel<TName extends string, TPayload>(
  name: TName,
): ChannelDefinition<TName, TPayload, 'broadcast'> {
  return { name, direction: 'broadcast' };
}

/**
 * Helper to define an upstream channel (child → main)
 */
export function defineUpstreamChannel<TName extends string, TPayload>(
  name: TName,
): ChannelDefinition<TName, TPayload, 'to-main'> {
  return { name, direction: 'to-main' };
}

/**
 * Helper to define a peer channel (any → all others)
 */
export function definePeerChannel<TName extends string, TPayload>(
  name: TName,
): ChannelDefinition<TName, TPayload, 'peer'> {
  return { name, direction: 'peer' };
}

/**
 * Helper to define a targeted channel (specific window)
 */
export function defineTargetedChannel<TName extends string, TPayload>(
  name: TName,
): ChannelDefinition<TName, TPayload, 'to-window'> {
  return { name, direction: 'to-window' };
}

// ============================================================================
// Channel Registry Type (define your app's channels here)
// ============================================================================

/**
 * Example: Define all your application's channels in one place.
 * This provides full type safety across the entire app.
 *
 * Usage in your app:
 *
 * // channels.ts
 * export const AppChannels = {
 *   // Main broadcasts to children
 *   instrumentSelected: defineBroadcastChannel<'instrumentSelected', { symbol: string; name: string }>('instrumentSelected'),
 *   marketData: defineBroadcastChannel<'marketData', { symbol: string; price: number; timestamp: number }>('marketData'),
 *
 *   // Children send to main (for websocket outgoing)
 *   submitOrder: defineUpstreamChannel<'submitOrder', { symbol: string; qty: number; side: 'buy' | 'sell' }>('submitOrder'),
 *   subscribeSymbol: defineUpstreamChannel<'subscribeSymbol', { symbol: string }>('subscribeSymbol'),
 *
 *   // Peer-to-peer (any window to all others)
 *   userPreference: definePeerChannel<'userPreference', { theme: 'light' | 'dark' }>('userPreference'),
 * } as const;
 *
 * export type AppChannels = typeof AppChannels;
 */

// ============================================================================
// Type Utilities for extracting channel info
// ============================================================================

/**
 * Extract payload type from a channel definition
 */
export type ChannelPayload<T> =
  T extends ChannelDefinition<any, infer P, any> ? P : never;

/**
 * Extract channel name from a channel definition
 */
export type ChannelName<T> =
  T extends ChannelDefinition<infer N, any, any> ? N : never;

/**
 * Extract direction from a channel definition
 */
export type ChannelDirection<T> =
  T extends ChannelDefinition<any, any, infer D> ? D : never;

/**
 * Filter channels by direction
 */
export type ChannelsByDirection<
  TChannels extends Record<
    string,
    ChannelDefinition<string, unknown, MessageDirection>
  >,
  TDirection extends MessageDirection,
> = {
  [K in keyof TChannels as ChannelDirection<TChannels[K]> extends TDirection
    ? K
    : never]: TChannels[K];
};

/**
 * Get all channel names as union type
 */
export type AllChannelNames<
  TChannels extends Record<
    string,
    ChannelDefinition<string, unknown, MessageDirection>
  >,
> = ChannelName<TChannels[keyof TChannels]>;

/**
 * Create a discriminated union of all possible messages
 */
export type ChannelMessage<
  TChannels extends Record<
    string,
    ChannelDefinition<string, unknown, MessageDirection>
  >,
> = {
  [K in keyof TChannels]: TypedMessage<
    ChannelName<TChannels[K]>,
    ChannelPayload<TChannels[K]>
  >;
}[keyof TChannels];
