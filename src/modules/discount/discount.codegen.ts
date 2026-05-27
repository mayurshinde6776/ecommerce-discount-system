import { randomBytes } from 'crypto';

// ─── Word lists for readable codes ────────────────────────────────────────────

const ADJECTIVES = [
  'SWIFT', 'BOLD', 'BRIGHT', 'CALM', 'CRISP',
  'DEFT', 'EPIC', 'FAIR', 'GRAND', 'KEEN',
  'LUSH', 'MINT', 'NEAT', 'PRIME', 'PURE',
  'RARE', 'RICH', 'SHARP', 'SLEEK', 'SMART',
  'SOLID', 'STARK', 'TRIM', 'TRUE', 'VAST',
];

const NOUNS = [
  'ACE', 'ARC', 'BAY', 'CUE', 'DAY',
  'DOT', 'ERA', 'FLY', 'GEM', 'HUB',
  'JET', 'KEY', 'LAB', 'MAP', 'MAX',
  'OAK', 'OPT', 'PAK', 'POD', 'RAY',
  'ROW', 'SKY', 'SUM', 'TAB', 'TIP',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a cryptographically random integer in [0, max) */
const secureRandInt = (max: number): number =>
  randomBytes(4).readUInt32BE(0) % max;

/** Pick a random element from an array */
const pick = <T>(arr: T[]): T => arr[secureRandInt(arr.length)];

/** Pad a number to fixed width with leading zeroes */
const padded = (n: number, width = 3): string => String(n).padStart(width, '0');

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates a human-readable, collision-resistant discount code.
 *
 * Format: {PREFIX}-{ADJECTIVE}{NOUN}-{3-digit-number}
 * Example: REWARD-SWIFTACE-042
 *
 * The numeric suffix makes collisions extremely unlikely without
 * sacrificing readability. Swap in a DB unique constraint for production.
 */
export const generateDiscountCode = (prefix = 'REWARD'): string => {
  const adj = pick(ADJECTIVES);
  const noun = pick(NOUNS);
  const num = padded(secureRandInt(1000));
  return `${prefix}-${adj}${noun}-${num}`;
};
