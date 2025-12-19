/**
 * Typed OpenFin Transport Layer
 * 
 * Handles dynamic window registration and bidirectional communication
 * with full type safety. Supports:
 * - Automatic window registration/unregistration
 * - Main ↔ Child bidirectional messaging
 * - Peer-to-peer messaging between any windows
 * - Heartbeat-based main window discovery
 */

import type {
  TypedMessage,
  MessageDirection,
  WindowRegistration,
  ChannelDefinition,
} from '../types/channels';

// ============================================================================
// OpenFin API Types
// ============================================================================

interface OpenFinIdentity {
  uuid: string;
  name: string;
}

interface OpenFinMe extends OpenFinIdentity {
  isWindow: boolean;
  isView: boolean;
}

interface OpenFinInterApplicationBus {
  publish(topic: string, message: unknown): Promise<void>;
  send(destination: OpenFinIdentity, topic: string, message: unknown): Promise<void>;
  subscribe(
    source: OpenFinIdentity | { uuid: '*' },
    topic: string,
    listener: (message: unknown, uuid: string, name: string) => void
  ): Promise<void>;
  unsubscribe(
    source: OpenFinIdentity | { uuid: '*' },
    topic: string,
    listener: (message: unknown, uuid: string, name: string) => void
  ): Promise<void>;
}

interface OpenFinAPI {
  me: OpenFinMe;
  InterApplicationBus: OpenFinInterApplicationBus;
}

declare const fin: OpenFinAPI | undefined;

// ============================================================================
// Transport Configuration
// ============================================================================

export interface TypedTransportConfig {
  /** Unique prefix for this application's messages */
  appId: string;
  /** Role of this window */
  role: 'main' | 'child';
  /** Window type identifier (e.g., 'chart', 'order', 'watchlist') */
  windowType: string;
  /** Channels this window can handle */
  capabilities?: string[];
  /** Enable debug logging */
  debug?: boolean;
  /** Custom window ID (auto-generated if not provided) */
  windowId?: string;
  /** Heartbeat interval in ms (default: 5000) */
  heartbeatInterval?: number;
  /** How long before considering a window stale (default: 15000) */
  staleWindowTimeout?: number;
}

// ============================================================================
// Internal Types
// ============================================================================

interface RegisteredWindow {
  registration: WindowRegistration;
  lastSeen: number;
}

type MessageHandler<T = unknown> = (
  payload: T,
  sourceWindowId: string,
  message: TypedMessage<string, T>
) => void;

type SystemMessageType = 
  | 'register' 
  | 'unregister' 
  | 'heartbeat' 
  | 'request-registration'
  | 'ack';

interface SystemMessage {
  type: SystemMessageType;
  windowId: string;
  timestamp: number;
  data?: unknown;
}

// ============================================================================
// Typed Transport Class
// ============================================================================

export class TypedOpenFinTransport {
  private readonly config: Required<TypedTransportConfig>;
  private isInitialized = false;
  private isDestroyed = false;
  
  // Window tracking
  private readonly registeredWindows = new Map<string, RegisteredWindow>();
  private mainWindowId: string | null = null;
  
  // Message handlers by channel
  private readonly channelHandlers = new Map<string, Set<MessageHandler>>();
  
  // Cleanup functions
  private readonly cleanupFns: Array<() => void | Promise<void>> = [];
  
  // Intervals
  private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
  private staleCheckIntervalId: ReturnType<typeof setInterval> | null = null;

  // Topic names (computed once)
  private readonly topics: {
    system: string;
    message: string;
  };

  constructor(config: TypedTransportConfig) {
    const windowId = config.windowId ?? this.generateWindowId();

    this.config = {
      appId: config.appId,
      role: config.role,
      windowType: config.windowType,
      capabilities: config.capabilities ?? [],
      debug: config.debug ?? false,
      windowId,
      heartbeatInterval: config.heartbeatInterval ?? 5000,
      staleWindowTimeout: config.staleWindowTimeout ?? 15000,
    };

    this.topics = {
      system: `${config.appId}:bridge:system`,
      message: `${config.appId}:bridge:message`,
    };

    // Main window knows its own ID
    if (config.role === 'main') {
      this.mainWindowId = this.config.windowId;
    }
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.log('Already initialized');
      return;
    }

    if (this.isDestroyed) {
      throw new Error('[TypedTransport] Cannot initialize destroyed transport');
    }

    this.log('Initializing...', { role: this.config.role, windowType: this.config.windowType });

    if (!this.isOpenFinAvailable()) {
      console.warn('[TypedTransport] OpenFin not available. Running in standalone mode.');
      this.isInitialized = true;
      return;
    }

