# kworva

**Campus help, on demand.**

Post what you need. Someone nearby helps. Tutoring, borrowing, errands, a lift, a quick gig — the stuff no shop sells and no vendor lists. Say it in plain words and let it come to you.

→ **[Download for Android](https://expo.dev/accounts/anthony_ayeke/projects/kworva/builds/c71901f4-7675-4897-8971-225071cf470a)** · **[Landing page](https://kworva.netlify.app)**

---

## What it is

Kworva is a lightweight marketplace for Nigerian campus communities. Instead of scrolling group chats hoping someone can help, you post a request — a lesson, something to borrow, someone heading your way, a hand with a task — and plugs (people who can sort you out) respond directly.

The core loop:

1. **Post what you need** — a request in plain words, with a category and your area
2. **A plug responds** — "I've got this", with a price or offer
3. **Chat and close** — agree on the details, get it done, rate each other

No storefront. No listing fee. No vendor profile to set up. Just a request and a response.

---

## Current status

**Beta — Android, Unilag.** The APK is live and downloadable. Anonymous sign-in means zero friction to get started: no email, no phone number required on first launch. OTA updates (Expo EAS Update) mean the app improves without requiring a reinstall.

---

## Feature set

| Area | What's shipped |
|---|---|
| Feed | Browse open requests, filter by category |
| Posting | Create requests with type (buy / borrow / hire / split / swap), budget, area |
| Responding | Plug responds with message + price; request author accepts or declines |
| Chat | Real-time 1:1 chat per request×plug pair (Supabase Realtime) |
| Fulfillment | Mark a request as fulfilled; rate the other party (1–5 stars) |
| Notifications | FCM push notifications for new responses and chat messages |
| Safety | Report (harmful / malpractice / harassment) and block users |
| Consent | Consent gate on first launch; privacy policy; in-app feedback |
| Auth | Anonymous sign-in by default; designed for future phone OTP upgrade |

---

## Tech stack

### App
- **React Native** via [Expo SDK 56](https://docs.expo.dev/versions/v56.0.0/)
- **Expo Router v4** — file-based routing, typed routes
- **TypeScript** throughout
- **Supabase JS v2** — auth, database, realtime
- **expo-notifications** + **FCM** — push delivery on Android

### Backend
- **Supabase** (PostgreSQL + Auth + Realtime + Edge Functions + Row Level Security)
- **Supabase Edge Functions** (Deno) — `notify-response`, `notify-chat`, `match-request`, `notify-matches`
- **Database Webhooks** — trigger Edge Functions on INSERT events
- **EAS Build** — Android APK, preview profile
- **EAS Update** — OTA JS updates without a rebuild

### Infrastructure
- App distributed via Expo Go / EAS APK
- Landing page on Netlify (`landing/`)
- Firebase project for FCM credentials (V1 API)

---

## Project structure

```
app/
  _layout.tsx          # Root layout, auth context, push registration
  index.tsx            # Entry — redirects based on consent / onboarding state
  consent.tsx          # First-launch consent gate
  onboarding.tsx       # Display name + area setup
  (tabs)/
    index.tsx          # Request feed
    chats.tsx          # Chat list
    activity.tsx       # My requests + responses
    profile.tsx        # Profile, settings, sign-out
  request/[id].tsx     # Request detail + respond + report/block
  chat/[id].tsx        # Real-time 1:1 chat
  composer.tsx         # Post a request (modal)
  feedback.tsx         # In-app feedback
  policy.tsx           # Privacy policy

lib/
  supabase.ts          # Supabase client
  push.ts              # Push token registration
  events.ts            # Append-only analytics events
  types.ts             # Shared TypeScript types

supabase/
  migrations/          # SQL migrations (run in order in Supabase SQL editor)
  functions/
    notify-response/   # Webhook → push when plug responds
    notify-chat/       # Webhook → push when message sent
    match-request/     # Match new request against capacity tags
    notify-matches/    # Notify matched plugs

landing/               # Static landing page (Netlify)
  index.html
  privacy.html
```

---

## Running locally

### Prerequisites
- Node 20+
- Expo CLI: `npm install -g expo-cli`
- A [Supabase](https://supabase.com) project

### Setup

```bash
git clone https://github.com/anthony-ayeke/kworva.git
cd kworva
npm install
cp .env.example .env
```

Fill in `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Run the SQL migrations in order in your Supabase SQL editor:

```
supabase/migrations/001_initial.sql
supabase/migrations/002_expo_push_tokens.sql
supabase/migrations/003_consent_feedback_blocks.sql
```

Start Metro:

```bash
npx expo start
```

Use the Expo Go app on Android to scan the QR code, or run on an emulator.

### Push notifications (optional for local dev)

Push notifications require a native build with a `google-services.json` from a Firebase project:

1. Create a Firebase project, add an Android app with package `com.kworva.app`
2. Download `google-services.json` and place it in the project root
3. Upload FCM V1 credentials to EAS: `npx eas-cli credentials`
4. Build: `npx eas-cli build --profile preview --platform android`

---

## Database schema (summary)

```
profiles          — extends auth.users; display name, campus, area, rating
requests          — what someone needs; status: open → matched → closed
responses         — plug replies to a request; status: sent → accepted
chats             — one per request×plug pair
messages          — chat messages (Realtime enabled)
ratings           — post-deal star ratings; triggers profile avg update
reports           — safety reports (user / request / message)
user_blocks       — block list; filters feed and chat
capacity_tags     — plug's standing supply (matching hint)
expo_push_tokens  — FCM tokens per user (many-to-one)
events            — append-only analytics log
categories        — seeded: Food, Repairs, Thrift, Academics, Grooming, Electronics, Events, Errands, Other
```

All tables have Row Level Security enabled. Edge Functions use the service role key and bypass RLS.

---

## Roadmap

- [ ] Phone OTP upgrade flow (anon → verified identity)
- [ ] iOS build
- [ ] Expand beyond Unilag
- [ ] In-app ratings prompt after fulfillment
- [ ] Plug capacity matching (auto-notify plugs when a matching request is posted)

---

## License

MIT — see [LICENSE](LICENSE).
