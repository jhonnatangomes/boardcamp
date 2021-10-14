import express from "express";
import cors from "cors";
import pg from "pg";
import Joi from "joi";

const { Pool } = pg;

const app = express();
app.use(cors());
app.use(express.json());

const connection = new Pool({
    user: "bootcamp_role",
    password: "senha_super_hiper_ultra_secreta_do_role_do_bootcamp",
    host: "localhost",
    port: 5432,
    database: "boardcamp",
});

app.get("/check-status", (req, res) => {
    res.send("It works");
});

app.get("/categories", (req, res) => {
    connection.query("SELECT * FROM categories").then((categories) => {
        res.send(categories.rows);
    });
});

app.post("/categories", (req, res) => {
    const { name } = req.body;
    if (typeof name !== "string" || name === "") {
        res.sendStatus(400);
    } else {
        connection
            .query("SELECT * FROM categories WHERE name = $1", [name])
            .then((categories) => {
                if (categories.rows[0]) {
                    res.sendStatus(409);
                } else {
                    connection
                        .query("INSERT INTO categories (name) VALUES ($1)", [
                            name,
                        ])
                        .then(() => {
                            res.sendStatus(201);
                        });
                }
            });
    }
});

app.listen(4000);
