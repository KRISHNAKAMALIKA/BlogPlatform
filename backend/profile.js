
const express = require("express");
const router = express.Router();

const mysql = require("mysql2");

// Database connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "blogplatform"
});

// Get user profile
router.get("/:id", (req, res) => {
    const userId = req.params.id;

    db.query(
        "SELECT id, name, email FROM users WHERE id = ?",
        [userId],
        (err, results) => {
            if (err) {
                return res.status(500).json({
                    message: "Database error"
                });
            }

            if (results.length === 0) {
                return res.status(404).json({
                    message: "User not found"
                });
            }

            res.json(results[0]);
        }
    );
});

// Update user profile
router.put("/:id", (req, res) => {
    const userId = req.params.id;
    const { name, email } = req.body;

    db.query(
        "UPDATE users SET name = ?, email = ? WHERE id = ?",
        [name, email, userId],
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    message: "Database error"
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "User not found"
                });
            }

            res.json({
                message: "Profile updated successfully"
            });
        }
    );
});

module.exports = router;
