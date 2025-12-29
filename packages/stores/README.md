# @uth/stores

MobX stores for reactive state management across the application.

## Purpose

Centralized state management using MobX observer pattern for reactive UI updates.

## Stores

### `travelStore`

Manages travel history data, visa details, and ILR calculations.

**State:**

- `trips` - Array of departure/return trips
- `vignetteEntryDate` - Visa vignette entry date
- `visaStartDate` - Visa start date
- `ilrTrack` - ILR qualifying period (2/3/5/10 years)
- `applicationDate` - Override application date

**Actions:**

- `addTrip()`, `updateTrip()`, `deleteTrip()`
- `setVignetteEntryDate()`, `setVisaStartDate()`
- `setIlrTrack()`, `setApplicationDate()`
- `importTrips()`, `clearAllTrips()`

**Computed:**

- `totalDaysOutside` - Sum of all full days outside UK
- `continuousLeave` - Days in UK since visa start
- `maxRolling12MonthAbsence` - Maximum absence in any 12-month period
- `ilrEligibility` - Eligibility status and validation

### `authStore`

Authentication state and user management.

**State:**

- `user` - Current authenticated user
- `loading` - Auth loading state

**Actions:**

- `setUser()`, `clearUser()`
- `getIdToken()` - Get JWT token

### `paymentStore`

Payment modal and subscription state.

**State:**

- `isPaymentModalOpen` - Payment modal visibility
- `billingPeriod` - Monthly/annual selection
- `isProcessing` - Checkout processing state

**Actions:**

- `openPaymentModal()`, `closePaymentModal()`
- `setBillingPeriod()`
- `handleSubscribe()` - Create checkout session

### `navigationStore`

Navigation state for mobile menu.

**State:**

- `isMobileMenuOpen` - Mobile drawer state

**Actions:**

- `openMobileMenu()`, `closeMobileMenu()`
- `setMobileMenuOpen()`

### `navbarToolbarStore`

Dynamic toolbar items for navbar (import/export buttons).

**State:**

- `toolbarItems` - Array of React elements to render
- `currentPathname` - Current route (for cleanup)

**Actions:**

- `registerToolbarItems()` - Register toolbar for current page
- `clearToolbar()` - Clear toolbar items
- `updatePathname()` - Auto-clear on navigation

## Usage

### In React Components

```typescript
import { observer } from 'mobx-react-lite';
import { travelStore } from '@uth/stores';

export const MyComponent = observer(() => {
  const { trips, totalDaysOutside } = travelStore;

  return (
    <div>
      <p>Trips: {trips.length}</p>
      <p>Total days outside: {totalDaysOutside}</p>
      <button onClick={() => travelStore.addTrip(...)}>Add Trip</button>
    </div>
  );
});
```

### Accessing Computed Values

```typescript
import { travelStore } from '@uth/stores';

const eligibility = travelStore.ilrEligibility;
if (eligibility.isEligible) {
  console.log('Eligible for ILR!');
} else {
  console.log('Reasons:', eligibility.reasons);
}
```

## Key Patterns

### MobX Strict Mode

All stores use `makeAutoObservable` with explicit action annotations:

```typescript
constructor() {
  makeAutoObservable(this, {
    addTrip: action,
    updateTrip: action,
    // computed values auto-detected
  });
}
```

### Shallow Observables

React elements are marked as `observable.shallow` to avoid wrapping:

```typescript
makeAutoObservable(this, {
  toolbarItems: observable.shallow, // Don't observe React elements
});
```

## Testing

```bash
nx test stores
```

## Dependencies

- `mobx` - Core reactivity
- `mobx-react-lite` - React bindings
- `@uth/calculators` - ILR calculation logic

## Related

- **[`@uth/widgets`](../widgets/README.md)** - Feature gate components
- **[`@uth/calculators`](../calculators/README.md)** - ILR algorithms
