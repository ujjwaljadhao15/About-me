const path = require("node:path");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit").rateLimit;
const session = require("express-session");
const connectPgSimple = require("connect-pg-simple");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = Number(process.env.PORT || 10000);
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const ROOT = __dirname;

app.disable("x-powered-by");
app.set("trust proxy", 1);

const requiredEnv = ["DATABASE_URL", "ADMIN_USERNAME", "ADMIN_PASSWORD", "SESSION_SECRET"];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length) {
    console.error("Missing required environment variables:", missingEnv.join(", "));
    process.exit(1);
}

if (process.env.ADMIN_PASSWORD.length < 12) {
    console.error("ADMIN_PASSWORD must be at least 12 characters long.");
    process.exit(1);
}

if (process.env.SESSION_SECRET.length < 32) {
    console.error("SESSION_SECRET must be at least 32 characters long.");
    process.exit(1);
}

let adminPasswordHash = null;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30000
});

pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL pool error:", error);
});

const PgStore = connectPgSimple(session);

const DEFAULT_CONTENT = {
    heroName: "Ujjwal",
    heroDescription: "I am an AIML engineering student passionate about technology, programming and building creative projects.",
    aboutHeading: "I'm Ujjwal Jadhao",
    aboutText: "I am an Artificial Intelligence and Machine Learning engineering student at TGPCET, Nagpur. I love technology, programming, creativity and exploring new ideas. Currently, I am learning web development and Python while improving my coding skills.",
    contactEmail: "ujjwaljadhao15@gmail.com",
    projects: [
        {
            title: "Personal Portfolio",
            description: "My personal website built to showcase my skills, education and development journey.",
            icon: "🌐",
            status: "In Progress",
            technologies: ["HTML", "CSS", "JavaScript"]
        },
        {
            title: "Rock Paper Scissors",
            description: "A beginner-friendly game where players compete against the computer using Python.",
            icon: "🎮",
            status: "Planned",
            technologies: ["Python", "Game Logic"]
        },
        {
            title: "Tic-Tac-Toe",
            description: "A classic two-player game designed to practice programming logic.",
            icon: "⭕",
            status: "Planned",
            technologies: ["Python", "Logic Building"]
        }
    ]
};

function cleanText(value, maxLength, fieldName) {
    if (typeof value !== "string") throw new Error(fieldName + " must be text.");
    const result = value.trim();
    if (!result || result.length > maxLength) {
        throw new Error(fieldName + " is required and must be under " + maxLength + " characters.");
    }
    return result;
}

function normalizeContent(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error("Invalid content format.");
    }

    const heroName = cleanText(input.heroName, 60, "Hero name");
    const heroDescription = cleanText(input.heroDescription, 500, "Hero description");
    const aboutHeading = cleanText(input.aboutHeading, 100, "About heading");
    const aboutText = cleanText(input.aboutText, 2000, "About text");
    const contactEmail = cleanText(input.contactEmail, 254, "Contact email");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        throw new Error("Enter a valid contact email address.");
    }

    if (!Array.isArray(input.projects) || input.projects.length > 12) {
        throw new Error("Projects must be an array with no more than 12 items.");
    }

    const projects = input.projects.map((project) => {
        if (!project || typeof project !== "object" || Array.isArray(project)) {
            throw new Error("Each project must be an object.");
        }

        const technologies = Array.isArray(project.technologies) ? project.technologies : [];
        if (technologies.length > 8) {
            throw new Error("Each project can have at most 8 technology tags.");
        }

        return {
            title: cleanText(project.title, 80, "Project title"),
            description: cleanText(project.description, 500, "Project description"),
            icon: typeof project.icon === "string" ? project.icon.slice(0, 12) : "💻",
            status: typeof project.status === "string" ? project.status.slice(0, 30) : "Planned",
            technologies: technologies.map((item) => cleanText(String(item), 30, "Technology"))
        };
    });

    return { heroName, heroDescription, aboutHeading, aboutText, contactEmail, projects };
}

