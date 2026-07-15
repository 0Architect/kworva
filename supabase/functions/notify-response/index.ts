import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface WebhookPayload {
  type: 'INSERT';
  table: string;
  record: {
    id: string;
    request_id: string;
    plug_id: string;
    message: string;
  };
  schema: string;
}

Deno.serve(async (req: Request) => {
  try {
    const payload: WebhookPayload = await req.json();
    const response = payload.record;
    console.log('[notify-response] response:', response.id, 'request:', response.request_id, 'plug:', response.plug_id);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: request } = await supabase
      .from('requests')
      .select('author_id, text')
      .eq('id', response.request_id)
      .single();

    if (!request) { console.log('[notify-response] request not found'); return new Response('request not found', { status: 200 }); }
    if (request.author_id === response.plug_id) { console.log('[notify-response] same user'); return new Response('same user', { status: 200 }); }

    console.log('[notify-response] buyer:', request.author_id);

    const { data: plug } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', response.plug_id)
      .single();

    const { data: tokenRows } = await supabase
      .from('expo_push_tokens')
      .select('token')
      .eq('user_id', request.author_id);

    console.log('[notify-response] tokens found:', tokenRows?.length ?? 0);
    if (!tokenRows?.length) return new Response('no tokens', { status: 200 });

    const plugName = plug?.display_name ?? 'Someone';
    const reqSnippet = request.text.length > 60
      ? request.text.slice(0, 57) + '…'
      : request.text;

    const messages = tokenRows.map((row: any) => ({
      to: row.token,
      title: `${plugName} can help`,
      body: `"${reqSnippet}" — tap to see the offer`,
      data: { request_id: response.request_id },
      sound: 'default',
    }));

    for (let i = 0; i < messages.length; i += 100) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      console.log('[notify-response] sending to expo push api...');
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(messages.slice(i, i + 100)),
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timer));
      const text = await res.text();
      console.log('[notify-response] expo response:', res.status, text.slice(0, 200));
    }

    return new Response(`sent to ${messages.length} tokens`, { status: 200 });
  } catch (err) {
    console.error('[notify-response] error:', err);
    return new Response('error', { status: 500 });
  }
});
