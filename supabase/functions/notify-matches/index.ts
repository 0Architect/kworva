// Supabase Edge Function — triggered by Database Webhook on requests INSERT.
// Calls match_request RPC → fetches push tokens → fires Expo Push API.
// Deploy via: Supabase dashboard → Edge Functions → New function → paste this file.
// Then: Database → Webhooks → Create webhook:
//   Table: requests, Event: INSERT
//   URL: https://<ref>.supabase.co/functions/v1/notify-matches
//   Headers: Authorization: Bearer <service-role-key>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface WebhookPayload {
  type: 'INSERT';
  table: string;
  record: {
    id: string;
    author_id: string;
    text: string;
    area: string;
    transaction_type: string;
  };
  schema: string;
}

interface Candidate {
  plug_id: string;
  score: number;
  reason: string;
}

Deno.serve(async (req: Request) => {
  try {
    const payload: WebhookPayload = await req.json();
    const request = payload.record;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Get matched plugs
    const { data: candidates, error: rpcErr } = await supabase
      .rpc('match_request', { p_request_id: request.id });

    if (rpcErr) {
      console.error('[notify] match_request failed:', rpcErr.message);
      return new Response('rpc error', { status: 500 });
    }

    if (!candidates?.length) return new Response('no matches', { status: 200 });

    const plugIds = (candidates as Candidate[]).map(c => c.plug_id);

    // Fetch push tokens for matched plugs from expo_push_tokens table
    const { data: tokenRows } = await supabase
      .from('expo_push_tokens')
      .select('user_id, token')
      .in('user_id', plugIds);

    if (!tokenRows?.length) return new Response('no tokens', { status: 200 });

    // Build Expo push messages (one per token)
    const messages = tokenRows.map((row: any) => ({
      to: row.token,
      title: `New request near ${request.area}`,
      body: request.text.length > 100
        ? request.text.slice(0, 97) + '…'
        : request.text,
      data: { request_id: request.id },
      sound: 'default',
    }));

    // Send via Expo Push API (batches of 100)
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(batch),
      });
    }

    return new Response(`sent to ${messages.length} tokens`, { status: 200 });
  } catch (err) {
    console.error('[notify] unhandled error:', err);
    return new Response('error', { status: 500 });
  }
});
