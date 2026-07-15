// M2 — matchRequest Edge Function
// This is the SINGLE interface for all matching logic (spec §3.1 / §7).
// v1 impl: keyword + category + transaction_type + area + recency/rating ranking (plain SQL).
// Swap in pgvector/embeddings later WITHOUT touching callers.
//
// TODO(kworva): implement v1 matching SQL in M2
// TODO(kworva): add pgvector semantic similarity as M4+ ranking signal for 'swap' type

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RankedCandidate {
  plug_id: string;
  score: number;
  reason: string;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const { request_id } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // TODO(kworva): M2 — fetch request, run ranking SQL, emit match_shown / request_no_match events
  const candidates: RankedCandidate[] = [];

  return new Response(JSON.stringify({ candidates }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
