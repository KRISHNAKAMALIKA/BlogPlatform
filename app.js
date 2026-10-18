
const API_BASE = "http://localhost:3000/api";

const getToken = () => localStorage.getItem("blogToken");

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };

  if (options.body) headers["Content-Type"] = "application/json";
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && getToken()) {
      localStorage.removeItem("blogToken");
    }
    throw new Error(data.message || "Something went wrong.");
  }

  return data;
}

function showMessage(id, message) {
  const element = document.getElementById(id);
  if (element) element.textContent = message;
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

// REGISTER
const registerForm = document.getElementById("registerForm");

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const data = await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: document.getElementById("name").value.trim(),
          email: document.getElementById("email").value.trim(),
          password: document.getElementById("password").value
        })
      });

      localStorage.setItem("blogToken", data.token);
      window.location.href = "index.html";
    } catch (error) {
      showMessage("authMessage", error.message);
    }
  });
}

// LOGIN
const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: document.getElementById("email").value.trim(),
          password: document.getElementById("password").value
        })
      });

      localStorage.setItem("blogToken", data.token);
      window.location.href = "index.html";
    } catch (error) {
      showMessage("authMessage", error.message);
    }
  });
}

// HOME PAGE
const blogList = document.getElementById("blogList");

if (blogList) {
  const postForm = document.getElementById("postForm");
  const loginNotice = document.getElementById("loginNotice");
  const logoutBtn = document.getElementById("logoutBtn");

  function updateLoginUI() {
    const loggedIn = Boolean(getToken());
    postForm.classList.toggle("hidden", !loggedIn);
    loginNotice.classList.toggle("hidden", loggedIn);
    logoutBtn.classList.toggle("hidden", !loggedIn);
  }

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("blogToken");
    window.location.reload();
  });

  postForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      await api("/posts", {
        method: "POST",
        body: JSON.stringify({
          title: document.getElementById("postTitle").value.trim(),
          content: document.getElementById("postContent").value.trim()
        })
      });

      postForm.reset();
      showMessage("postMessage", "Your blog was published!");
      await loadPosts();
    } catch (error) {
      showMessage("postMessage", error.message);
    }
  });

  async function loadPosts() {
    blogList.replaceChildren();
    showMessage("loadingMessage", "Loading blogs...");

    try {
      const data = await api("/posts");
      showMessage(
        "loadingMessage",
        data.posts.length ? "" : "No blogs yet. Be the first to publish!"
      );

      data.posts.forEach((post) => {
        blogList.appendChild(createPostCard(post));
      });
    } catch (error) {
      showMessage("loadingMessage", error.message);
    }
  }

  function createPostCard(post) {
    const card = makeElement("article", "blog-card");
    const heading = makeElement("h3", "", post.title);
    const meta = makeElement(
      "p",
      "blog-meta",
      `By ${post.author_name} · ${new Date(post.created_at).toLocaleString()}`
    );
    const content = makeElement("p", "post-content", post.content);

    card.append(heading, meta, content);

    // Only the author can edit or delete their own post.
    // The backend must enforce this rule as well.
    if (post.is_author && getToken()) {
      const actions = makeElement("div", "actions");
      const editButton = makeElement("button", "secondary", "Edit");
      const deleteButton = makeElement("button", "danger", "Delete");

      editButton.addEventListener("click", async () => {
        const title = prompt("Edit blog title:", post.title);
        if (title === null) return;

        const text = prompt("Edit blog content:", post.content);
        if (text === null) return;

        if (!title.trim() || !text.trim()) {
          alert("Title and content are required.");
          return;
        }

        try {
          await api(`/posts/${post.id}`, {
            method: "PUT",
            body: JSON.stringify({
              title: title.trim(),
              content: text.trim()
            })
          });
          await loadPosts();
        } catch (error) {
          alert(error.message);
        }
      });

      deleteButton.addEventListener("click", async () => {
        if (!confirm("Delete this blog permanently?")) return;

        try {
          await api(`/posts/${post.id}`, { method: "DELETE" });
          await loadPosts();
        } catch (error) {
          alert(error.message);
        }
      });

      actions.append(editButton, deleteButton);
      card.appendChild(actions);
    }

    const comments = makeElement("section", "comments");
    comments.appendChild(makeElement("h4", "", "Comments"));

    (post.comments || []).forEach((comment) => {
      const item = makeElement("div", "comment");
      item.appendChild(
        makeElement("strong", "", `${comment.author_name}: `)
      );
      item.appendChild(makeElement("span", "", comment.content));
      comments.appendChild(item);
    });

    if (getToken()) {
      const form = document.createElement("form");
      const input = document.createElement("input");
      input.placeholder = "Write a comment...";
      input.maxLength = 2000;
      input.required = true;
      input.setAttribute("aria-label", "Your comment");

      const button = makeElement("button", "", "Add Comment");
      const message = makeElement("p", "muted");

      form.append(input, button);
      comments.append(form, message);

      form.addEventListener("submit", async (event) => {
        event.preventDefault();

        try {
          await api(`/posts/${post.id}/comments`, {
            method: "POST",
            body: JSON.stringify({ content: input.value.trim() })
          });
          await loadPosts();
        } catch (error) {
          message.textContent = error.message;
        }
      });
    } else {
      comments.appendChild(
        makeElement("p", "muted", "Log in to leave a comment.")
      );
    }

    card.appendChild(comments);
    return card;
  }

  updateLoginUI();
  loadPosts();
}
