import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface WebhookPayload {
  type: 'INSERT';
  table: string;
  record: {
    id: string;
    chat_id: string;
    sender_id: string;
    body: string;
  };
  schema: string;
}

Deno.serve(async (req: Request) => {
  try {
    const payload: WebhookPayload = await req.json();
    const msg = payload.record;
    console.log('[notify-chat] message:', msg.id, 'chat:', msg.chat_id, 'sender:', msg.sender_id);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: chat } = await supabase
      .from('chats')
      .select('buyer_id, plug_id')
      .eq('id', msg.chat_id)
      .single();

    if (!chat) { console.log('[notify-chat] chat not found'); return new Response('chat not found', { status: 200 }); }

    const recipientId = msg.sender_id === chat.buyer_id ? chat.plug_id : chat.buyer_id;
    console.log('[notify-chat] recipient:', recipientId);

    const { data: sender } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', msg.sender_id)
      .single();

    const { data: tokenRows } = await supabase
      .from('expo_push_tokens')
      .select('token')
      .eq('user_id', recipientId);

    console.log('[notify-chat] tokens found:', tokenRows?.length ?? 0);
    if (!tokenRows?.length) return new Response('no tokens', { status: 200 });

    const senderName = sender?.display_name ?? 'Someone';
    const body = msg.body.length > 100 ? msg.body.slice(0, 97) + '…' : msg.body;

    const messages = tokenRows.map((row: any) => ({
      to: row.token,
      title: senderName,
      body,
      data: { chat_id: msg.chat_id },
      sound: 'default',
    }));

    for (let i = 0; i < messages.length; i += 100) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      console.log('[notify-chat] sending to expo push api...');
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
      console.log('[notify-chat] expo response:', res.status, text.slice(0, 200));
    }

    return new Response(`sent to ${messages.length} tokens`, { status: 200 });
  } catch (err) {
    console.error('[notify-chat] error:', err);
    return new Response('error', { status: 500 });
  }
});
