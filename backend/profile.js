

const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");

// Use the same database configuration as server.js
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "blogplatform",
  waitForConnections: true,
  connectionLimit: 10
});

// Verify login token
function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : "";

  if (!token) {
    return res.status(401).json({
      message: "Please log in first."
    });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired login session."
    });
  }
}

// GET LOGGED-IN USER PROFILE
router.get("/", authenticate, async (req, res) => {
  try {
    const [users] = await pool.execute(
      "SELECT id, name, email FROM users WHERE id = ?",
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        message: "User not found."
      });
    }

    res.json({ user: users[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Could not load profile."
    });
  }
});

// UPDATE LOGGED-IN USER PROFILE
router.put("/", authenticate, async (req, res) => {
  try {
    const { name, email } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 80 ||
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      email.trim().length > 255
    ) {
      return res.status(400).json({
        message: "Enter a valid name and email."
      });
    }

    const [result] = await pool.execute(
      "UPDATE users SET name = ?, email = ? WHERE id = ?",
      [
        name.trim(),
        email.trim().toLowerCase(),
        req.user.userId
      ]
    );

    if (result.affectedRows === 0) {
      const [users] = await pool.execute(
        "SELECT id FROM users WHERE id = ?",
        [req.user.userId]
      );

      if (users.length === 0) {
        return res.status(404).json({
          message: "User not found."
        });
      }
    }

    res.json({
      message: "Profile updated successfully."
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "This email is already registered."
      });
    }

    console.error(error);
    res.status(500).json({
      message: "Could not update profile."
    });
  }
});

module.exports = router;
