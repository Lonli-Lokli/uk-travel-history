# OpenFin-Effector Bridge v2

Type-safe, bidirectional cross-window state synchronization for Effector applications in OpenFin.

## Key Features

- ✅ **Zero component modifications** - Bridge lives entirely in `init.ts`
- ✅ **Full TypeScript safety** - Channels are strongly typed end-to-end
- ✅ **Bidirectional communication** - Children can send to main (for websocket outgoing)
- ✅ **Dynamic windows** - Child windows register automatically at runtime
- ✅ **Hub pattern** - Main window owns external connections (websocket, etc.)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MAIN WINDOW                                     │
│  ┌─────────────────┐    ┌──────────────────┐    ┌───────────────────────┐  │
│  │   Components    │───►│    init.ts       │───►│     WebSocket         │  │
│  │   (unchanged)   │◄───│    (bridge)      │◄───│     Connection        │  │
│  └─────────────────┘    └────────┬─────────┘    └───────────────────────┘  │
│                                  │                                          │
│                    ┌─────────────┴─────────────┐                           │
│                    │   OpenFin IAB Transport   │                           │
│                    └─────────────┬─────────────┘                           │
└──────────────────────────────────┼──────────────────────────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  CHILD: Chart   │    │  CHILD: Order   │    │  CHILD: Watch   │
│  ┌───────────┐  │    │  ┌───────────┐  │    │  ┌───────────┐  │
│  │Components │  │    │  │Components │  │    │  │Components │  │
│  │(unchanged)│  │    │  │(unchanged)│  │    │  │(unchanged)│  │
│  └─────┬─────┘  │    │  └─────┬─────┘  │    │  └─────┬─────┘  │
│        │        │    │        │        │    │        │        │
│  ┌─────┴─────┐  │    │  ┌─────┴─────┐  │    │  ┌─────┴─────┐  │
│  │  init.ts  │  │    │  │  init.ts  │  │    │  │  init.ts  │  │
│  │  (bridge) │  │    │  │  (bridge) │  │    │  │  (bridge) │  │
│  └───────────┘  │    │  └───────────┘  │    │  └───────────┘  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Channel Types

| Type | Direction | Use Case |
|------|-----------|----------|
| **Broadcast** | Main → Children | Market data, order status from websocket |
| **Upstream** | Children → Main | Order submission, subscriptions to websocket |
| **Peer** | Any ↔ All | UI state sync (selected instrument, theme) |
| **Targeted** | Window → Window | Direct commands to specific window |

## Quick Start

### 1. Define Your Channels (Full Type Safety)

```typescript
// channels.ts
import { defineBroadcastChannel, defineUpstreamChannel, definePeerChannel } from '@your-org/openfin-effector-bridge';

export interface MarketData {
  symbol: string;
  price: number;
  timestamp: number;
}

export interface Order {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
}

export const AppChannels = {
  // Main broadcasts to children (websocket incoming)
  marketData: defineBroadcastChannel<'marketData', MarketData>('marketData'),
  
  // Children send to main (websocket outgoing)
  submitOrder: defineUpstreamChannel<'submitOrder', Order>('submitOrder'),
  
  // Syncs across all windows
  instrumentSelected: definePeerChannel<'instrumentSelected', string | null>('instrumentSelected'),
} as const;
```

### 2. Setup Main Window

```typescript
// init.main.ts
import { createTransport, createBroadcastEvent, createUpstreamEvent } from '@your-org/openfin-effector-bridge';
import { AppChannels } from './channels';
import { sample } from 'effector';

// Initialize as main window
const transport = createTransport({
  appId: 'my-app',
  role: 'main',
  windowType: 'main',
});

// Create channel bindings
const marketData = createBroadcastEvent(AppChannels.marketData, transport);
const submitOrder = createUpstreamEvent(AppChannels.submitOrder, transport);

// Websocket → Broadcast to children
sample({
  clock: websocket.dataReceived,
  target: marketData.broadcast,  // Sends to all children
});

// Children's orders → Websocket
sample({
  clock: submitOrder.received,   // Receives from children
  target: websocket.sendOrderFx,
});

await transport.initialize();
```

### 3. Setup Child Windows (Dynamic)

