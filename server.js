const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const express = require("express");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const { rateLimit } = require("express-rate-limit");

const app = express();
const PORT = Number(process.env.PORT || 10000);
const IS_PRODUCTION = process.env.NODE_ENV === "production";

app.disable("x-powered-by");
app.set("trust proxy", 1);

if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    console.error("Set ADMIN_USERNAME and ADMIN_PASSWORD in the Render Environment tab.");
    process.exit(1);
}
if (process.env.ADMIN_PASSWORD.length < 12) {
    console.error("ADMIN_PASSWORD must be at least 12 characters long.");
    process.exit(1);
}

/* Session signing secret is created automatically. It changes on restart. */
const SESSION_SECRET = crypto.randomBytes(48);
let ADMIN_PASSWORD_HASH;

/* Use a Render persistent disk automatically when one is mounted at /var/data.
   Without a disk, local storage is temporary on Render Free instances. */
const DISK_PATH = "/var/data";
const DATA_DIRECTORY = fs.existsSync(DISK_PATH) ? DISK_PATH : path.join(__dirname, "data");
const MESSAGES_FILE = path.join(DATA_DIRECTORY, "messages.json");
let messages = [];
let saveQueue = Promise.resolve();

/* Five-minute cooldown by client IP. This is enforced on the server. */
const MESSAGE_COOLDOWN_MS = 5 * 60 * 1000;
const ipCooldowns = new Map();
const MAX_MESSAGES = 500;

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            frameAncestors: ["'none'"]
        }
    }
}));
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));

function getClientIp(req) {
    return req.ip || req.socket.remoteAddress || "unknown";
}

function getRemainingCooldown(ip) {
    const allowedAt = ipCooldowns.get(ip) || 0;
    return Math.max(0, Math.ceil((allowedAt - Date.now()) / 1000));
}

function cleanField(value, fieldName, maxLength) {
    if (typeof value !== "string") throw new Error(fieldName + " is required.");
    const result = value.trim();
    if (!result || result.length > maxLength) {
        throw new Error(fieldName + " is required and must be under " + maxLength + " characters.");
    }
    return result;
}

async function loadMessages() {
    await fs.promises.mkdir(DATA_DIRECTORY, { recursive: true });
    try {
        const raw = await fs.promises.readFile(MESSAGES_FILE, "utf8");
        const parsed = JSON.parse(raw);
        messages = Array.isArray(parsed) ? parsed.slice(0, MAX_MESSAGES) : [];
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error("Could not read message file:", error.message);
        }
        messages = [];
        await saveMessages();
    }
}

function saveMessages() {
    const snapshot = JSON.stringify(messages, null, 2);
    saveQueue = saveQueue.then(async () => {
        await fs.promises.mkdir(DATA_DIRECTORY, { recursive: true });
        const temporaryFile = MESSAGES_FILE + ".tmp";
        await fs.promises.writeFile(temporaryFile, snapshot, "utf8");
        await fs.promises.rename(temporaryFile, MESSAGES_FILE);
    });
    return saveQueue;
}

function signSession(username) {
    const payload = Buffer.from(JSON.stringify({
        username,
        expiresAt: Date.now() + 6 * 60 * 60 * 1000
    })).toString("base64url");

    const signature = crypto
        .createHmac("sha256", SESSION_SECRET)
        .update(payload)
        .digest("base64url");

    return payload + "." + signature;
}

function verifySession(token) {
    if (typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const expected = crypto.createHmac("sha256", SESSION_SECRET)
        .update(parts[0])
        .digest();

    let actual;
    try {
        actual = Buffer.from(parts[1], "base64url");
    } catch {
        return null;
    }
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
        return null;
    }

    try {
        const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
        if (payload.username !== process.env.ADMIN_USERNAME || payload.expiresAt < Date.now()) {
            return null;
        }
        return payload;
    } catch {
        return null;
    }
}

function readCookie(req, cookieName) {
    const cookies = (req.headers.cookie || "").split(";");
    for (const item of cookies) {
        const index = item.indexOf("=");
        if (index < 0) continue;
        const name = item.slice(0, index).trim();
        if (name === cookieName) {
            try {
                return decodeURIComponent(item.slice(index + 1).trim());
            } catch {
                return null;
            }
        }
    }
    return null;
}

const COOKIE_NAME = "ujjwal_admin";

function setAdminCookie(res, token) {
    const flags = [
        COOKIE_NAME + "=" + encodeURIComponent(token),
        "Path=/",
        "HttpOnly",
        "SameSite=Strict",
        "Max-Age=21600"
    ];
    if (IS_PRODUCTION) flags.push("Secure");
    res.setHeader("Set-Cookie", flags.join("; "));
}

function clearAdminCookie(res) {
    const flags = [
        COOKIE_NAME + "=",
        "Path=/",
        "HttpOnly",
        "SameSite=Strict",
        "Max-Age=0"
    ];
    if (IS_PRODUCTION) flags.push("Secure");
    res.setHeader("Set-Cookie", flags.join("; "));
}

function requireAdmin(req, res, next) {
    const session = verifySession(readCookie(req, COOKIE_NAME));
    if (!session) return res.status(401).json({ error: "Please sign in to open the admin inbox." });
    req.admin = session;
    next();
}

function sameOrigin(req, res, next) {
    const origin = req.get("origin");
    if (origin) {
        const expected = req.protocol + "://" + req.get("host");
        if (origin !== expected) return res.status(403).json({ error: "Request origin was not accepted." });
    }
    next();
}

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 8,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many login attempts. Wait 15 minutes and try again." }
});

