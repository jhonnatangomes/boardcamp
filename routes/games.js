import express from "express";
import querySearch from "../querySearch.js";
import connection from "../connection.js";
import Joi from "joi";
const router = express.Router();

router.get("/games", async (req, res) => {
    try {
        const { name, offset, limit, order } = req.query;
        let queryText = `
            SELECT games.*, categories.name AS "categoryName", 
            COUNT(rentals."rentDate") AS "rentalsCount"
            FROM games JOIN categories ON games."categoryId" = categories.id
            LEFT JOIN rentals ON games.id = rentals."gameId"
        `;
        let games;
        const queryParams = [];
        if (name) {
            queryParams.push(name + "%");
            queryText += ` WHERE games.name ILIKE $${queryParams.length}`;
        }

        queryText += ` GROUP BY games.id, categories.name ORDER BY games.id`;
        queryText = querySearch(offset, limit, queryText, queryParams, order);
        games = await connection.query(queryText, queryParams);
        games.rows.forEach(
            (game) => (game.rentalsCount = Number(game.rentalsCount))
        );
        res.send(games.rows);
    } catch (error) {
        console.log(error.message);
        res.status(500).send(error.message);
    }
});

router.post("/games", async (req, res) => {
    try {
        const { name, image, stockTotal, categoryId, pricePerDay } = req.body;
        const schema = Joi.object({
            name: Joi.string().required(),
            image: Joi.string().uri().required(),
            stockTotal: Joi.number().integer().min(1).required(),
            pricePerDay: Joi.number().integer().min(1).required(),
            categoryId: Joi.number().integer().min(1).required(),
        });

        const validation = schema.validate({
            name,
            image,
            stockTotal,
            categoryId,
            pricePerDay,
        });

        const categorySearch = await connection.query(
            "SELECT * FROM categories WHERE id = $1",
            [categoryId]
        );

        const nameSearch = await connection.query(
            "SELECT * FROM games WHERE name = $1",
            [name]
        );

        if (validation.error) {
            res.status(400);
            res.send(validation.error.details[0].message);
            return;
        }
        if (!categorySearch.rows[0]) {
            res.status(400);
            res.send("Categoria não existente");
            return;
        }
        if (nameSearch.rows[0]) {
            res.sendStatus(409);
            return;
        }

        await connection.query(
            'INSERT INTO games (name, image, "stockTotal", "categoryId", "pricePerDay") VALUES ($1, $2, $3, $4, $5)',
            [name, image, stockTotal, categoryId, pricePerDay]
        );
        res.sendStatus(201);
    } catch (error) {
        console.log(error.message);
        res.status(500).send(error.message);
    }
});

export default router;