```typescript
// init.child.ts
import { createTransport, createBroadcastEvent, createUpstreamEvent } from '@your-org/openfin-effector-bridge';
import { AppChannels } from './channels';
import { sample } from 'effector';
import * as chart from './components/chart/model';
import * as order from './components/order/model';

// Initialize as child window
const transport = createTransport({
  appId: 'my-app',
  role: 'child',
  windowType: 'chart',  // or 'order', 'watchlist', etc.
});

// Create channel bindings (same channels as main)
const marketData = createBroadcastEvent(AppChannels.marketData, transport);
const submitOrder = createUpstreamEvent(AppChannels.submitOrder, transport);

// Receive broadcasts → Update local components
sample({
  clock: marketData.received,    // Receives from main
  target: chart.updatePrice,
});

// Local events → Send to main
sample({
  clock: order.submitted,
  target: submitOrder.send,      // Sends to main
});

await transport.initialize();
```

### 4. Unified init.ts (Optional)

Use a single init.ts that auto-detects window role:

```typescript
// init.ts
const role = detectWindowRole(); // 'main' or 'child'

const transport = createTransport({
  appId: 'my-app',
  role,
  windowType: role === 'main' ? 'main' : getWindowType(),
});

// Same wiring works in both main and child!
// The channel bindings behave differently based on role
```

## API Reference

### Channel Definition

```typescript
// Main → Children (websocket incoming data)
defineBroadcastChannel<'name', PayloadType>('name')

// Children → Main (websocket outgoing commands)
defineUpstreamChannel<'name', PayloadType>('name')

// Any → All others (UI state sync)
definePeerChannel<'name', PayloadType>('name')

// Specific window → Specific window
defineTargetedChannel<'name', PayloadType>('name')
```

### Transport

```typescript
const transport = createTransport({
  appId: string,           // Your app identifier
  role: 'main' | 'child',  // Window role
  windowType: string,      // Window type (e.g., 'chart', 'order')
  capabilities?: string[], // Channels this window handles
  debug?: boolean,         // Enable logging
});

await transport.initialize();
```

### Channel Bindings

```typescript
// Broadcast (main → children)
const { broadcast, received, destroy } = createBroadcastEvent(channel, transport);
// Main calls: broadcast(payload)
// Children receive: sample({ clock: received, target: ... })

// Upstream (children → main)
const { send, received, destroy } = createUpstreamEvent(channel, transport);
// Children call: send(payload)
// Main receives: sample({ clock: received, target: ... })

// Peer sync (any ↔ all)
const { fire, received, triggered, destroy } = createSyncedEvent(channel, transport);
// Any window calls: fire(payload)
// All windows (including sender) receive: sample({ clock: triggered, target: ... })
```

## Type Safety Examples

```typescript
// ✅ Correct - types match channel definition
submitOrder.send({ symbol: 'AAPL', side: 'buy', quantity: 100 });

// ❌ Compile error - missing 'quantity'
submitOrder.send({ symbol: 'AAPL', side: 'buy' });

// ❌ Compile error - wrong type for 'side'
submitOrder.send({ symbol: 'AAPL', side: 'hold', quantity: 100 });

// ✅ Payload type is inferred correctly
sample({
  clock: marketData.received,
  fn: (data) => data.price,  // TypeScript knows data is MarketData
  target: priceStore,
});
```

## Dynamic Window Registration

Child windows register automatically when they call `transport.initialize()`. The main window tracks all connected windows:

```typescript
// In main window
transport.getRegisteredWindows();
// Returns: [{ windowId: '...', windowType: 'chart', capabilities: [...] }, ...]

transport.getWindowsByType('chart');
// Returns all chart windows
```

## Best Practices

1. **Define channels in a shared file** - Import in both main and child windows
2. **Use meaningful channel names** - `submitOrder` not `data1`
3. **One channel per data type** - Don't multiplex different types
4. **Clean up on unload** - Call `transport.destroy()` and channel `.destroy()` methods
5. **Use unified init.ts** - Reduces code duplication

## Migration from v1

```typescript
// v1
bridge.syncEvent(someEvent, 'eventId');

// v2 - More explicit, better types
const channel = definePeerChannel<'eventId', PayloadType>('eventId');
const sync = createSyncedEvent(channel, transport);
sample({ clock: someEvent, target: sync.fire });
sample({ clock: sync.triggered, target: someTarget });
```

## License

MIT