    try {
      // Subscribe to system messages (registration, heartbeat, etc.)
      await this.subscribeToSystemMessages();

      // Subscribe to application messages
      await this.subscribeToAppMessages();

      // Register this window
      await this.announceRegistration();

      // Main window: start heartbeat and stale window cleanup
      if (this.config.role === 'main') {
        this.startHeartbeat();
        this.startStaleWindowCleanup();
      } else {
        // Child window: request current registrations from main
        await this.requestCurrentRegistrations();
      }

      this.isInitialized = true;
      this.log('Initialized successfully');
    } catch (error) {
      console.error('[TypedTransport] Initialization failed:', error);
      throw error;
    }
  }

  // ============================================================================
  // System Message Handling
  // ============================================================================

  private async subscribeToSystemMessages(): Promise<void> {
    const handler = (msg: unknown, uuid: string, name: string) => {
      this.handleSystemMessage(msg as SystemMessage, uuid, name);
    };

    await fin!.InterApplicationBus.subscribe({ uuid: '*' }, this.topics.system, handler);
    
    this.cleanupFns.push(async () => {
      await fin!.InterApplicationBus.unsubscribe({ uuid: '*' }, this.topics.system, handler);
    });
  }

  private handleSystemMessage(msg: SystemMessage, uuid: string, name: string): void {
    // Ignore messages from self
    if (msg.windowId === this.config.windowId) {
      return;
    }

    this.log('System message received:', msg.type, 'from', msg.windowId);

    switch (msg.type) {
      case 'register':
        this.handleWindowRegistration(msg.data as WindowRegistration);
        break;

      case 'unregister':
        this.handleWindowUnregistration(msg.windowId);
        break;

      case 'heartbeat':
        this.handleHeartbeat(msg);
        break;

      case 'request-registration':
        // Another window is asking for current state - re-announce ourselves
        if (this.config.role === 'main') {
          this.announceRegistration();
          // Also send current window list
          this.broadcastWindowList();
        }
        break;

      case 'ack':
        // Acknowledgment received (for future use)
        break;
    }
  }

  private handleWindowRegistration(registration: WindowRegistration): void {
    this.log('Window registered:', registration.windowId, `(${registration.windowType})`);
    
    this.registeredWindows.set(registration.windowId, {
      registration,
      lastSeen: Date.now(),
    });

    // Track main window
    if (registration.metadata?.role === 'main') {
      this.mainWindowId = registration.windowId;
      this.log('Main window discovered:', registration.windowId);
    }
  }

  private handleWindowUnregistration(windowId: string): void {
    if (this.registeredWindows.has(windowId)) {
      this.log('Window unregistered:', windowId);
      this.registeredWindows.delete(windowId);

      // If main window unregistered, clear reference
      if (windowId === this.mainWindowId) {
        this.mainWindowId = null;
        this.log('Main window disconnected');
      }
    }
  }

  private handleHeartbeat(msg: SystemMessage): void {
    const heartbeatData = msg.data as { mainWindowId: string; windows?: WindowRegistration[] };
    
    // Update main window reference
    if (heartbeatData.mainWindowId && this.config.role === 'child') {
      if (this.mainWindowId !== heartbeatData.mainWindowId) {
        this.mainWindowId = heartbeatData.mainWindowId;
        this.log('Main window confirmed:', this.mainWindowId);
      }
    }

    // Update window list if provided
    if (heartbeatData.windows) {
      for (const reg of heartbeatData.windows) {
        if (reg.windowId !== this.config.windowId) {
          this.registeredWindows.set(reg.windowId, {
            registration: reg,
            lastSeen: Date.now(),
          });
        }
      }
    }

    // Update last seen for the sender
    const existing = this.registeredWindows.get(msg.windowId);
    if (existing) {
      existing.lastSeen = Date.now();
    }
  }

  // ============================================================================
  // Application Message Handling
  // ============================================================================

  private async subscribeToAppMessages(): Promise<void> {
    const handler = (msg: unknown, uuid: string, name: string) => {
      this.handleIncomingMessage(msg as TypedMessage<string, unknown>);
    };

    await fin!.InterApplicationBus.subscribe({ uuid: '*' }, this.topics.message, handler);
    
    this.cleanupFns.push(async () => {
      await fin!.InterApplicationBus.unsubscribe({ uuid: '*' }, this.topics.message, handler);
    });
  }

  private handleIncomingMessage(message: TypedMessage<string, unknown>): void {
    // Ignore messages from self
    if (message.sourceWindowId === this.config.windowId) {
      return;
    }

    // Check if this window should handle the message based on direction
    if (!this.shouldHandleMessage(message)) {
      return;
    }

    this.log('Message received:', message.channel, message.direction);

    // Dispatch to registered handlers
    const handlers = this.channelHandlers.get(message.channel);
    if (handlers && handlers.size > 0) {
      for (const handler of handlers) {
        try {
          handler(message.payload, message.sourceWindowId, message);
        } catch (error) {
          console.error(`[TypedTransport] Handler error for ${message.channel}:`, error);
        }
      }
    }
  }

  private shouldHandleMessage(message: TypedMessage<string, unknown>): boolean {
    const { direction, targetWindowId } = message;
    const isMain = this.config.role === 'main';

    switch (direction) {
      case 'broadcast':
        // Main broadcasts to children - only children handle
        return !isMain;

      case 'to-main':
        // Children send to main - only main handles
        return isMain;

      case 'to-window':
        // Targeted message - only specific window handles
        return targetWindowId === this.config.windowId;

      case 'peer':
        // Peer messages - everyone except sender handles
        return true;

      default:
        return false;
    }
  }

  // ============================================================================
  // Public API: Send Messages
  // ============================================================================

  /**
   * Send a message on a typed channel.
   * The message will be routed based on the channel's direction.
   */
  async send<TName extends string, TPayload, TDirection extends MessageDirection>(
    channel: ChannelDefinition<TName, TPayload, TDirection>,
    payload: TPayload,
    targetWindowId?: string
  ): Promise<void> {
    if (!this.isInitialized) {
      console.warn('[TypedTransport] Not initialized. Message will be dropped.');
      return;
    }

    const message: TypedMessage<TName, TPayload> = {
      channel: channel.name,
      payload,
      direction: channel.direction,
      sourceWindowId: this.config.windowId,
      targetWindowId,
      timestamp: Date.now(),
    };

    this.log('Sending:', channel.name, channel.direction);

    if (this.isOpenFinAvailable()) {
      try {
        await fin!.InterApplicationBus.publish(this.topics.message, message);
      } catch (error) {
        console.error('[TypedTransport] Send failed:', error);
        throw error;
      }
    }
  }

  /**
   * Subscribe to messages on a typed channel.
   * Returns an unsubscribe function.
   */
  subscribe<TName extends string, TPayload, TDirection extends MessageDirection>(
    channel: ChannelDefinition<TName, TPayload, TDirection>,
    handler: (payload: TPayload, sourceWindowId: string, message: TypedMessage<TName, TPayload>) => void
  ): () => void {
    const channelName = channel.name;

    if (!this.channelHandlers.has(channelName)) {
      this.channelHandlers.set(channelName, new Set());
    }

    const wrappedHandler = handler as MessageHandler;
    this.channelHandlers.get(channelName)!.add(wrappedHandler);

    this.log('Subscribed to channel:', channelName);

    // Return unsubscribe function
    return () => {
      const handlers = this.channelHandlers.get(channelName);
      if (handlers) {
        handlers.delete(wrappedHandler);
        if (handlers.size === 0) {
          this.channelHandlers.delete(channelName);
        }
      }
      this.log('Unsubscribed from channel:', channelName);
    };
  }

  // ============================================================================
  // Registration & Discovery
  // ============================================================================

  private async announceRegistration(): Promise<void> {
    const registration: WindowRegistration = {
      windowId: this.config.windowId,
      windowType: this.config.windowType,
      capabilities: this.config.capabilities,
      metadata: {
        role: this.config.role,
        registeredAt: Date.now(),
      },
    };

    // Also register locally
    this.registeredWindows.set(this.config.windowId, {
      registration,
      lastSeen: Date.now(),
    });

    if (this.isOpenFinAvailable()) {
      const msg: SystemMessage = {
        type: 'register',
        windowId: this.config.windowId,
        timestamp: Date.now(),
        data: registration,
      };

      await fin!.InterApplicationBus.publish(this.topics.system, msg);
    }
  }

  private async requestCurrentRegistrations(): Promise<void> {
    if (this.isOpenFinAvailable()) {
      const msg: SystemMessage = {
        type: 'request-registration',
        windowId: this.config.windowId,
        timestamp: Date.now(),
      };

      await fin!.InterApplicationBus.publish(this.topics.system, msg);
    }
  }

  private async broadcastWindowList(): Promise<void> {
    // Only main window broadcasts the full window list
    if (this.config.role !== 'main') return;

    const windows = Array.from(this.registeredWindows.values()).map(w => w.registration);

    if (this.isOpenFinAvailable()) {
      const msg: SystemMessage = {
        type: 'heartbeat',
        windowId: this.config.windowId,
        timestamp: Date.now(),
        data: {
          mainWindowId: this.config.windowId,
          windows,
        },
      };

      await fin!.InterApplicationBus.publish(this.topics.system, msg);
    }
  }

  // ============================================================================
  // Heartbeat & Cleanup
  // ============================================================================

  private startHeartbeat(): void {
    this.heartbeatIntervalId = setInterval(() => {
      this.broadcastWindowList().catch(console.error);
    }, this.config.heartbeatInterval);

    this.cleanupFns.push(() => {
      if (this.heartbeatIntervalId) {
        clearInterval(this.heartbeatIntervalId);
        this.heartbeatIntervalId = null;
      }
    });
  }

  private startStaleWindowCleanup(): void {
    this.staleCheckIntervalId = setInterval(() => {
      const now = Date.now();
      const staleThreshold = now - this.config.staleWindowTimeout;

      for (const [windowId, entry] of this.registeredWindows) {
        // Don't remove self
        if (windowId === this.config.windowId) continue;

        if (entry.lastSeen < staleThreshold) {
          this.log('Removing stale window:', windowId);
          this.registeredWindows.delete(windowId);
        }
      }
    }, this.config.staleWindowTimeout / 2);

    this.cleanupFns.push(() => {
      if (this.staleCheckIntervalId) {
        clearInterval(this.staleCheckIntervalId);
        this.staleCheckIntervalId = null;
      }
    });
  }

  // ============================================================================
  // Public Utilities
  // ============================================================================

  /** Get this window's unique ID */
  getWindowId(): string {
    return this.config.windowId;
  }

  /** Get this window's role */
  getRole(): 'main' | 'child' {
    return this.config.role;
  }

  /** Check if this is the main window */
  isMainWindow(): boolean {
    return this.config.role === 'main';
  }

  /** Get the main window's ID (may be null if not yet discovered) */
  getMainWindowId(): string | null {
    return this.mainWindowId;
  }

  /** Get all currently registered windows */
  getRegisteredWindows(): WindowRegistration[] {
    return Array.from(this.registeredWindows.values()).map(w => w.registration);
  }

  /** Get windows by type */
  getWindowsByType(windowType: string): WindowRegistration[] {
    return this.getRegisteredWindows().filter(w => w.windowType === windowType);
  }

  /** Get windows by capability */
  getWindowsByCapability(capability: string): WindowRegistration[] {
    return this.getRegisteredWindows().filter(w => w.capabilities.includes(capability));
  }

  /** Check if transport is initialized */
  isReady(): boolean {
    return this.isInitialized && !this.isDestroyed;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  async destroy(): Promise<void> {
    if (this.isDestroyed) {
      return;
    }

    this.log('Destroying transport...');
    this.isDestroyed = true;

    // Announce unregistration
    if (this.isOpenFinAvailable() && this.isInitialized) {
      try {
        const msg: SystemMessage = {
          type: 'unregister',
          windowId: this.config.windowId,
          timestamp: Date.now(),
        };
        await fin!.InterApplicationBus.publish(this.topics.system, msg);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }

    // Run all cleanup functions
    for (const cleanup of this.cleanupFns) {
      try {
        await cleanup();
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    this.cleanupFns.length = 0;
    this.channelHandlers.clear();
    this.registeredWindows.clear();
    this.isInitialized = false;

    this.log('Transport destroyed');
  }

  // ============================================================================
  // Private Utilities
  // ============================================================================

  private isOpenFinAvailable(): boolean {
    return typeof fin !== 'undefined' && fin !== null;
  }

  private generateWindowId(): string {
    if (this.isOpenFinAvailable()) {
      return `${fin!.me.uuid}:${fin!.me.name}`;
    }
    return `window-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      const prefix = `[Transport:${this.config.role}:${this.config.windowType}]`;
      console.log(prefix, ...args);
    }
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let transportInstance: TypedOpenFinTransport | null = null;

/**
 * Create a new transport instance.
 * Only one instance can exist at a time.
 */
export function createTransport(config: TypedTransportConfig): TypedOpenFinTransport {
  if (transportInstance) {
    console.warn('[Transport] Instance already exists. Destroying previous instance.');
    transportInstance.destroy();
  }
  
  transportInstance = new TypedOpenFinTransport(config);
  return transportInstance;
}

/**
 * Get the existing transport instance.
 * Throws if not initialized.
 */
export function getTransport(): TypedOpenFinTransport {
  if (!transportInstance) {
    throw new Error('[Transport] Not initialized. Call createTransport() first.');
  }
  return transportInstance;
}

/**
 * Destroy the current transport instance.
 */
export async function destroyTransport(): Promise<void> {
  if (transportInstance) {
    await transportInstance.destroy();
    transportInstance = null;
  }
}