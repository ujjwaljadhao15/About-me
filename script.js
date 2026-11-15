/* UJJWAL'S PORTFOLIO FRONTEND */

const $ = (selector) => document.querySelector(selector);

/* 1. CONTACT FORM + SERVER-ENFORCED FIVE-MINUTE IP TIMER */

const contactForm = $("#contact-form");
const formMessage = $("#form-message");
const cooldownTimer = $("#cooldown-timer");

let cooldownInterval = null;

function displayCooldown(seconds) {
    const submitButton = contactForm?.querySelector('button[type="submit"]');
    let remaining = Math.max(0, Number(seconds) || 0);

    if (!submitButton || !cooldownTimer) return;

    if (cooldownInterval) clearInterval(cooldownInterval);

    function updateTimer() {
        if (remaining <= 0) {
            clearInterval(cooldownInterval);
            cooldownInterval = null;
            submitButton.disabled = false;
            cooldownTimer.textContent = "";
            return;
        }

        submitButton.disabled = true;
        const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
        const secs = String(remaining % 60).padStart(2, "0");
        cooldownTimer.textContent = "You can send your next message in " + minutes + ":" + secs;
        remaining -= 1;
    }

    updateTimer();
    cooldownInterval = setInterval(updateTimer, 1000);
}

async function checkContactCooldown() {
    if (!contactForm || !cooldownTimer) return;

    try {
        const response = await fetch("/api/contact/cooldown", { cache: "no-store" });
        if (!response.ok) return;

        const data = await response.json();
        if (!data.allowed && data.remainingSeconds > 0) {
            if (formMessage) formMessage.textContent = "A message was recently sent from this network.";
            displayCooldown(data.remainingSeconds);
        }
    } catch (error) {
        console.warn("Could not check contact message timer:", error);
    }
}

if (contactForm && formMessage) {
    contactForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const submitButton = contactForm.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;

        submitButton.disabled = true;
        submitButton.textContent = "Sending...";
        formMessage.textContent = "Sending your message...";
        if (cooldownTimer) cooldownTimer.textContent = "";

        try {
            const values = Object.fromEntries(new FormData(contactForm).entries());

            const response = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values)
            });

            const result = await response.json();

            if (response.status === 429) {
                formMessage.textContent = result.error || "Please wait before sending another message.";
                displayCooldown(result.remainingSeconds || 300);
                return;
            }

            if (!response.ok) {
                throw new Error(result.error || "Your message could not be sent.");
            }

            contactForm.reset();
            submitButton.textContent = originalText;
            formMessage.textContent = "Your message has been received. Thank you for contacting me! 😊";
            displayCooldown(result.cooldownSeconds || 300);
        } catch (error) {
            console.error("Contact form error:", error);
            formMessage.textContent = error.message || "Something went wrong. Please try again.";
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    });

    checkContactCooldown();
}

/* 2. MOBILE HAMBURGER MENU */

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

/* 3. TYPING TEXT ANIMATION */

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

/* 4. BACK TO TOP */

const backToTop = $("#back-to-top");

if (backToTop) {
    window.addEventListener("scroll", () => {
        backToTop.classList.toggle("show", window.scrollY > 300);
    });

    backToTop.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}

/* 5. SCROLL REVEAL */

const revealElements = document.querySelectorAll(
    ".section-title, .about-text, .info-card, .skill-card, .project-card, .contact-info, .contact-form"
);

if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    revealElements.forEach((element) => {
        element.classList.add("reveal");
        revealObserver.observe(element);
    });
} else {
    revealElements.forEach((element) => element.classList.add("visible"));
}

/* 6. COPYRIGHT YEAR */

const yearElement = $("#current-year");
if (yearElement) yearElement.textContent = new Date().getFullYear();

console.log("Ujjwal's portfolio frontend ready.");
