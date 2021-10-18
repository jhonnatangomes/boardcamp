import express from "express";
import querySearch from "../querySearch.js";
import connection from "../connection.js";
const router = express.Router();

router.get("/categories", async (req, res) => {
    try {
        const { offset, limit, order } = req.query;
        let queryText = "SELECT * FROM categories";
        let categories;
        const queryParams = [];

        queryText = querySearch(offset, limit, queryText, queryParams, order);
        console.log(queryText);
        categories = await connection.query(queryText, queryParams);
        res.send(categories.rows);
    } catch (error) {
        console.log(error.message);
        res.status(500).send(error.message);
    }
});

router.post("/categories", async (req, res) => {
    try {
        const { name } = req.body;
        if (typeof name !== "string" || name === "") {
            res.sendStatus(400);
            return;
        }
        const categories = await connection.query(
            "SELECT * FROM categories WHERE name = $1",
            [name]
        );

        if (categories.rows[0]) {
            res.sendStatus(409);
        } else {
            await connection.query(
                "INSERT INTO categories (name) VALUES ($1)",
                [name]
            );
            res.sendStatus(201);
        }
    } catch (error) {
        console.log(error.message);
        res.status(500).send(error.message);
    }
});

export default router;
