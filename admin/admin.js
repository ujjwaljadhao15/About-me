const $ = (selector) => document.querySelector(selector);
const loginPanel = $("#login-panel");
const inboxPanel = $("#inbox-panel");
const loginForm = $("#login-form");
const loginMessage = $("#login-message");
const messagesList = $("#messages-list");
const inboxStatus = $("#inbox-status");
const messageCount = $("#message-count");

async function api(url, options = {}) {
    const response = await fetch(url, {
        credentials: "same-origin",
        ...options,
        headers: { ...(options.headers || {}), ...(options.body ? { "Content-Type": "application/json" } : {}) }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Request failed.");
    return result;
}

function showInbox(isLoggedIn) {
    loginPanel.classList.toggle("hidden", isLoggedIn);
    inboxPanel.classList.toggle("hidden", !isLoggedIn);
}

async function checkLogin() {
    try {
        const result = await api("/api/admin/me");
        showInbox(result.authenticated);
        if (result.authenticated) await loadMessages();
    } catch {
        showInbox(false);
    }
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = loginForm.querySelector('button[type="submit"]');
    button.disabled = true;
    loginMessage.textContent = "Checking login...";
    try {
        await api("/api/admin/login", {
            method: "POST",
            body: JSON.stringify({ username: $("#username").value.trim(), password: $("#password").value })
        });
        loginForm.reset();
        loginMessage.textContent = "";
        showInbox(true);
        await loadMessages();
    } catch (error) {
        loginMessage.textContent = error.message;
    } finally {
        button.disabled = false;
    }
});

async function loadMessages() {
    messagesList.replaceChildren();
    inboxStatus.textContent = "Loading messages...";
    try {
        const result = await api("/api/admin/messages");
        const items = Array.isArray(result.messages) ? result.messages : [];
        messageCount.textContent = items.length + (items.length === 1 ? " message" : " messages");
        inboxStatus.textContent = "";
        if (!items.length) {
            const empty = document.createElement("div");
            empty.className = "empty-state";
            empty.textContent = "Your inbox is empty. New portfolio messages will appear here.";
            messagesList.appendChild(empty);
            return;
        }
        items.forEach((item) => {
            const card = document.createElement("article");
            card.className = "message-card";
            const top = document.createElement("div");
            top.className = "message-top";
            const heading = document.createElement("div");
            const subject = document.createElement("h2");
            subject.textContent = item.subject || "(No subject)";
            const sender = document.createElement("p");
            sender.className = "message-sender";
            sender.append(document.createTextNode((item.name || "Unknown sender") + " · "));
            const email = document.createElement("a");
            email.href = "mailto:" + item.email;
            email.textContent = item.email;
            sender.appendChild(email);
            heading.append(subject, sender);
            const date = document.createElement("p");
            date.className = "message-date";
            date.textContent = item.createdAt ? new Date(item.createdAt).toLocaleString() : "";
            top.append(heading, date);
            const body = document.createElement("p");
            body.className = "message-body";
            body.textContent = item.message || "";
            card.append(top, body);
            messagesList.appendChild(card);
        });
    } catch (error) {
        inboxStatus.textContent = error.message;
    }
}

$("#refresh-button").addEventListener("click", loadMessages);
$("#logout-button").addEventListener("click", async () => {
    try { await api("/api/admin/logout", { method: "POST" }); }
    finally { showInbox(false); }
});
checkLogin();
