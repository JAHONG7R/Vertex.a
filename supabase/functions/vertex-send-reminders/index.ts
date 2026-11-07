import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-vertex-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders
    });
  }

  const cronSecret = Deno.env.get('VERTEX_CRON_SECRET');

  if (
    !cronSecret ||
    req.headers.get('x-vertex-cron-secret') !== cronSecret
  ) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
  const subject =
    Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com';

  if (!supabaseUrl || !serviceKey || !publicKey || !privateKey) {
    return new Response(
      JSON.stringify({
        error: 'Push secrets are not configured'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const db = createClient(supabaseUrl, serviceKey);
  const now = new Date().toISOString();

  const { data: due, error } = await db
    .from('vertex_reminders')
    .select('id,user_id,title,due_at')
    .is('sent_at', null)
    .lte('remind_at', now)
    .limit(100);

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }

  let sent = 0;
  let failed = 0;

  for (const reminder of due || []) {
    const { data: subscriptions } = await db
      .from('vertex_push_subscriptions')
      .select('id,subscription')
      .eq('user_id', reminder.user_id);

    if (!subscriptions?.length) continue;

    const body = JSON.stringify({
      title: 'Vertex · Eslatma',
      body: `“${reminder.title}” vazifangiz vaqti keldi.`,
      tag: `vertex-task-${reminder.id}`,
      url: './'
    });

    let delivered = false;

    for (const item of subscriptions) {
      try {
        await webpush.sendNotification(item.subscription, body);
        delivered = true;
      } catch (pushError) {
        const statusCode =
          (pushError as { statusCode?: number })?.statusCode;

        if (statusCode === 404 || statusCode === 410) {
          await db
            .from('vertex_push_subscriptions')
            .delete()
            .eq('id', item.id);
        }
      }
    }

    if (delivered) {
      await db
        .from('vertex_reminders')
        .update({
          sent_at: new Date().toISOString()
        })
        .eq('id', reminder.id);

      sent++;
    } else {
      failed++;
    }
  }

  return new Response(
    JSON.stringify({
      checked: due?.length || 0,
      sent,
      failed
    }),
    {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    }
  );
});
