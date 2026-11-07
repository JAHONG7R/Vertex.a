VERTEX — REAL-TIME REMINDERS (PUSH NOTIFICATIONS)
=================================================

WHAT IS INCLUDED
- Task form now accepts a time and reminder lead-time.
- Push permission / activation UI is added in Settings.
- PWA manifest and Service Worker handle push notifications and notification clicks.
- Supabase Auth bridge saves a user's browser push subscription and schedules/cancels task reminders.
- SQL schema with Row Level Security is provided.
- Edge Function sends due push notifications using Web Push/VAPID.

IMPORTANT LIMITATION
This package is the application + backend integration source. Background notifications are NOT active just by replacing the website files. The Supabase SQL, Edge Function, VAPID secrets, cron schedule, and public VAPID key must be configured first. Push requires HTTPS and a supported browser. The user must be signed in and grant notification permission. Device/browser battery and notification settings can still delay or block delivery.

FILES TO DEPLOY TO THE WEBSITE REPOSITORY
- index.html
- script.js
- style.css
- supabase-auth.js
- service-worker.js
- manifest.webmanifest
- icons/vertex-192.png
- icons/vertex-512.png

SUPABASE SETUP
1. Open Supabase SQL Editor and run REMINDER_SETUP.sql.
2. Generate a VAPID key pair locally. Do not share the private key:
   npx web-push generate-vapid-keys
3. In Supabase Edge Function Secrets, set:
   VAPID_PUBLIC_KEY = generated public key
   VAPID_PRIVATE_KEY = generated private key
   VAPID_SUBJECT = mailto:your-admin-email@example.com (use an address controlled by the project owner)
   VERTEX_CRON_SECRET = a long random secret
   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY should be available to Edge Functions by default; if not, set them securely in project secrets.
4. Add this line to the existing supabase-config.js (use the generated PUBLIC key only):
   window.VERTEX_VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY';
   Never put VAPID_PRIVATE_KEY or service-role key in frontend code or GitHub.
5. Deploy the Edge Function:
   supabase functions deploy vertex-send-reminders --no-verify-jwt
6. Enable pg_cron and pg_net in Supabase Database Extensions. Store the cron secret in Supabase Vault, then schedule a call once per minute. Example SQL (replace project URL and Vault secret name/value as appropriate):

   select vault.create_secret('YOUR_LONG_RANDOM_SECRET', 'vertex_cron_secret');

   select cron.schedule(
     'vertex-send-reminders-every-minute',
     '* * * * *',
     $$
     select net.http_post(
       url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/vertex-send-reminders',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'x-vertex-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'vertex_cron_secret' limit 1)
       ),
       body := '{}'::jsonb
     );
     $$
   );

   Check the Supabase pg_cron / Edge Function logs after setup.

7. Deploy the website over HTTPS. Sign in to Vertex, open Settings → Bildirishnomalar, and press “Bildirishnomalarni yoqish”.
8. Create a task with a date, time, and reminder lead-time. Test with a time 2–3 minutes in the future.

NOTES
- This push setup currently schedules Planner tasks. Habit reminders and recurring reminders can be added as a later phase.
- Existing user_data sync structure is not replaced. Reminder rows are stored separately in the two new tables.
- If a task is marked complete or deleted, its pending server reminder is cancelled.
- If the user is using guest mode, there is no server-side push schedule; they must sign in to use cross-session/server push.
- Do not commit private VAPID keys, Supabase service-role keys, access tokens, or cron secrets to GitHub.
