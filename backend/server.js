
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("Set JWT_SECRET to a random secret of at least 32 characters.");
}

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5500"
}));
app.use(express.json({ limit: "20kb" }));

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "blogplatform",
  waitForConnections: true,
  connectionLimit: 10
});

function createToken(user) {
  return jwt.sign(
    { userId: user.id, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : "";

  if (!token) {
    return res.status(401).json({ message: "Please log in first." });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({
      message: "Your session has expired. Please log in again."
    });
  }
}

function validateText(value, maxLength) {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= maxLength;
}

function handleError(res, error) {
  console.error(error);
  return res.status(500).json({ message: "Server error. Please try again." });
}

app.get("/api/health", (req, res) => {
  res.json({ message: "BlogPlatform API is running." });
});

// REGISTER
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!validateText(name, 80) ||
        !validateText(email, 255) ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof password !== "string" ||
        password.length < 8 ||
        password.length > 72) {
      return res.status(400).json({
        message: "Enter a valid name, email, and password of 8–72 characters."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);

    const [result] = await pool.execute(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
      [name.trim(), normalizedEmail, passwordHash]
    );

    const user = { id: result.insertId, name: name.trim() };

    res.status(201).json({
      message: "Account created successfully.",
      token: createToken(user),
      user
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "This email is already registered."
      });
    }
    return handleError(res, error);
  }
});

// LOGIN
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== "string" ||
        typeof password !== "string" ||
        !email.trim() ||
        !password ||
        password.length > 72) {
      return res.status(400).json({
        message: "Enter your email and password."
      });
    }

    const [rows] = await pool.execute(
      "SELECT id, name, email, password_hash FROM users WHERE email = ?",
      [email.trim().toLowerCase()]
    );

    if (!rows.length ||
        !(await bcrypt.compare(password, rows[0].password_hash))) {
      return res.status(401).json({
        message: "Incorrect email or password."
      });
    }

    const user = {
      id: rows[0].id,
      name: rows[0].name,
      email: rows[0].email
    };

    res.json({
      message: "Login successful.",
      token: createToken(user),
      user
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// GET ALL POSTS AND THEIR COMMENTS
app.get("/api/posts", async (req, res) => {
  try {
    let viewerId = null;
    const header = req.headers.authorization || "";

    if (header.startsWith("Bearer ")) {
      try {
        const decoded = jwt.verify(
          header.slice(7),
          process.env.JWT_SECRET
        );
        viewerId = decoded.userId;
      } catch {
        // Public visitors can still read published posts.
      }
    }

    const [posts] = await pool.execute(`
      SELECT p.id, p.user_id, p.title, p.content, p.created_at,
             u.name AS author_name
      FROM posts p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `);

    const [comments] = await pool.execute(`
      SELECT c.id, c.post_id, c.content, c.created_at,
             u.name AS author_name
      FROM comments c
      JOIN users u ON c.user_id = u.id
      ORDER BY c.created_at ASC
    `);

    const result = posts.map((post) => ({
      ...post,
      is_author: viewerId !== null &&
        Number(viewerId) === Number(post.user_id),
      comments: comments.filter(
        (comment) => Number(comment.post_id) === Number(post.id)
      )
    }));

    res.json({ posts: result });
  } catch (error) {
    return handleError(res, error);
  }
});

// CREATE A POST
app.post("/api/posts", authenticate, async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!validateText(title, 150) ||
        !validateText(content, 20000)) {
      return res.status(400).json({
        message: "Title (max 150) and content (max 20000) are required."
      });
    }

    const [result] = await pool.execute(
      "INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)",
      [req.user.userId, title.trim(), content.trim()]
    );

    res.status(201).json({
      message: "Blog published.",
      postId: result.insertId
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// EDIT A POST — ONLY ITS AUTHOR
app.put("/api/posts/:id", authenticate, async (req, res) => {
  try {
    const { title, content } = req.body;
    const postId = Number(req.params.id);

    if (!Number.isSafeInteger(postId) || postId < 1) {
      return res.status(400).json({ message: "Invalid post ID." });
    }

    if (!validateText(title, 150) ||
        !validateText(content, 20000)) {
      return res.status(400).json({
        message: "Valid title and content are required."
      });
    }

    const [result] = await pool.execute(
      `UPDATE posts SET title = ?, content = ?
       WHERE id = ? AND user_id = ?`,
      [title.trim(), content.trim(), postId, req.user.userId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        message: "Post not found or you are not its author."
      });
    }

    res.json({ message: "Blog updated successfully." });
  } catch (error) {
    return handleError(res, error);
  }
});

// DELETE A POST — ONLY ITS AUTHOR
app.delete("/api/posts/:id", authenticate, async (req, res) => {
  try {
    const postId = Number(req.params.id);

    if (!Number.isSafeInteger(postId) || postId < 1) {
      return res.status(400).json({ message: "Invalid post ID." });
    }

    const [result] = await pool.execute(
      "DELETE FROM posts WHERE id = ? AND user_id = ?",
      [postId, req.user.userId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        message: "Post not found or you are not its author."
      });
    }

    res.json({ message: "Blog deleted successfully." });
  } catch (error) {
    return handleError(res, error);
  }
});

// ADD A COMMENT
app.post("/api/posts/:id/comments", authenticate, async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const { content } = req.body;

    if (!Number.isSafeInteger(postId) || postId < 1) {
      return res.status(400).json({ message: "Invalid post ID." });
    }

    if (!validateText(content, 2000)) {
      return res.status(400).json({
        message: "Comment must contain 1–2000 characters."
      });
    }

    const [posts] = await pool.execute(
      "SELECT id FROM posts WHERE id = ?",
      [postId]
    );

    if (!posts.length) {
      return res.status(404).json({ message: "Blog post not found." });
    }

    const [result] = await pool.execute(
      "INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)",
      [postId, req.user.userId, content.trim()]
    );

    res.status(201).json({
      message: "Comment added.",
      commentId: result.insertId
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// START SERVER
async function startServer() {
  try {
    await pool.query("SELECT 1");
    console.log("Connected to MySQL.");

    app.listen(PORT, () => {
      console.log(`BlogPlatform API running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Could not connect to MySQL:", error.message);
    process.exit(1);
  }
}

startServer();
