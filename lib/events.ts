import { supabase } from './supabase';

// All event types defined in spec §9. Omitting an event is a bug — treat as such.
export type EventType =
  | 'request_posted'
  | 'request_no_match'
  | 'match_shown'
  | 'response_sent'
  | 'chat_opened'
  | 'message_sent'
  | 'deal_marked'
  | 'rating_left'
  | 'search_abandoned'
  | 'profile_updated'
  | 'report_filed'
  | 'feedback_submitted'
  | 'request_closed'
  | 'consent_given';

export async function logEvent(
  type: EventType,
  payload: Record<string, unknown>,
  userId?: string,
): Promise<void> {
  const { error } = await supabase.from('events').insert({
    type,
    payload,
    user_id: userId ?? null,
  });
  if (error) {
    // Events are the product's core long-term asset. Log loudly but don't throw
    // (a failed event must never break the calling feature).
    console.error(`[events] Failed to log "${type}":`, error.message);
  }
}
