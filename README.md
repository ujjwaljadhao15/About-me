# Ujjwal Jadhao Portfolio — Node.js + Admin

This repository serves the existing portfolio through an Express web service and adds a protected admin dashboard.

## Features

- Existing portfolio homepage and styling
- Node.js / Express server
- Protected admin page at `/admin`
- Admin login credentials read from Render environment variables
- PostgreSQL-backed portfolio content editor
- PostgreSQL-backed contact inbox
- Rate-limited login and contact form
- HTTP-only, same-site admin session cookie

## Local setup

1. Install Node.js 22 or newer.
2. Run `npm install`.
3. Create a PostgreSQL database.
4. Copy `.env.example` to `.env` and fill in your local values.
5. Run `npm start`.
6. Open `http://localhost:10000` for the public website and `http://localhost:10000/admin` for the admin page.

## Render deployment

Create a Render PostgreSQL database and a Node.js Web Service connected to this repository. Set the build command to `npm install` and the start command to `npm start`.

In the Render Web Service Environment tab, set:

- `NODE_ENV` = `production`
- `DATABASE_URL` = the PostgreSQL database Internal Database URL
- `DATABASE_SSL` = `false` when using the Internal Database URL
- `ADMIN_USERNAME` = the admin username you choose
- `ADMIN_PASSWORD` = a unique password of at least 12 characters
- `SESSION_SECRET` = a random secret of at least 32 characters

The server hashes the password in memory at startup. The password, session secret and database URL do not belong in GitHub files. Never commit your real `.env` file.

Generate a session secret locally with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Render supplies the `PORT` variable. The app listens on it and binds to `0.0.0.0`.

## Admin dashboard

Visit `/admin`, then sign in using the `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment values. The dashboard edits the Home and About text, public contact email, and project cards. It also displays messages submitted through the public contact form.

## Contact form behavior

Contact submissions are stored in PostgreSQL and appear in the private Admin Inbox. This version does not send email notifications. SMTP notifications can be added later using server-side environment variables.

## Notes

- The old browser-side EmailJS form has been replaced by the Node.js contact endpoint.
- Passwords and session secrets must never be committed to GitHub.
- Render's web-service filesystem is not used for admin data; PostgreSQL persists edits and messages across redeploys.
