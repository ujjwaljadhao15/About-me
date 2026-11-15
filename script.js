/* UJJWAL'S PORTFOLIO — Node.js-powered frontend */

const $ = (selector) => document.querySelector(selector);

/* Load content saved in the admin dashboard. */
async function loadPortfolioContent() {
    try {
        const response = await fetch("/api/site-content");
        if (!response.ok) return;

        const content = await response.json();

        const heroName = $("#hero-name");
        const heroDescription = $("#hero-description");
        const aboutHeading = $("#about-heading");
        const aboutDescription = $("#about-description");
        const contactEmail = $("#contact-email");

        if (heroName && content.heroName) heroName.textContent = content.heroName;
        if (heroDescription && content.heroDescription) heroDescription.textContent = content.heroDescription;
        if (aboutHeading && content.aboutHeading) aboutHeading.textContent = content.aboutHeading;
        if (aboutDescription && content.aboutText) aboutDescription.textContent = content.aboutText;

        if (contactEmail && content.contactEmail) {
            contactEmail.textContent = content.contactEmail;
            contactEmail.href = "mailto:" + content.contactEmail;
        }

        if (Array.isArray(content.projects)) renderProjects(content.projects);
    } catch (error) {
        console.warn("Could not load saved portfolio content:", error);
    }
}

/* Render projects using textContent to avoid injecting admin HTML. */
function renderProjects(projects) {
    const grid = $("#project-grid");
    if (!grid || !Array.isArray(projects)) return;

    grid.replaceChildren();

    projects.forEach((project, index) => {
        const card = document.createElement("article");
        card.className = "project-card" + (index === 0 ? " featured" : "");

        const top = document.createElement("div");
        top.className = "project-top";

        const number = document.createElement("span");
        number.className = "project-number";
        number.textContent = String(index + 1).padStart(2, "0");

        const status = document.createElement("span");
        status.className = "project-status";
        const statusText = String(project.status || "Planned");
        status.classList.add(statusText.toLowerCase().includes("progress") ? "ongoing" : "planned");
        status.textContent = statusText;
        top.append(number, status);

        const icon = document.createElement("div");
        icon.className = "project-icon";
        icon.textContent = project.icon || "💻";

        const title = document.createElement("h3");
        title.textContent = project.title || "Untitled project";

        const description = document.createElement("p");
        description.textContent = project.description || "";

        const tech = document.createElement("div");
        tech.className = "project-tech";
        (Array.isArray(project.technologies) ? project.technologies : []).forEach((item) => {
            const tag = document.createElement("span");
            tag.textContent = String(item);
            tech.appendChild(tag);
        });

        card.append(top, icon, title, description, tech);
        grid.appendChild(card);
    });
}

/* Contact messages are saved on the Node server in the private admin inbox. */
const contactForm = $("#contact-form");
const formMessage = $("#form-message");

if (contactForm && formMessage) {
    contactForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const button = contactForm.querySelector('button[type="submit"]');
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = "Sending...";
        formMessage.textContent = "Please wait. Sending your message...";

        try {
            const values = Object.fromEntries(new FormData(contactForm).entries());
            const response = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values)
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Your message could not be sent.");

            formMessage.textContent = "Message received! Thank you for contacting me. 😊";
            contactForm.reset();
        } catch (error) {
            console.error("Contact form error:", error);
            formMessage.textContent = error.message || "Sorry, something went wrong. Please try again.";
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    });
}

/* Mobile navigation */
const menuToggle = $("#menu-toggle");
const navLinks = $("#nav-links");

if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
        navLinks.classList.toggle("show");
        const isOpen = navLinks.classList.contains("show");
        menuToggle.textContent = isOpen ? "✕" : "☰";
        menuToggle.setAttribute("aria-expanded", String(isOpen));
        menuToggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
    });

    navLinks.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
            navLinks.classList.remove("show");
            menuToggle.textContent = "☰";
            menuToggle.setAttribute("aria-expanded", "false");
            menuToggle.setAttribute("aria-label", "Open navigation menu");
        });
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 768) {
            navLinks.classList.remove("show");
            menuToggle.textContent = "☰";
            menuToggle.setAttribute("aria-expanded", "false");
        }
    });
}

/* Typing text animation */
const typingElement = $("#typing-text");

if (typingElement) {
    const words = ["AIML Student", "Future Developer", "Python Learner", "AI Enthusiast"];
    let wordIndex = 0;
    let charIndex = 0;
    let deleting = false;

    function typeEffect() {
        const word = words[wordIndex];

        if (!deleting) {
            charIndex++;
            typingElement.textContent = word.substring(0, charIndex);

            if (charIndex === word.length) {
                deleting = true;
                setTimeout(typeEffect, 1200);
                return;
            }
        } else {
            charIndex--;
            typingElement.textContent = word.substring(0, charIndex);

            if (charIndex === 0) {
                deleting = false;
                wordIndex = (wordIndex + 1) % words.length;
            }
        }

        setTimeout(typeEffect, deleting ? 55 : 100);
    }

    typeEffect();
}

/* Back-to-top button */
const backToTop = $("#back-to-top");

if (backToTop) {
    window.addEventListener("scroll", () => {
        backToTop.classList.toggle("show", window.scrollY > 300);
    });

    backToTop.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}

/* Scroll reveal animation */
const revealElements = document.querySelectorAll(
    ".section-title, .about-text, .info-card, .skill-card, .project-card, .contact-info, .contact-form"
);

if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries, currentObserver) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
                currentObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    revealElements.forEach((element) => {
        element.classList.add("reveal");
        observer.observe(element);
    });
} else {
    revealElements.forEach((element) => element.classList.add("visible"));
}

/* Dynamic copyright year */
const yearElement = $("#current-year");
if (yearElement) yearElement.textContent = new Date().getFullYear();

/* Load the editable portfolio content. */
loadPortfolioContent();
console.log("Ujjwal's Node.js portfolio frontend loaded.");
