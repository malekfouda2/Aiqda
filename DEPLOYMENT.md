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
- `VIMEO_ACCESS_TOKEN`
- `JWT_EXPIRES_IN`
- `AUTH_REGISTER_RATE_LIMIT_MAX`
- `AUTH_LOGIN_RATE_LIMIT_MAX`
- `INVITE_ACCEPT_RATE_LIMIT_MAX`
- `CONTACT_SUBMISSION_RATE_LIMIT_MAX`
- `INSTRUCTOR_APPLICATION_RATE_LIMIT_MAX`
- `STUDIO_APPLICATION_RATE_LIMIT_MAX`

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
- SMTP configuration is incomplete
- production auto-seeding is enabled without an explicit override

## Transactional Email Coverage

Production mail templates now exist for:

- instructor application received
- instructor approval with invite setup
- instructor approval for an existing user account
- instructor rejection
- studio application received
- studio approval
- studio rejection
- consultation booking received
- consultation booking confirmed
- consultation booking rejected
- consultation booking cancelled
- payment submitted
- payment approved
- payment rejected
- contact form acknowledgement
- contact form admin notification

## Abuse Protection

The backend now includes app-level request throttling for:

- registration
- login
- instructor invite acceptance
- public contact submissions
- public instructor applications
- public studio applications

## Recommended Infra Checks

These are still deployment responsibilities outside the app:

- reverse-proxy HTTPS termination
- managed MongoDB backups
- process manager or container restart policy
- infrastructure-level rate limiting and WAF rules
- centralized application logs and error alerts
