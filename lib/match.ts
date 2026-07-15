// matchRequest — the SINGLE interface for all matching logic (spec §3.1 / §7).
// v1: calls the match_request PostgreSQL RPC (keyword + category + area + rating).
// Future: swap RPC for pgvector Edge Function without touching any caller.

import { supabase } from './supabase';
import { logEvent } from './events';
import type { RankedCandidate } from './types';

export async function matchRequest(
  requestId: string,
  userId: string,
): Promise<RankedCandidate[]> {
  const { data, error } = await supabase.rpc('match_request', {
    p_request_id: requestId,
  });

  if (error) {
    console.error('[match] match_request RPC failed:', error.message);
    return [];
  }

  const candidates: RankedCandidate[] = (data ?? []).map((row: any) => ({
    plug_id: row.plug_id as string,
    score: row.score as number,
    reason: row.reason as string,
  }));

  if (candidates.length === 0) {
    await logEvent('request_no_match', { request_id: requestId }, userId);
  } else {
    await Promise.all(
      candidates.map(c =>
        logEvent(
          'match_shown',
          { request_id: requestId, plug_id: c.plug_id, score: c.score, reason: c.reason },
          userId,
        ),
      ),
    );
  }

  return candidates;
}
