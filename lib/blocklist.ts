// Client-side content filter — checked before any request is posted.
// Catches obvious prohibited categories; not a replacement for moderation.
// Pattern + human-readable reason for the alert message.

const RULES: [RegExp, string][] = [
  // Exam malpractice ("expo" is Nigerian campus slang for leaked answers)
  [/\b(exam|test|waec|jamb|neco|gce)\s*(leak|expo|answer|cheat)/i, 'exam malpractice'],
  [/\b(expo|leak)\s*(question|answer|paper|material)/i, 'exam malpractice'],
  [/\bmalpractice\b/i, 'exam malpractice'],
  // Hard drugs
  [/\b(cocaine|heroin|codeine syrup|tramadol|mkpuru\s*mmiri|crystal\s*meth|meth)\b/i, 'prohibited substances'],
  // Fraud schemes
  [/\b(ponzi|investment\s*scheme|double\s*your\s*money|binary\s*options)\b/i, 'fraud scheme'],
  // Explicit content
  [/\b(nude|naked|porn|sex\s*tape|only\s*fans)\b/i, 'explicit content'],
];

export interface BlockResult {
  blocked: boolean;
  reason?: string;
}

export function checkContent(text: string): BlockResult {
  for (const [pattern, reason] of RULES) {
    if (pattern.test(text)) return { blocked: true, reason };
  }
  return { blocked: false };
}
