# Deployment Guide

## Pre-Deploy Verification

Run the full verification bundle from the repo root:

```bash
npm run verify
```

To package the app as a container image:

```bash
docker build -t aiqda .
```

This runs:

- backend integration tests
- frontend production build

The repository also includes a GitHub Actions workflow at [.github/workflows/ci.yml](/Users/mac/Desktop/Aiqda/Aiqda/.github/workflows/ci.yml) that runs the same verification on pushes and pull requests with MongoDB.

## Required Production Environment

Use [backend/.env.example](/Users/mac/Desktop/Aiqda/Aiqda/backend/.env.example) as the base reference.

Required in production:

- `NODE_ENV=production`
- `PORT`
- `MONGODB_URI`
- `JWT_SECRET`
- `FRONTEND_URL`
- `REDIS_URL`
- `EBAA_REVIEWER_PASSWORD`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`
- `STUDIO_APPLICATION_MEETING_URL`

Recommended:

- `CONTACT_NOTIFICATION_TO`
- `TRUST_PROXY`
- `AUTH_COOKIE_NAME`
- `AUTH_COOKIE_SAME_SITE`
- `AUTH_COOKIE_DOMAIN`
- `AUTH_COOKIE_MAX_AGE_MS`
- `DEVICE_COOKIE_NAME`
- `DEVICE_COOKIE_MAX_AGE_MS`
- `MAX_AUTH_DEVICES`
- `AUTH_ACTIVE_SESSION_IDLE_TIMEOUT_MS`
- `EBAA_REVIEWER_NAME`
- `EBAA_REVIEWER_EMAIL`
- `VIMEO_ACCESS_TOKEN`
- `VIMEO_ALLOWED_EMBED_DOMAINS`
- `JWT_EXPIRES_IN`
- `AUTH_REGISTER_RATE_LIMIT_MAX`
- `AUTH_LOGIN_RATE_LIMIT_MAX`
- `AUTH_SOCIAL_RATE_LIMIT_MAX`
- `INVITE_ACCEPT_RATE_LIMIT_MAX`
- `CONTACT_SUBMISSION_RATE_LIMIT_MAX`
- `INSTRUCTOR_APPLICATION_RATE_LIMIT_MAX`
- `STUDIO_APPLICATION_RATE_LIMIT_MAX`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `LINKEDIN_OAUTH_CLIENT_ID`
- `LINKEDIN_OAUTH_CLIENT_SECRET`

If you enable social login, configure the provider redirect URIs to point to your backend callback endpoints:

- Google: `https://your-domain.com/api/auth/social/google/callback`
- LinkedIn: `https://your-domain.com/api/auth/social/linkedin/callback`

## Device Access Policy

- `MAX_AUTH_DEVICES=2` keeps each account restricted to two approved browser devices.
- `AUTH_ACTIVE_SESSION_IDLE_TIMEOUT_MS=900000` means a session is treated as actively in use for 15 minutes after its last authenticated request, which prevents concurrent cross-device sign-ins while still allowing a stale device to time out naturally.
- Users on a third browser/device receive a friendly login error instead of silently replacing an approved device.

## Vimeo Notes

- Set `VIMEO_ALLOWED_EMBED_DOMAINS` to your real public website domains in production, for example `aiqda.pro,www.aiqda.pro`.
- Do not rely on `localhost` for Vimeo domain-level privacy. Vimeo expects public hostnames for embed whitelisting.
- Paid Vimeo plans enable stronger privacy and player controls, but Vimeo's separate Analytics API remains Enterprise-only.

## Seeding Policy

Automatic seeding should remain disabled in production.

- `AUTO_SEED_DEMO_DATA=false`
- `AUTO_SEED_CONSULTATIONS=false`
- `ALLOW_PRODUCTION_AUTO_SEED=false`

If you need to seed data manually:

```bash
cd backend
npm run seed:consultations
```

Demo data seeding is available for non-production environments only:

```bash
cd backend
npm run seed:demo
```

## Startup Safety

The backend now validates runtime configuration at startup and will refuse to boot in production if:

- required env vars are missing
- `JWT_SECRET` is weak or using the development fallback
- `REDIS_URL` is missing for distributed request throttling
- SMTP configuration is incomplete
- production auto-seeding is enabled without an explicit override

## Transactional Email Coverage

Production mail templates now exist for:

- member welcome after direct registration
- member welcome after first social sign-in account creation
- creator account ready after invitation password setup
- instructor application received
- instructor application admin notification
- instructor approval with invite setup
- instructor approval for an existing user account
- instructor rejection
- studio application received
- studio application admin notification
- studio approval
- studio rejection
- subscription request received
- subscription request admin notification
- consultation booking received
- consultation booking admin notification
- consultation booking confirmed
- consultation booking rejected
- consultation booking cancelled
- payment submitted
- payment submitted admin notification
- payment approved
- payment rejected
- contact form acknowledgement
- contact form admin notification

## Abuse Protection

The backend now includes app-level request throttling for:

- registration
- login
- social sign-in start and completion
- instructor invite acceptance
- public contact submissions
- public instructor applications
- public studio applications

Production deployments should point `REDIS_URL` at a shared Redis instance so throttling remains consistent across multiple app replicas.

## Limited Reviewer Account

The backend now ensures a dedicated application reviewer account exists on every boot, including in production. This account is limited to creator and studio application review flows only.

Recommended settings:

- `EBAA_REVIEWER_NAME=Ebaa`
- `EBAA_REVIEWER_EMAIL=ebaa@aiqda.com`
- `EBAA_REVIEWER_PASSWORD=<strong unique password>`

In production, `EBAA_REVIEWER_PASSWORD` is required or the app will refuse to start.

## Session Cookies

Authentication is now stored in an `HttpOnly` server-set cookie instead of browser storage.

Recommended production settings:

- `AUTH_COOKIE_SAME_SITE=lax`
- `AUTH_COOKIE_SECURE=true`
- `TRUST_PROXY=1` when running behind a reverse proxy or load balancer

If your frontend and backend live on different subdomains of the same parent domain, keep `AUTH_COOKIE_SAME_SITE=lax` and set `AUTH_COOKIE_DOMAIN` only if you need to widen cookie scope intentionally.

## Recommended Infra Checks

These are still deployment responsibilities outside the app:

- reverse-proxy HTTPS termination
- managed MongoDB backups
- process manager or container restart policy
- infrastructure-level rate limiting and WAF rules
- centralized application logs and error alerts
