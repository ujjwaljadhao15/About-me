
/* ==========================================
   UJJWAL'S PERSONAL PORTFOLIO
   Complete JavaScript
   Lessons 6, 7 and 8
   ========================================== */



/* =====================================
   EMAILJS CONTACT FORM
   ===================================== */

// Your EmailJS configuration

const EMAILJS_SERVICE_ID = "service_8q1yczc";

const EMAILJS_TEMPLATE_ID = "portfolio_contact";

const EMAILJS_PUBLIC_KEY = "Q3-Dev1lXKXaFb7Fp";


// Connect the contact form

const contactForm = document.getElementById("contact-form");

const formMessage = document.getElementById("form-message");


if (contactForm && formMessage) {

    // Initialize EmailJS

    if (window.emailjs) {

        emailjs.init({
            publicKey: EMAILJS_PUBLIC_KEY
        });

    }


    // Handle form submission

    contactForm.addEventListener("submit", async function(event) {

        // Stop page refresh
        event.preventDefault();


        // Check EmailJS library

        if (!window.emailjs) {

            formMessage.textContent =
                "Email service is unavailable. Please refresh the page.";

            return;

        }


        // Get submit button

        const submitButton = contactForm.querySelector(
            'button[type="submit"]'
        );

        const originalButtonText = submitButton.textContent;


        // Show sending message

        submitButton.disabled = true;

        submitButton.textContent = "Sending...";

        formMessage.textContent =
            "Please wait. Sending your message...";


        try {

            // Send email through EmailJS

            const response = await emailjs.sendForm(
                EMAILJS_SERVICE_ID,
                EMAILJS_TEMPLATE_ID,
                contactForm
            );


            // Success response

            console.log("Email sent successfully:", response);

            formMessage.textContent =
                "Message sent successfully! Thank you for contacting me. 😊";


            // Clear form after successful sending

            contactForm.reset();

} catch (error) {

    // Display actual EmailJS error

    console.error("EMAILJS ERROR:", error);

    console.error("STATUS:", error?.status);

    console.error("ERROR MESSAGE:", error?.text || error?.message);

    formMessage.textContent =
        "Sending failed: " +
        (error?.text || error?.message || "Check Chrome Console.");



        } finally {

            // Restore button

            submitButton.disabled = false;

            submitButton.textContent = originalButtonText;

        }

    });

}


/* END OF EMAILJS CONTACT FORM */


/* 2. MOBILE HAMBURGER MENU */

const menuToggle = document.getElementById("menu-toggle");
const navLinks = document.getElementById("nav-links");

if (menuToggle && navLinks) {

    // Open and close navigation
    menuToggle.addEventListener("click", function() {

        navLinks.classList.toggle("show");

        const isOpen = navLinks.classList.contains("show");

        menuToggle.textContent = isOpen ? "✕" : "☰";

        menuToggle.setAttribute(
            "aria-expanded",
            String(isOpen)
        );

        menuToggle.setAttribute(
            "aria-label",
            isOpen ? "Close navigation menu" : "Open navigation menu"
        );

    });

    // Close menu when a link is clicked
    navLinks.querySelectorAll("a").forEach(function(link) {

        link.addEventListener("click", function() {

            navLinks.classList.remove("show");

            menuToggle.textContent = "☰";

            menuToggle.setAttribute("aria-expanded", "false");

            menuToggle.setAttribute(
                "aria-label",
                "Open navigation menu"
            );

        });

    });

    // Close mobile menu when switching to desktop
    window.addEventListener("resize", function() {

        if (window.innerWidth > 768) {

            navLinks.classList.remove("show");

            menuToggle.textContent = "☰";

            menuToggle.setAttribute("aria-expanded", "false");

        }

    });

}


/* 3. TYPING TEXT ANIMATION */

const typingElement = document.getElementById("typing-text");

if (typingElement) {

    const words = [
        "AIML Student",
        "Future Developer",
        "Python Learner",
        "AI Enthusiast"
    ];

    let wordIndex = 0;
    let charIndex = 0;
    let deleting = false;

    function typeEffect() {

        const currentWord = words[wordIndex];

        if (!deleting) {

            // Type one character
            charIndex++;

            typingElement.textContent =
                currentWord.substring(0, charIndex);

            // Wait after completing the word
            if (charIndex === currentWord.length) {

                deleting = true;

                setTimeout(typeEffect, 1200);

                return;
            }

        } else {

            // Delete one character
            charIndex--;

            typingElement.textContent =
                currentWord.substring(0, charIndex);

            // Move to the next word
            if (charIndex === 0) {

                deleting = false;

                wordIndex = (wordIndex + 1) % words.length;

            }

        }

        setTimeout(typeEffect, deleting ? 55 : 100);

    }

    // Start animation
    typeEffect();

}


/* 4. BACK TO TOP BUTTON */

const backToTop = document.getElementById("back-to-top");

if (backToTop) {

    // Show button after scrolling
    window.addEventListener("scroll", function() {

        if (window.scrollY > 300) {

            backToTop.classList.add("show");

        } else {

            backToTop.classList.remove("show");

        }

    });

    // Scroll to top when clicked
    backToTop.addEventListener("click", function() {

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    });

}


/* 5. SCROLL REVEAL ANIMATION */

const revealElements = document.querySelectorAll(

    ".section-title, " +
    ".about-text, " +
    ".info-card, " +
    ".skill-card, " +
    ".project-card, " +
    ".contact-info, " +
    ".contact-form"

);

if ("IntersectionObserver" in window) {

    const revealObserver = new IntersectionObserver(

        function(entries, observer) {

            entries.forEach(function(entry) {

                if (entry.isIntersecting) {

                    // Make element visible
                    entry.target.classList.add("visible");

                    // Stop observing after appearance
                    observer.unobserve(entry.target);

                }

            });

        },

        {
            threshold: 0.15
        }

    );

    // Apply animation to elements
    revealElements.forEach(function(element) {

        element.classList.add("reveal");

        revealObserver.observe(element);

    });

} else {

    // Fallback for older browsers
    revealElements.forEach(function(element) {

        element.classList.add("visible");

    });

}


/* 6. DYNAMIC COPYRIGHT YEAR */

const yearElement = document.getElementById("current-year");

if (yearElement) {

    yearElement.textContent = new Date().getFullYear();

}


/* 7. CONSOLE WELCOME MESSAGE */

console.log("--------------------------------");
console.log("Welcome to Ujjwal's Portfolio!");
console.log("JavaScript loaded successfully.");
console.log("All portfolio features initialized.");
console.log("--------------------------------");
