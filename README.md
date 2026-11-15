# Ujjwal Jadhao Portfolio + Private Message Inbox

A simple Node.js/Express web service. The existing portfolio remains the public homepage. The only admin feature is a private inbox for messages submitted through the “Send Me a Message” form.

## Features
- Public portfolio served by Node.js
- Private admin login at `/admin`
- Admin username and password configured in Render Environment
- Messages saved to a JSON file
- Server-enforced limit: one accepted message per client IP every 5 minutes
- Visible countdown timer on the contact form
- Best-effort self-ping every 10 minutes using Render's automatically provided `RENDER_EXTERNAL_URL`
- No PostgreSQL or external database

## Render deployment
Create a **Web Service** from this repository and the `main` branch.

- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Root directory: leave blank

In Render → your service → Environment, set only:
- `ADMIN_USERNAME` — your private admin username
- `ADMIN_PASSWORD` — a unique password with at least 12 characters

Render supplies `PORT` and `RENDER_EXTERNAL_URL` automatically. The app creates its own session-signing secret at startup.

## Admin inbox
Open `https://YOUR-SERVICE.onrender.com/admin` and sign in with the username and password above.

## Storage limitation — read this before using Free
Messages are stored in `data/messages.json`. The app automatically uses `/var/data/messages.json` if a persistent disk is mounted there.

Render Free web services have an ephemeral filesystem and cannot use persistent disks. Render can erase local files on spin-down, restart, or redeploy. Therefore messages may be lost on the Free plan. To keep messages reliably without PostgreSQL, use a paid Web Service and attach a persistent disk mounted at `/var/data`.

## 5-minute IP timer
The limit is checked by the Node server, not only by the browser. A successful message starts a 5-minute cooldown for the IP address that submitted it. The page displays a live countdown. The cooldown map is in memory and resets if the server restarts. Visitors behind the same public network may share an IP address and therefore share the timer.

## Render self-ping
When `RENDER_EXTERNAL_URL` exists, the app requests its own `/health` endpoint every 10 minutes. This is a best-effort workaround, not an official uptime guarantee. Render Free services are designed to spin down after 15 minutes without inbound traffic; a paid always-on instance is the reliable option. Self-ping does not make ephemeral files persistent.

## Local development
1. Install Node.js 22 or newer.
2. Run `npm install`.
3. Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in your local shell.
4. Run `npm start`.
5. Open `http://localhost:10000`.

## Email notifications

This inbox stores messages for you to read at `/admin`. It does not send a separate email notification to Gmail. You can add server-side email alerts later if you decide you need them.
