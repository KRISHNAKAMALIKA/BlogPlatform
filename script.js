
const API_URL = "http://localhost:3000/api";

// Find the login and registration forms in your HTML
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

// Display messages on the page
function showMessage(message, isError = false) {
    let messageBox = document.getElementById("messageBox");

    if (!messageBox) {
        messageBox = document.createElement("p");
        messageBox.id = "messageBox";
        messageBox.setAttribute("role", "status");

        const form =
            document.getElementById("loginForm") ||
            document.getElementById("registerForm");

        if (form) {
            form.prepend(messageBox);
        } else {
            document.body.prepend(messageBox);
        }
    }

    messageBox.textContent = message;
    messageBox.style.color = isError ? "red" : "green";
}

// Send a request to the backend
async function sendRequest(endpoint, data) {
    const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Something went wrong.");
    }

    return result;
}

// USER REGISTRATION
if (registerForm) {
    registerForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const name =
            document.getElementById("registerName")?.value.trim();

        const email =
            document.getElementById("registerEmail")?.value.trim();

        const password =
            document.getElementById("registerPassword")?.value;

        if (!name || !email || !password) {
            showMessage("Please fill in all fields.", true);
            return;
        }

        try {
            const result = await sendRequest("/auth/register", {
                name,
                email,
                password
            });

            showMessage(
                result.message || "Registration successful! Please log in."
            );

            registerForm.reset();
        } catch (error) {
            showMessage(error.message, true);
        }
    });
}

// USER LOGIN
if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email =
            document.getElementById("loginEmail")?.value.trim();

        const password =
            document.getElementById("loginPassword")?.value;

        if (!email || !password) {
            showMessage("Please enter your email and password.", true);
            return;
        }

        try {
            const result = await sendRequest("/auth/login", {
                email,
                password
            });

            if (!result.token) {
                showMessage("Login response did not include a token.", true);
                return;
            }

            // Save the login token for subsequent API requests
            sessionStorage.setItem("blogToken", result.token);

            showMessage("Login successful! Welcome to BlogPlatform.");

            // Redirect only if your project has a posts page
            // window.location.href = "posts.html";
        } catch (error) {
            showMessage(error.message, true);
        }
    });
}
