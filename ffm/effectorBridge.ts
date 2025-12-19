/**
 * Type-Safe Effector Bridge
 * 
 * Provides strongly-typed bindings between Effector units and OpenFin transport.
 * Supports bidirectional communication with full TypeScript inference.
 */

import {
  Event,
  Store,
  Effect,
  createEvent,
  createStore,
  createEffect,
  sample,
  createWatch,
  Unit,
  EventCallable,
  StoreWritable,
} from 'effector';

import type {
  ChannelDefinition,
  ChannelPayload,
  MessageDirection,
} from '../types/channels';

import {
  TypedOpenFinTransport,
  getTransport,
} from '../transport/typedTransport';

// ============================================================================
// Synced Unit Types
// ============================================================================

/**
 * A synced event pair - local event and remote trigger
 */
export interface SyncedEvent<TPayload> {
  /** Call this to trigger locally AND broadcast to other windows */
  fire: EventCallable<TPayload>;
  /** This fires when receiving from other windows (read-only) */
  received: Event<TPayload>;
  /** Combined: fires on both local and remote triggers */
  triggered: Event<TPayload>;
  /** Cleanup function */
  destroy: () => void;
}

/**
 * An upstream event - child sends to main
 */
export interface UpstreamEvent<TPayload> {
  /** Call this in child window to send to main */
  send: EventCallable<TPayload>;
  /** This fires in main window when receiving (read-only) */
  received: Event<TPayload>;
  /** Cleanup function */
  destroy: () => void;
}

/**
 * A broadcast event - main sends to all children
 */
export interface BroadcastEvent<TPayload> {
  /** Call this in main window to broadcast to all children */
  broadcast: EventCallable<TPayload>;
  /** This fires in child windows when receiving (read-only) */
  received: Event<TPayload>;
  /** Cleanup function */
  destroy: () => void;
}

/**
 * A synced store with cross-window synchronization
 */
export interface SyncedStore<TState> {
  /** The synchronized store */
  $store: Store<TState>;
  /** Event to update the store (triggers sync) */
  update: EventCallable<TState>;
  /** Cleanup function */
  destroy: () => void;
}

// ============================================================================
// Tracking to prevent infinite loops
// ============================================================================

const syncingChannels = new Set<string>();