async function initializeDatabase() {
    await pool.query(
        "CREATE TABLE IF NOT EXISTS site_content (id SMALLINT PRIMARY KEY CHECK (id = 1), content JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"
    );

    await pool.query(
        "CREATE TABLE IF NOT EXISTS contact_messages (id BIGSERIAL PRIMARY KEY, name VARCHAR(120) NOT NULL, email VARCHAR(254) NOT NULL, subject VARCHAR(200) NOT NULL, message TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"
    );

    await pool.query(
        "INSERT INTO site_content (id, content) VALUES (1, $1::jsonb) ON CONFLICT (id) DO NOTHING",
        [JSON.stringify(DEFAULT_CONTENT)]
    );
}

app.use(helmet());
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false, limit: "16kb" }));

app.use(session({
    store: new PgStore({
        pool: pool,
        tableName: "admin_sessions",
        createTableIfMissing: true,
        pruneSessionInterval: 15 * 60
    }),
    name: "ujjwal_admin_session",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        httpOnly: true,
        secure: IS_PRODUCTION,
        sameSite: "strict",
        maxAge: 4 * 60 * 60 * 1000
    }
}));

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 8,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many login attempts. Wait 15 minutes and try again." }
});

const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many messages. Please wait before trying again." }
});

function sameOrigin(req, res, next) {
    const origin = req.get("origin");
    if (origin) {
        const expected = req.protocol + "://" + req.get("host");
        if (origin !== expected) {
            return res.status(403).json({ error: "Request origin was not accepted." });
        }
    }
    next();
}

function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin === true) return next();
    return res.status(401).json({ error: "Please log in to access the admin area." });
}

/* Public website files. Do not expose the project root with express.static. */
app.get("/", (req, res) => res.sendFile(path.join(ROOT, "index.html")));
app.get("/index.html", (req, res) => res.sendFile(path.join(ROOT, "index.html")));
app.get("/style.css", (req, res) => res.sendFile(path.join(ROOT, "style.css")));
app.get("/script.js", (req, res) => res.sendFile(path.join(ROOT, "script.js")));
app.get("/favicon.svg", (req, res) => res.sendFile(path.join(ROOT, "favicon.svg")));
app.use("/images", express.static(path.join(ROOT, "images"), { maxAge: IS_PRODUCTION ? "1h" : 0 }));

/* Admin interface assets contain no credentials and API routes remain protected. */
app.get("/admin", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.sendFile(path.join(ROOT, "admin", "index.html"));
});
app.get("/admin/admin.css", (req, res) => res.sendFile(path.join(ROOT, "admin", "admin.css")));
app.get("/admin/admin.js", (req, res) => res.sendFile(path.join(ROOT, "admin", "admin.js")));

/* Public content API. Never return private inbox or login data here. */
app.get("/api/site-content", async (req, res, next) => {
    try {
        const result = await pool.query("SELECT content FROM site_content WHERE id = 1");
        res.json(result.rows[0] ? result.rows[0].content : DEFAULT_CONTENT);
    } catch (error) {
        next(error);
    }
});

/* Public contact form saves messages to the private admin inbox. */
app.post("/api/contact", contactLimiter, sameOrigin, async (req, res, next) => {
    try {
        const name = cleanText(req.body.name, 120, "Name");
        const email = cleanText(req.body.email, 254, "Email");
        const subject = cleanText(req.body.subject, 200, "Subject");
        const message = cleanText(req.body.message, 3000, "Message");

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: "Please enter a valid email address." });
        }

        await pool.query(
            "INSERT INTO contact_messages (name, email, subject, message) VALUES ($1, $2, $3, $4)",
            [name, email, subject, message]
        );

        res.status(201).json({ ok: true });
    } catch (error) {
        if (error.message && /required|under|valid/i.test(error.message)) {
            return res.status(400).json({ error: error.message });
        }
        next(error);
    }
});

