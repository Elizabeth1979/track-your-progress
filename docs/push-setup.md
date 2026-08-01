# Push notifications setup

The app works without any of this. If push is not configured, the notification
section in Settings reports itself as unavailable and nothing else changes. Set it
up when you want reminders and family alerts.

## What push is used for

| Event | Who receives it |
|---|---|
| A child completes a task that needs approval | The parents |
| A parent approves a task | The family's devices |
| A child asks to redeem a reward | The parents |
| A parent adds a new task | The family's devices |
| Daily slot reminders (morning / afternoon / evening) | The family's devices |

Notification text is deliberately generic by default so a child's name and
activity do not appear on a locked screen. The `notify_generic_lockscreen` column
on `families` controls this.

---

## Step 1 — Generate a VAPID key pair

VAPID is how a push service verifies that notifications genuinely come from your
server. You need one pair, generated once.

```bash
node scripts/generate-vapid-keys.mjs
```

It prints two keys:

- The **public** key goes in `VITE_VAPID_PUBLIC_KEY`, in your local `.env` and in
  the Vercel environment variables. It is compiled into the client and is meant to
  be public.
- The **private** key goes into Supabase Edge Function secrets and **nowhere
  else**. Never commit it, never put it in `.env`, never paste it into the client.

Redeploy on Vercel after adding the public key — build-time variables are baked
into the bundle.

## Step 2 — Give the Edge Functions the private key

```bash
supabase secrets set \
  VAPID_PRIVATE_KEY=<the private key> \
  VAPID_PUBLIC_KEY=<the public key> \
  VAPID_SUBJECT=mailto:you@example.com
```

`VAPID_SUBJECT` must be a real `mailto:` or `https:` URL — push services reject
requests without a valid contact.

## Step 3 — Let the database call the Edge Functions

Database triggers notify the family when things happen, and a scheduled job sends
the daily reminders. Both call an Edge Function over HTTP, which needs the
service-role key. That key is never committed, so it is stored in Supabase Vault
and read at call time.

Run this once in the SQL editor, substituting your own values:

```sql
select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
```

The service-role key is in **Project Settings → API**. It bypasses Row Level
Security entirely — treat it like a root password. It should only ever exist in
Vault and in Edge Function secrets.

Until these two secrets exist, `private.call_edge_function` returns immediately
without doing anything. That is intentional: a missing push configuration must
never cause a child's completed task to fail to save.

## Step 4 — Schedule the reminder sweep

```sql
select cron.schedule(
  'kidtasks-reminders',
  '*/5 * * * *',
  $$ select private.call_edge_function('send-reminders', '{}'::jsonb) $$
);
```

The function runs every five minutes, compares the current time in each family's
timezone against their configured reminder times, and pushes only to families with
a slot falling due. Five-minute granularity is why reminder times are set in
five-minute steps in the UI.

Verify it is registered:

```sql
select jobname, schedule, active from cron.job;
```

## Step 5 — Turn it on in the app

Open **Settings → Notifications** and enable them. The app shows an explanation
first and only then asks the browser for permission — asking cold is the fastest
way to get permanently blocked.

---

## Platform limitations, honestly

**iPhone and iPad.** Web push only works if the app has been added to the home
screen, on iOS 16.4 or later. In Safari as an ordinary tab it will not work at
all, and there is nothing the app can do about it. The `/install` screen walks
users through adding it.

**No local scheduled notifications.** A web app cannot schedule a notification to
fire on a device while it is closed. Everything that arrives when the app is not
running comes from the server, which is why the reminder cron exists. A timer
finishing while you are in another app will notify you; a timer finishing after
the browser has been fully closed will not.

**Permission is per-device and per-browser.** Each phone, tablet and laptop
subscribes separately, and each one has to enable notifications once.

**Subscriptions expire.** Push services drop subscriptions periodically. The app
re-validates on launch and re-subscribes silently. If a device stops receiving
notifications, toggling the setting off and on again re-registers it.

---

## Rotating the keys

If the private key is ever exposed, generate a new pair and update
`VITE_VAPID_PUBLIC_KEY` (Vercel, then redeploy) and the Edge Function secrets.
Every existing subscription becomes invalid, so every device must re-enable
notifications. Clear the stale rows:

```sql
delete from public.push_subscriptions;
```

## When notifications do not arrive

1. `select jobname, active from cron.job;` — is the sweep scheduled and active?
2. Check the `send-reminders` and `notify-events` logs in the Supabase dashboard.
3. `select count(*) from public.push_subscriptions;` — did the device register?
4. Confirm both Vault secrets exist, spelled exactly `service_role_key` and
   `project_url`.
5. Confirm the browser's own notification permission for the site has not been
   denied at the OS level.