function withSyncGuard<T>(channelName: string, fn: () => T): T | undefined {
  if (syncingChannels.has(channelName)) {
    return undefined;
  }
  syncingChannels.add(channelName);
  try {
    return fn();
  } finally {
    syncingChannels.delete(channelName);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a peer-synced event that broadcasts to all windows.
 * When fired in any window, it triggers in ALL windows (including sender).
 * 
 * @example
 * ```typescript
 * const channels = {
 *   themeChanged: definePeerChannel<'themeChanged', { theme: 'light' | 'dark' }>('themeChanged'),
 * };
 * 
 * const { fire, triggered } = createSyncedEvent(channels.themeChanged);
 * 
 * // In init.ts - connect to component
 * sample({ clock: triggered, target: uiComponent.setTheme });
 * 
 * // Fire from anywhere
 * fire({ theme: 'dark' });
 * ```
 */
export function createSyncedEvent<
  TName extends string,
  TPayload
>(
  channel: ChannelDefinition<TName, TPayload, 'peer'>,
  transport?: TypedOpenFinTransport
): SyncedEvent<TPayload> {
  const t = transport || getTransport();
  const channelName = channel.name;

  // Local event that user calls
  const fire = createEvent<TPayload>({ name: `${channelName}:fire` });
  
  // Event that fires when receiving from remote
  const received = createEvent<TPayload>({ name: `${channelName}:received` });
  
  // Combined event that fires on both
  const triggered = createEvent<TPayload>({ name: `${channelName}:triggered` });

  // When fired locally, broadcast AND trigger locally
  const unwatchFire = createWatch({
    unit: fire,
    fn: (payload) => {
      withSyncGuard(channelName, () => {
        t.send(channel, payload);
      });
      triggered(payload);
    },
  });

  // When received from remote, trigger
  const unwatchReceived = createWatch({
    unit: received,
    fn: (payload) => {
      triggered(payload);
    },
  });

  // Subscribe to transport
  const unsubscribe = t.subscribe(channel, (payload) => {
    withSyncGuard(channelName, () => {
      received(payload);
    });
  });

  return {
    fire,
    received,
    triggered,
    destroy: () => {
      unwatchFire();
      unwatchReceived();
      unsubscribe();
    },
  };
}

/**
 * Creates an upstream event for child → main communication.
 * Used when child windows need to send data to main (e.g., for websocket outgoing).
 * 
 * @example
 * ```typescript
 * const channels = {
 *   submitOrder: defineUpstreamChannel<'submitOrder', OrderPayload>('submitOrder'),
 * };
 * 
 * const { send, received } = createUpstreamEvent(channels.submitOrder);
 * 
 * // In child window - connect to order form
 * sample({ clock: orderForm.submitted, target: send });
 * 
 * // In main window - connect to websocket
 * sample({ clock: received, target: websocket.sendMessage });
 * ```
 */
export function createUpstreamEvent<
  TName extends string,
  TPayload
>(
  channel: ChannelDefinition<TName, TPayload, 'to-main'>,
  transport?: TypedOpenFinTransport
): UpstreamEvent<TPayload> {
  const t = transport || getTransport();
  const channelName = channel.name;

  // Event that child calls to send to main
  const send = createEvent<TPayload>({ name: `${channelName}:send` });
  
  // Event that fires in main when receiving
  const received = createEvent<TPayload>({ name: `${channelName}:received` });

  // Child window: when send is called, transmit to main
  const unwatchSend = createWatch({
    unit: send,
    fn: (payload) => {
      if (!t.isMainWindow()) {
        withSyncGuard(channelName, () => {
          t.send(channel, payload);
        });
      } else {
        // If main window calls send, trigger received directly
        received(payload);
      }
    },
  });

  // Main window: subscribe to receive from children
  const unsubscribe = t.subscribe(channel, (payload) => {
    if (t.isMainWindow()) {
      withSyncGuard(channelName, () => {
        received(payload);
      });
    }
  });

  return {
    send,
    received,
    destroy: () => {
      unwatchSend();
      unsubscribe();
    },
  };
}

/**
 * Creates a broadcast event for main → children communication.
 * Used when main window needs to push data to all children (e.g., market data from websocket).
 * 
 * @example
 * ```typescript
 * const channels = {
 *   marketData: defineBroadcastChannel<'marketData', MarketDataPayload>('marketData'),
 * };
 * 
 * const { broadcast, received } = createBroadcastEvent(channels.marketData);
 * 
 * // In main window - connect to websocket incoming
 * sample({ clock: websocket.messageReceived, target: broadcast });
 * 
 * // In child windows - connect to chart
 * sample({ clock: received, target: chartComponent.updatePrice });
 * ```
 */
export function createBroadcastEvent<
  TName extends string,
  TPayload
>(
  channel: ChannelDefinition<TName, TPayload, 'broadcast'>,
  transport?: TypedOpenFinTransport
): BroadcastEvent<TPayload> {
  const t = transport || getTransport();
  const channelName = channel.name;

  // Event that main calls to broadcast
  const broadcast = createEvent<TPayload>({ name: `${channelName}:broadcast` });
  
  // Event that fires in children when receiving
  const received = createEvent<TPayload>({ name: `${channelName}:received` });

  // Main window: when broadcast is called, transmit to children
  const unwatchBroadcast = createWatch({
    unit: broadcast,
    fn: (payload) => {
      if (t.isMainWindow()) {
        withSyncGuard(channelName, () => {
          t.send(channel, payload);
        });
      }
    },
  });

  // Child windows: subscribe to receive from main
  const unsubscribe = t.subscribe(channel, (payload) => {
    if (!t.isMainWindow()) {
      withSyncGuard(channelName, () => {
        received(payload);
      });
    }
  });

  return {
    broadcast,
    received,
    destroy: () => {
      unwatchBroadcast();
      unsubscribe();
    },
  };
}

/**
 * Creates a synced store that stays in sync across windows.
 * 
 * @example
 * ```typescript
 * const channels = {
 *   selectedInstrument: definePeerChannel<'selectedInstrument', Instrument | null>('selectedInstrument'),
 * };
 * 
 * const { $store, update } = createSyncedStore(channels.selectedInstrument, null);
 * 
 * // Connect to component event
 * sample({ clock: watchlist.instrumentClicked, target: update });
 * 
 * // Use the store in any window
 * sample({ clock: $store, target: chart.showInstrument });
 * ```
 */
export function createSyncedStore<
  TName extends string,
  TState
>(
  channel: ChannelDefinition<TName, TState, 'peer'>,
  initialState: TState,
  transport?: TypedOpenFinTransport
): SyncedStore<TState> {
  const t = transport || getTransport();
  const channelName = channel.name;

  // Update event
  const update = createEvent<TState>({ name: `${channelName}:update` });
  const remoteUpdate = createEvent<TState>({ name: `${channelName}:remoteUpdate` });

  // The store
  const $store = createStore<TState>(initialState, { name: `${channelName}:$store` })
    .on(update, (_, newState) => newState)
    .on(remoteUpdate, (_, newState) => newState);

  // When updated locally, broadcast
  const unwatchUpdate = createWatch({
    unit: update,
    fn: (state) => {
      withSyncGuard(channelName, () => {
        t.send(channel, state);
      });
    },
  });

  // Subscribe to remote updates
  const unsubscribe = t.subscribe(channel, (state) => {
    withSyncGuard(channelName, () => {
      remoteUpdate(state);
    });
  });

  return {
    $store,
    update,
    destroy: () => {
      unwatchUpdate();
      unsubscribe();
    },
  };
}

// ============================================================================
// Bridge existing Effector units to channels (for existing components)
// ============================================================================

/**
 * Bridges an existing Effector event to a channel.
 * The event fires in all windows when triggered in any window.
 * 
 * @example
 * ```typescript
 * // Your existing component (unchanged)
 * // component/model.ts
 * export const itemSelected = createEvent<string>();
 * 
 * // In init.ts - bridge to cross-window sync
 * const channels = {
 *   itemSelected: definePeerChannel<'itemSelected', string>('itemSelected'),
 * };
 * 
 * bridgeEvent(component.itemSelected, channels.itemSelected);
 * ```
 */
export function bridgeEvent<TPayload>(
  event: Event<TPayload>,
  channel: ChannelDefinition<string, TPayload, 'peer'>,
  transport?: TypedOpenFinTransport
): () => void {
  const t = transport || getTransport();
  const channelName = channel.name;
  const cleanupFns: Array<() => void> = [];

  // When event fires locally, broadcast
  const unwatch = createWatch({
    unit: event,
    fn: (payload) => {
      withSyncGuard(channelName, () => {
        t.send(channel, payload);
      });
    },
  });
  cleanupFns.push(unwatch);

  // When receiving from remote, fire the event
  const unsubscribe = t.subscribe(channel, (payload) => {
    withSyncGuard(channelName, () => {
      (event as EventCallable<TPayload>)(payload);
    });
  });
  cleanupFns.push(unsubscribe);

  return () => cleanupFns.forEach(fn => fn());
}

/**
 * Bridges an existing Effector event as upstream (child → main).
 * 
 * @example
 * ```typescript
 * // Bridge order submission from child to main
 * bridgeEventUpstream(
 *   orderComponent.submitClicked,
 *   channels.submitOrder,
 *   websocket.sendOrderFx  // This effect runs in main window
 * );
 * ```
 */
export function bridgeEventUpstream<TPayload>(
  sourceEvent: Event<TPayload>,
  channel: ChannelDefinition<string, TPayload, 'to-main'>,
  mainTarget?: Event<TPayload> | Effect<TPayload, any, any>,
  transport?: TypedOpenFinTransport
): () => void {
  const t = transport || getTransport();
  const channelName = channel.name;
  const cleanupFns: Array<() => void> = [];

  // Child window: when source event fires, send to main
  if (!t.isMainWindow()) {
    const unwatch = createWatch({
      unit: sourceEvent,
      fn: (payload) => {
        t.send(channel, payload);
      },
    });
    cleanupFns.push(unwatch);
  }

  // Main window: receive and optionally forward to target
  if (t.isMainWindow() && mainTarget) {
    const unsubscribe = t.subscribe(channel, (payload) => {
      (mainTarget as EventCallable<TPayload>)(payload);
    });
    cleanupFns.push(unsubscribe);
  }

  return () => cleanupFns.forEach(fn => fn());
}

/**
 * Bridges an existing Effector event as broadcast (main → children).
 * 
 * @example
 * ```typescript
 * // Bridge market data from main to all children
 * bridgeEventBroadcast(
 *   websocket.marketDataReceived,
 *   channels.marketData,
 *   chartComponent.updateData  // This event fires in child windows
 * );
 * ```
 */
export function bridgeEventBroadcast<TPayload>(
  sourceEvent: Event<TPayload>,
  channel: ChannelDefinition<string, TPayload, 'broadcast'>,
  childTarget?: Event<TPayload>,
  transport?: TypedOpenFinTransport
): () => void {
  const t = transport || getTransport();
  const channelName = channel.name;
  const cleanupFns: Array<() => void> = [];

  // Main window: when source event fires, broadcast
  if (t.isMainWindow()) {
    const unwatch = createWatch({
      unit: sourceEvent,
      fn: (payload) => {
        t.send(channel, payload);
      },
    });
    cleanupFns.push(unwatch);
  }

  // Child windows: receive and optionally forward to target
  if (!t.isMainWindow() && childTarget) {
    const unsubscribe = t.subscribe(channel, (payload) => {
      (childTarget as EventCallable<TPayload>)(payload);
    });
    cleanupFns.push(unsubscribe);
  }

  return () => cleanupFns.forEach(fn => fn());
}

/**
 * Bridges an existing store to sync across windows.
 * Requires specifying the update event that changes the store.
 * 
 * @example
 * ```typescript
 * // Your component has:
 * // const $theme = createStore('light').on(themeChanged, (_, t) => t);
 * 
 * bridgeStore(
 *   component.$theme,
 *   component.themeChanged,
 *   channels.theme
 * );
 * ```
 */
export function bridgeStore<TState>(
  store: Store<TState>,
  updateEvent: Event<TState>,
  channel: ChannelDefinition<string, TState, 'peer'>,
  transport?: TypedOpenFinTransport
): () => void {
  // For stores, we just bridge the update event
  // The store will update naturally via its .on() binding
  return bridgeEvent(updateEvent, channel, transport);
}
