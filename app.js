


const API_URL = "http://localhost:3000/api";

// LOGIN AND REGISTRATION
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

// Show success or error messages
function showAuthMessage(message, isError = false) {
    const messageElement = document.getElementById("authMessage");

    if (messageElement) {
        messageElement.textContent = message;
        messageElement.style.color = isError ? "red" : "green";
    }
}

// Send request to backend
async function sendAuthRequest(endpoint, data) {
    const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(result.message || "Request failed.");
    }

    return result;
}

// REGISTRATION
if (registerForm) {
    registerForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        if (password.length < 8) {
            showAuthMessage(
                "Password must contain at least 8 characters.",
                true
            );
            return;
        }

        const button = registerForm.querySelector('button[type="submit"]');

        try {
            button.disabled = true;
            button.textContent = "Creating account...";

            const result = await sendAuthRequest("/auth/register", {
                name,
                email,
                password
            });

            showAuthMessage(
                result.message || "Account created successfully! You can now log in."
            );

            registerForm.reset();
        } catch (error) {
            showAuthMessage(error.message, true);
        } finally {
            button.disabled = false;
            button.textContent = "Create Account";
        }
    });
}

// LOGIN
if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        const button = loginForm.querySelector('button[type="submit"]');

        try {
            button.disabled = true;
            button.textContent = "Logging in...";

            const result = await sendAuthRequest("/auth/login", {
                email,
                password
            });

            if (!result.token) {
                throw new Error("The server did not return a login token.");
            }

            sessionStorage.setItem("blogToken", result.token);

            showAuthMessage("Login successful!");

            window.location.href = "index.html";
        } catch (error) {
            showAuthMessage(
                error.message === "Failed to fetch"
                    ? "Cannot connect. Check that your backend is running."
                    : error.message,
                true
            );
        } finally {
            button.disabled = false;
            button.textContent = "Login";
        }
    });
}
