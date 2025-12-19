/**
 * Unified init.ts - Auto-detecting Window Role
 * 
 * This single init file works in BOTH main and child windows.
 * It auto-detects whether it's the main window or a child window
 * and sets up the appropriate bridges.
 * 
 * Benefits:
 * - Single init.ts for all windows
 * - Type-safe channel definitions shared across windows  
 * - Component models remain unchanged
 * - Bidirectional communication (children can send to main's websocket)
 */

import { sample, createStore } from 'effector';

// ============================================================================
// Import component models (unchanged across all windows)
// ============================================================================

import { 
  chartComponent, 
  orderComponent, 
  watchlistComponent,
  positionComponent,
  alertComponent,
} from './components/models';

// ============================================================================
// Import bridge infrastructure
// ============================================================================

import { createTransport, TypedOpenFinTransport } from '../transport/typedTransport';
import {
  createBroadcastEvent,
  createUpstreamEvent,
  createSyncedEvent,
  BroadcastEvent,
  UpstreamEvent,
  SyncedEvent,
} from '../bridge/effectorBridge';

// ============================================================================
// Import typed channel definitions
// ============================================================================

import { 
  AppChannels, 
  Instrument, 
  MarketData, 
  Order, 
  OrderStatus, 
  Position,
  Alert,
  ChartTimeRange,
  UserPreferences,
} from './channels';

// ============================================================================
// Window Role Detection
// ============================================================================

declare const fin: { me: { uuid: string; name: string } } | undefined;

function detectWindowRole(): 'main' | 'child' {
  // Method 1: Check URL/query params
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('role') === 'main') return 'main';
  if (urlParams.get('role') === 'child') return 'child';
  
  // Method 2: Check OpenFin window name
  if (typeof fin !== 'undefined') {
    const name = fin.me.name.toLowerCase();
    if (name === 'main' || name.includes('main-window')) return 'main';
  }
  
  // Method 3: Check URL path
  const path = window.location.pathname;
  if (path === '/' || path === '/main' || path.includes('/main')) return 'main';
  
  // Default: assume child
  return 'child';
}

function detectWindowType(): string {
  const path = window.location.pathname;
  if (path.includes('/chart')) return 'chart';
  if (path.includes('/order')) return 'order';
  if (path.includes('/watchlist')) return 'watchlist';
  if (path.includes('/blotter')) return 'blotter';
  if (path.includes('/position')) return 'position';
  
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('type') || 'generic';
}

// ============================================================================
// Initialize Transport
// ============================================================================

const windowRole = detectWindowRole();
const windowType = detectWindowType();

console.log(`[Bridge] Initializing as ${windowRole} window (type: ${windowType})`);

const transport = createTransport({
  appId: 'trading-app',
  role: windowRole,
  windowType: windowRole === 'main' ? 'main' : windowType,
  debug: process.env.NODE_ENV === 'development',
});

// ============================================================================
// Create Channel Bindings
// All windows create these, but they behave differently based on role
// ============================================================================

// --- Broadcast Channels (Main → Children) ---
const marketDataChannel = createBroadcastEvent(AppChannels.marketData, transport);
const orderStatusChannel = createBroadcastEvent(AppChannels.orderStatus, transport);
const positionUpdateChannel = createBroadcastEvent(AppChannels.positionUpdate, transport);
const connectionStatusChannel = createBroadcastEvent(AppChannels.connectionStatus, transport);
const systemAlertChannel = createBroadcastEvent(AppChannels.systemAlert, transport);

// --- Upstream Channels (Children → Main) ---
const submitOrderChannel = createUpstreamEvent(AppChannels.submitOrder, transport);
const cancelOrderChannel = createUpstreamEvent(AppChannels.cancelOrder, transport);
const subscribeSymbolChannel = createUpstreamEvent(AppChannels.subscribeSymbol, transport);
const unsubscribeSymbolChannel = createUpstreamEvent(AppChannels.unsubscribeSymbol, transport);

// --- Peer Channels (Any ↔ All) ---
const instrumentSelectedChannel = createSyncedEvent(AppChannels.instrumentSelected, transport);
const chartTimeRangeChannel = createSyncedEvent(AppChannels.chartTimeRange, transport);
const userPreferencesChannel = createSyncedEvent(AppChannels.userPreferences, transport);

// ============================================================================
// Shared State
// ============================================================================

const $isConnected = createStore(false)
  .on(connectionStatusChannel.received, (_, { connected }) => connected);

// For main window, we also track connection state locally
if (windowRole === 'main') {
  // Main window would set this from websocket status
}

// ============================================================================
// Component Wiring (works in ALL windows)
// ============================================================================

