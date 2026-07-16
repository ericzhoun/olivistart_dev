# Butterbase backend

The site's backend is Butterbase app `app_48ul5eszfv7v` (api.butterbase.ai):
Postgres with RLS, auth (password + magic-link codes), managed Stripe Connect
billing, and the serverless functions in `functions/`.

## Layout

- `functions/*.js` - source of truth for the deployed serverless functions.
  Edit here, then deploy. Never edit only in production.
- `functions/originals/*.js` - snapshots of the functions as deployed before
  the 2026-07-15 guest-checkout work (`book-class`, `generate-sessions`,
  `mark-attendance` are unchanged and still live from these sources).
- `deploy.sh` - deploys from `functions/` via the management API.
- `schema-notes.md` - log of schema migrations applied via `schema/apply`.

## Deploying

```bash
BUTTERBASE_API_KEY=bb_sk_... ./backend/deploy.sh                # all
BUTTERBASE_API_KEY=bb_sk_... ./backend/deploy.sh guest-enroll   # one
```

The key is the app service key (Butterbase dashboard). It bypasses RLS;
never commit it or ship it to the frontend.

## Checkout flows

- Logged-in: `enroll-guard` (auth required) creates a pending enrollment for
  the user and a Stripe Checkout session; success returns to
  `registration.html`.
- Guest: `guest-enroll` (public) creates an unclaimed pending enrollment
  (`user_id NULL`); success returns to `checkout-success.html`, where a
  magic-link code signs the buyer in and `claim-enrollments` attaches the
  enrollment by verified email match.
- Fulfillment happens only in `stripe-webhook`, which re-verifies the order
  status against the billing API before confirming (public endpoint, payload
  untrusted) and is idempotent across duplicate deliveries.
- Capacity counts `confirmed` plus `pending` holds younger than 60 minutes,
  in `guest-enroll`, `enroll-guard`, and `class-availability`.
