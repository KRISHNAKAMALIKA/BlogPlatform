

const API_URL = "http://localhost:3000/api";

const blogList = document.getElementById("blogList");
const loadingMessage = document.getElementById("loadingMessage");
const postForm = document.getElementById("postForm");
const loginNotice = document.getElementById("loginNotice");
const postMessage = document.getElementById("postMessage");
const logoutBtn = document.getElementById("logoutBtn");

function getToken() {
    return sessionStorage.getItem("blogToken");
}

function showMessage(element, message, isError = false) {
    if (!element) return;
    element.textContent = message;
    element.style.color = isError ? "red" : "green";
}

function updateLoginState() {
    const loggedIn = Boolean(getToken());

    if (postForm) postForm.classList.toggle("hidden", !loggedIn);
    if (loginNotice) loginNotice.classList.toggle("hidden", loggedIn);
    if (logoutBtn) logoutBtn.classList.toggle("hidden", !loggedIn);
}

async function apiRequest(endpoint, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (getToken()) {
        headers.Authorization = `Bearer ${getToken()}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });

    const result = await response.json().catch(() => ({}));

    if (response.status === 401) {
        sessionStorage.removeItem("blogToken");
        updateLoginState();
    }

    if (!response.ok) {
        throw new Error(result.message || "Request failed.");
    }

    return result;
}

// Load and display blog posts
async function loadBlogs() {
    if (!blogList) return;

    if (loadingMessage) {
        loadingMessage.textContent = "Loading blogs...";
    }

    try {
        const result = await apiRequest("/posts");
        const posts = Array.isArray(result) ? result : result.posts;

        blogList.replaceChildren();

        if (!posts || posts.length === 0) {
            if (loadingMessage) {
                loadingMessage.textContent = "No blogs yet. Be the first to publish!";
            }
            return;
        }

        if (loadingMessage) loadingMessage.textContent = "";

        posts.forEach((post) => {
            const article = document.createElement("article");
            article.className = "panel blog-card";

            const title = document.createElement("h3");
            title.textContent = post.title;

            const author = document.createElement("p");
            author.className = "blog-author";
            author.textContent = `By ${post.author || post.name || "Unknown author"}`;

            const content = document.createElement("p");
            content.textContent = post.content;

            article.append(title, author, content);

            const commentsHeading = document.createElement("h4");
            commentsHeading.textContent = "Comments";
            article.appendChild(commentsHeading);

            const comments = Array.isArray(post.comments) ? post.comments : [];

            comments.forEach((comment) => {
                const commentElement = document.createElement("p");
                commentElement.textContent =
                    `${comment.name || comment.author || "User"}: ${comment.content}`;
                article.appendChild(commentElement);
            });

            if (getToken()) {
                const commentForm = document.createElement("form");
                const commentInput = document.createElement("input");
                commentInput.type = "text";
                commentInput.placeholder = "Write a comment...";
                commentInput.maxLength = 2000;
                commentInput.required = true;

                const commentButton = document.createElement("button");
                commentButton.type = "submit";
                commentButton.textContent = "Add Comment";

                commentForm.append(commentInput, commentButton);

                commentForm.addEventListener("submit", async (event) => {
                    event.preventDefault();

                    try {
                        await apiRequest(`/posts/${post.id}/comments`, {
                            method: "POST",
                            body: JSON.stringify({
                                content: commentInput.value.trim()
                            })
                        });

                        await loadBlogs();
                    } catch (error) {
                        alert(error.message);
                    }
                });

                article.appendChild(commentForm);
            }

            blogList.appendChild(article);
        });
    } catch (error) {
        if (loadingMessage) {
            loadingMessage.textContent =
                "Could not load blogs. Check that your backend is running.";
        }
        console.error(error);
    }
}

// Publish a blog post
if (postForm) {
    postForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const title = document.getElementById("postTitle").value.trim();
        const content = document.getElementById("postContent").value.trim();

        if (!title || !content) {
            showMessage(postMessage, "Please enter a title and story.", true);
            return;
        }

        try {
            await apiRequest("/posts", {
                method: "POST",
                body: JSON.stringify({ title, content })
            });

            postForm.reset();
            showMessage(postMessage, "Blog published successfully!");
            await loadBlogs();
        } catch (error) {
            showMessage(postMessage, error.message, true);
        }
    });
}

// Logout
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        sessionStorage.removeItem("blogToken");
        updateLoginState();
        loadBlogs();
        window.location.href = "index.html";
    });
}

updateLoginState();
loadBlogs();