/* Admin login. Raw password is kept only in Render Environment and hashed in memory. */
app.post("/api/admin/login", loginLimiter, sameOrigin, async (req, res, next) => {
    try {
        const username = typeof req.body.username === "string" ? req.body.username : "";
        const password = typeof req.body.password === "string" ? req.body.password : "";

        const usernameMatches = username === process.env.ADMIN_USERNAME;
        const passwordMatches = password.length > 0 &&
            await bcrypt.compare(password, adminPasswordHash);

        if (!usernameMatches || !passwordMatches) {
            return res.status(401).json({ error: "Invalid username or password." });
        }

        req.session.regenerate((error) => {
            if (error) return next(error);
            req.session.isAdmin = true;
            req.session.adminUsername = process.env.ADMIN_USERNAME;
            req.session.save((saveError) => {
                if (saveError) return next(saveError);
                res.json({ ok: true });
            });
        });
    } catch (error) {
        next(error);
    }
});

app.get("/api/admin/me", (req, res) => {
    res.json({
        authenticated: Boolean(req.session && req.session.isAdmin === true),
        username: req.session && req.session.isAdmin ? req.session.adminUsername : null
    });
});

app.post("/api/admin/logout", sameOrigin, requireAdmin, (req, res, next) => {
    req.session.destroy((error) => {
        if (error) return next(error);
        res.clearCookie("ujjwal_admin_session", {
            httpOnly: true,
            secure: IS_PRODUCTION,
            sameSite: "strict"
        });
        res.json({ ok: true });
    });
});

/* Protected portfolio editor API. */
app.get("/api/admin/site-content", requireAdmin, async (req, res, next) => {
    try {
        const result = await pool.query("SELECT content, updated_at FROM site_content WHERE id = 1");
        res.json({
            content: result.rows[0] ? result.rows[0].content : DEFAULT_CONTENT,
            updatedAt: result.rows[0] ? result.rows[0].updated_at : null
        });
    } catch (error) {
        next(error);
    }
});

app.put("/api/admin/site-content", sameOrigin, requireAdmin, async (req, res, next) => {
    try {
        const content = normalizeContent(req.body);
        const result = await pool.query(
            "UPDATE site_content SET content = $1::jsonb, updated_at = NOW() WHERE id = 1 RETURNING updated_at",
            [JSON.stringify(content)]
        );
        res.json({ ok: true, content: content, updatedAt: result.rows[0].updated_at });
    } catch (error) {
        if (error.message && /required|under|valid|array|items|technology|project/i.test(error.message)) {
            return res.status(400).json({ error: error.message });
        }
        next(error);
    }
});

/* Private inbox APIs. */
app.get("/api/admin/messages", requireAdmin, async (req, res, next) => {
    try {
        const result = await pool.query(
            'SELECT id, name, email, subject, message, created_at AS "createdAt" FROM contact_messages ORDER BY created_at DESC LIMIT 100'
        );
        res.json({ messages: result.rows });
    } catch (error) {
        next(error);
    }
});

app.delete("/api/admin/messages/:id", sameOrigin, requireAdmin, async (req, res, next) => {
    try {
        if (!/^\d+$/.test(req.params.id)) {
            return res.status(400).json({ error: "Invalid message ID." });
        }
        await pool.query("DELETE FROM contact_messages WHERE id = $1", [req.params.id]);
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.use((req, res) => res.status(404).send("Page not found."));

app.use((error, req, res, next) => {
    console.error("Request error:", error);
    if (res.headersSent) return next(error);
    const status = Number.isInteger(error.status) ? error.status : 500;
    res.status(status).json({
        error: status === 500 ? "Something went wrong. Please try again later." : error.message
    });
});

async function start() {
    await initializeDatabase();

    /* Compare logins against a bcrypt hash, never store password in a DB or file. */
    adminPasswordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);

    app.listen(PORT, "0.0.0.0", () => {
        console.log("Portfolio Node.js service listening on port " + PORT);
        console.log("Admin page: /admin");
    });
}

start().catch((error) => {
    console.error("Could not start the portfolio service:", error);
    process.exit(1);
});