/* Explicit routes keep server-side files and configuration private. */
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/index.html", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/style.css", (req, res) => res.sendFile(path.join(__dirname, "style.css")));
app.get("/script.js", (req, res) => res.sendFile(path.join(__dirname, "script.js")));
app.get("/favicon.svg", (req, res) => res.sendFile(path.join(__dirname, "favicon.svg")));
app.use("/images", express.static(path.join(__dirname, "images"), { maxAge: IS_PRODUCTION ? "1h" : 0 }));

app.get("/admin", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.sendFile(path.join(__dirname, "admin", "index.html"));
});
app.get("/admin/admin.css", (req, res) => res.sendFile(path.join(__dirname, "admin", "admin.css")));
app.get("/admin/admin.js", (req, res) => res.sendFile(path.join(__dirname, "admin", "admin.js")));

/* Contact rate-limit status, used to display the five-minute timer. */
app.get("/api/contact/cooldown", (req, res) => {
    const remainingSeconds = getRemainingCooldown(getClientIp(req));
    res.set("Cache-Control", "no-store");
    res.json({ allowed: remainingSeconds === 0, remainingSeconds });
});

/* Save public contact submissions and enforce one accepted message per IP per five minutes. */
app.post("/api/contact", sameOrigin, async (req, res, next) => {
    const ip = getClientIp(req);
    const remainingSeconds = getRemainingCooldown(ip);

    if (remainingSeconds > 0) {
        res.set("Retry-After", String(remainingSeconds));
        return res.status(429).json({
            error: "Please wait before sending another message.",
            remainingSeconds
        });
    }

    try {
        const name = cleanField(req.body.name, "Name", 120);
        const email = cleanField(req.body.email, "Email", 254);
        const subject = cleanField(req.body.subject, "Subject", 200);
        const message = cleanField(req.body.message, "Message", 3000);

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: "Please enter a valid email address." });
        }

        const entry = {
            id: crypto.randomUUID(),
            name,
            email,
            subject,
            message,
            createdAt: new Date().toISOString()
        };

        messages.unshift(entry);
        if (messages.length > MAX_MESSAGES) messages = messages.slice(0, MAX_MESSAGES);

        await saveMessages();
        ipCooldowns.set(ip, Date.now() + MESSAGE_COOLDOWN_MS);

        return res.status(201).json({
            ok: true,
            cooldownSeconds: MESSAGE_COOLDOWN_MS / 1000,
            message: "Your message has been received."
        });
    } catch (error) {
        if (error.message && /required|under|valid/i.test(error.message)) {
            return res.status(400).json({ error: error.message });
        }
        next(error);
    }
});

/* Admin login */
app.post("/api/admin/login", loginLimiter, sameOrigin, async (req, res, next) => {
    try {
        const username = typeof req.body.username === "string" ? req.body.username : "";
        const password = typeof req.body.password === "string" ? req.body.password : "";

        const usernameMatches = username === process.env.ADMIN_USERNAME;
        const passwordMatches = password.length > 0 && await bcrypt.compare(password, ADMIN_PASSWORD_HASH);

        if (!usernameMatches || !passwordMatches) {
            return res.status(401).json({ error: "Incorrect username or password." });
        }

        setAdminCookie(res, signSession(process.env.ADMIN_USERNAME));
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

app.get("/api/admin/me", (req, res) => {
    const session = verifySession(readCookie(req, COOKIE_NAME));
    res.set("Cache-Control", "no-store");
    res.json({ authenticated: Boolean(session), username: session ? session.username : null });
});

app.post("/api/admin/logout", sameOrigin, requireAdmin, (req, res) => {
    clearAdminCookie(res);
    res.json({ ok: true });
});

/* Read-only private inbox */
app.get("/api/admin/messages", requireAdmin, (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ messages });
});

app.get("/health", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, service: "ujjwal-portfolio", time: new Date().toISOString() });
});

app.use((req, res) => res.status(404).send("Page not found."));

app.use((error, req, res, next) => {
    console.error("Request error:", error);
    if (res.headersSent) return next(error);
    res.status(500).json({ error: "Something went wrong. Please try again later." });
});

async function start() {
    await loadMessages();
    ADMIN_PASSWORD_HASH = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);

    app.listen(PORT, "0.0.0.0", () => {
        console.log("Portfolio service listening on port " + PORT);
        console.log("Admin inbox: /admin");
        console.log("Message storage: " + MESSAGES_FILE);
    });

    /* Render supplies RENDER_EXTERNAL_URL automatically. This 10-minute
       heartbeat is a best-effort keep-awake workaround on Free instances.
       Render still controls Free-instance lifecycle; an always-on paid plan
       is the reliable option. */
    if (process.env.RENDER_EXTERNAL_URL) {
        const healthUrl = new URL("/health", process.env.RENDER_EXTERNAL_URL);
        const pingTimer = setInterval(async () => {
            try {
                const response = await fetch(healthUrl, { signal: AbortSignal.timeout(10000) });
                console.log("10-minute self-ping:", response.status);
            } catch (error) {
                console.warn("Self-ping failed:", error.message);
            }
        }, 10 * 60 * 1000);
        if (typeof pingTimer.unref === "function") pingTimer.unref();
        console.log("10-minute self-ping enabled for this Render URL.");
    }
}

start().catch((error) => {
    console.error("Server startup failed:", error);
    process.exit(1);
});
