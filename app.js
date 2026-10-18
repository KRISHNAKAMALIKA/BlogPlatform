

const API_URL = "http://localhost:3000/api";

const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const message = document.getElementById("authMessage");
        const button = loginForm.querySelector('button[type="submit"]');

        message.textContent = "";

        try {
            button.disabled = true;
            button.textContent = "Logging in...";

            const response = await fetch(`${API_URL}/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Login failed.");
            }

            if (!result.token) {
                throw new Error("The server did not return a login token.");
            }

            sessionStorage.setItem("blogToken", result.token);

            message.textContent = "Login successful! Opening BlogSpace...";
            message.style.color = "green";

            window.location.href = "index.html";
        } catch (error) {
            message.textContent =
                error.message === "Failed to fetch"
                    ? "Cannot connect to the backend. Make sure your server is running."
                    : error.message;

            message.style.color = "red";
        } finally {
            button.disabled = false;
            button.textContent = "Login";
        }
    });
}
