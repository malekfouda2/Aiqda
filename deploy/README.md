# Production Nginx

`nginx/aiqda.conf` is the Aiqda production site configuration. It preserves the
existing frontend, API proxy, HTTPS certificates, and HTTP redirects.

The API accepts request bodies up to 30 MiB so a 25 MiB lesson attachment and its
multipart overhead reach Express. The backend still enforces the 25 MiB lesson
file limit, the 10 MiB creator-document limit, and the 5 MiB image limits.
Without this Nginx setting, its default 1 MiB limit rejects valid uploads before
the application receives them.

After pushing and pulling the approved Git commit on production:

```bash
cd /var/www/Aiqda
git pull --ff-only origin main
sudo bash deploy/apply-nginx.sh
```

The script backs up the installed site, validates the configuration, and reloads
Nginx gracefully. Failed validation or reload restores the previous site.
Frontend rebuilds and backend restarts are not required for a proxy-only change.
Keep future site configuration changes in this file before deploying them.

Verify a creator can attach and download files larger than 1 MiB, including one
at the 25 MiB boundary. Files over 25 MiB must still be rejected by the app.
Use temporary unpublished test records and remove their files afterward.
Previously rejected files must be attached again through the existing lesson's
Edit form; the server never received them.
