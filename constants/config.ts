// Campus comes from the user's profile (entered at onboarding).
// No longer a global constant — kept here as empty fallback only.
export const CAMPUS = '';

// Transaction type labels for UI display
export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  buy: 'Buy',
  borrow_rent: 'Borrow / Rent',
  hire: 'Hire',
  split: 'Split',
  swap: 'Swap',
};

// Request expiry default (72 hours)
export const DEFAULT_EXPIRY_HOURS = 72;