// --- Instrument Selection (peer sync) ---
// When local component selects, fire the synced event
sample({
  clock: watchlistComponent.instrumentClicked,
  target: instrumentSelectedChannel.fire,
});

// When synced event triggers (from any window), update local components
sample({
  clock: instrumentSelectedChannel.triggered,
  filter: (inst): inst is Instrument => inst !== null,
  target: chartComponent.showInstrument,
});

sample({
  clock: instrumentSelectedChannel.triggered,
  filter: (inst): inst is Instrument => inst !== null,
  fn: (inst) => inst.symbol,
  target: orderComponent.setSymbol,
});

sample({
  clock: instrumentSelectedChannel.triggered,
  filter: (inst): inst is Instrument => inst !== null,
  fn: (inst) => inst.symbol,
  target: watchlistComponent.highlightSymbol,
});

// --- Market Data (broadcast from main) ---
sample({
  clock: marketDataChannel.received,
  target: chartComponent.updateMarketData,
});

// --- Order Status (broadcast from main) ---
sample({
  clock: orderStatusChannel.received,
  target: orderComponent.orderStatusUpdated,
});

// --- Position Updates (broadcast from main) ---
sample({
  clock: positionUpdateChannel.received,
  target: positionComponent.positionsUpdated,
});

// --- System Alerts (broadcast from main) ---
sample({
  clock: systemAlertChannel.received,
  target: alertComponent.showAlert,
});

// --- Order Submission (upstream to main) ---
sample({
  clock: orderComponent.orderSubmitted,
  target: submitOrderChannel.send,
});

// --- Order Cancellation (upstream to main) ---
sample({
  clock: orderComponent.cancelClicked,
  fn: (orderId) => ({ orderId }),
  target: cancelOrderChannel.send,
});

// --- Chart Time Range (peer sync) ---
sample({
  clock: chartComponent.timeRangeChanged,
  target: chartTimeRangeChannel.fire,
});

sample({
  clock: chartTimeRangeChannel.triggered,
  target: chartComponent.setTimeRange,
});

// --- Auto-subscribe to instrument data when selected ---
sample({
  clock: instrumentSelectedChannel.triggered,
  filter: (inst): inst is Instrument => inst !== null,
  fn: (inst) => ({
    symbol: inst.symbol,
    dataTypes: ['quote', 'trade'] as ('quote' | 'trade' | 'depth')[],
  }),
  target: subscribeSymbolChannel.send,
});

// ============================================================================
// Main Window Only: Websocket Integration
// ============================================================================

if (windowRole === 'main') {
  // These would be your actual websocket effects/events
  // Here we just show the pattern
  
  console.log('[Main] Setting up websocket bridges...');
  
  // Example: websocket.onMarketData → broadcast to children
  // sample({
  //   clock: websocketMarketDataReceived,
  //   target: marketDataChannel.broadcast,
  // });
  
  // Example: upstream order received → send to websocket
  // sample({
  //   clock: submitOrderChannel.received,
  //   fn: (order) => ({ type: 'ORDER_SUBMIT', payload: order }),
  //   target: websocketSendFx,
  // });
}

// ============================================================================
// Initialize
// ============================================================================

async function initialize() {
  await transport.initialize();
  console.log(`[Bridge] Initialized as ${windowRole} window`);
  
  if (windowRole === 'main') {
    console.log('[Main] Ready to receive child window connections');
  } else {
    console.log(`[Child:${windowType}] Connected to main window`);
  }
}

initialize().catch(console.error);

// ============================================================================
// Cleanup
// ============================================================================

window.addEventListener('beforeunload', () => {
  transport.destroy();
});

// ============================================================================
// Exports
// ============================================================================

export {
  // Transport & role info
  transport,
  windowRole,
  windowType,
  
  // Connection state
  $isConnected,
  
  // Synced events (can be triggered from any window)
  instrumentSelectedChannel as instrumentSelection,
  chartTimeRangeChannel as chartTimeRange,
  userPreferencesChannel as userPreferences,
  
  // Upstream events (children call .send, main receives on .received)
  submitOrderChannel as submitOrder,
  cancelOrderChannel as cancelOrder,
  subscribeSymbolChannel as subscribeSymbol,
  unsubscribeSymbolChannel as unsubscribeSymbol,
  
  // Broadcast events (main calls .broadcast, children receive on .received)
  marketDataChannel as marketData,
  orderStatusChannel as orderStatus,
  positionUpdateChannel as positionUpdate,
  systemAlertChannel as systemAlert,
  connectionStatusChannel as connectionStatus,
};

// Type exports
export type { Instrument, MarketData, Order, OrderStatus, Position, Alert };
