const $ = (selector) => document.querySelector(selector);
const loginPanel = $("#login-panel");
const dashboard = $("#dashboard");
const loginForm = $("#login-form");
const loginMessage = $("#login-message");
const contentForm = $("#content-form");
const contentMessage = $("#content-message");
const saveState = $("#save-state");
const messagesList = $("#messages-list");

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(options.body ? { "Content-Type": "application/json" } : {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function showDashboard(isLoggedIn) {
  loginPanel.classList.toggle("hidden", isLoggedIn);
  dashboard.classList.toggle("hidden", !isLoggedIn);
}

async function checkSession() {
  try {
    const data = await api("/api/admin/me");
    showDashboard(data.authenticated);
    if (data.authenticated) {
      await loadContent();
      await loadMessages();
    }
  } catch {
    showDashboard(false);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector('button[type="submit"]');
  button.disabled = true;
  loginMessage.textContent = "Signing in...";
  try {
    const payload = {
      username: $("#username").value.trim(),
      password: $("#password").value
    };
    await api("/api/admin/login", { method: "POST", body: JSON.stringify(payload) });
    loginForm.reset();
    loginMessage.textContent = "";
    showDashboard(true);
    await loadContent();
    await loadMessages();
  } catch (error) {
    loginMessage.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$("#logout-button").addEventListener("click", async () => {
  try {
    await api("/api/admin/logout", { method: "POST" });
  } finally {
    showDashboard(false);
  }
});

async function loadContent() {
  const data = await api("/api/admin/site-content");
  const content = data.content;
  $("#hero-name").value = content.heroName || "";
  $("#hero-description").value = content.heroDescription || "";
  $("#about-heading").value = content.aboutHeading || "";
  $("#about-text").value = content.aboutText || "";
  $("#contact-email").value = content.contactEmail || "";
  $("#projects-json").value = JSON.stringify(content.projects || [], null, 2);
  saveState.textContent = data.updatedAt ? "Last saved: " + new Date(data.updatedAt).toLocaleString() : "Loaded";
}

contentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = contentForm.querySelector('button[type="submit"]');
  button.disabled = true;
  contentMessage.textContent = "Saving changes...";
  saveState.textContent = "Saving...";
  try {
    let projects;
    try {
      projects = JSON.parse($("#projects-json").value);
    } catch {
      throw new Error("Projects JSON is invalid. Check its commas, quotes and brackets.");
    }

    const payload = {
      heroName: $("#hero-name").value,
      heroDescription: $("#hero-description").value,
      aboutHeading: $("#about-heading").value,
      aboutText: $("#about-text").value,
      contactEmail: $("#contact-email").value,
      projects
    };

    const result = await api("/api/admin/site-content", {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    contentMessage.textContent = "Saved! Your public portfolio has been updated.";
    saveState.textContent = "Saved: " + new Date(result.updatedAt).toLocaleString();
  } catch (error) {
    contentMessage.textContent = error.message;
    saveState.textContent = "Not saved";
  } finally {
    button.disabled = false;
  }
});

async function loadMessages() {
  messagesList.replaceChildren();
  const loading = document.createElement("p");
  loading.className = "muted";
  loading.textContent = "Loading messages...";
  messagesList.appendChild(loading);

  try {
    const data = await api("/api/admin/messages");
    messagesList.replaceChildren();

    if (!data.messages.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Your inbox is empty. New contact form submissions will appear here.";
      messagesList.appendChild(empty);
      return;
    }

    data.messages.forEach((message) => {
      const card = document.createElement("article");
      card.className = "message-card";
      const head = document.createElement("div");
      head.className = "message-head";
      const titleWrap = document.createElement("div");

      const title = document.createElement("h3");
      title.textContent = message.subject;
      const meta = document.createElement("p");
      meta.className = "message-meta";
      meta.textContent = message.name + " · " + message.email;
      const date = document.createElement("p");
      date.className = "message-date";
      date.textContent = new Date(message.createdAt).toLocaleString();
      titleWrap.append(title, meta, date);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "delete-button";
      remove.textContent = "Delete";
      remove.addEventListener("click", async () => {
        if (!window.confirm("Delete this message permanently?")) return;
        try {
          await api("/api/admin/messages/" + encodeURIComponent(message.id), { method: "DELETE" });
          await loadMessages();
        } catch (error) {
          window.alert(error.message);
        }
      });

      head.append(titleWrap, remove);
      const body = document.createElement("p");
      body.className = "message-body";
      body.textContent = message.message;
      card.append(head, body);
      messagesList.appendChild(card);
    });
  } catch (error) {
    messagesList.replaceChildren();
    const failed = document.createElement("p");
    failed.className = "notice";
    failed.textContent = error.message;
    messagesList.appendChild(failed);
  }
}

$("#refresh-messages").addEventListener("click", loadMessages);
checkSession();
