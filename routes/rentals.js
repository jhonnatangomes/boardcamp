import express from "express";
import querySearch from "../querySearch.js";
import connection from "../connection.js";
import Joi from "joi";
import dayjs from "dayjs";
const router = express.Router();

router.get("/rentals", async (req, res) => {
    try {
        let queryText = `
        SELECT rentals.*, customers.name as "customerName", 
        games.name as "gameName", games."categoryId",
        categories.name as "categoryName" 
        FROM rentals JOIN customers
        ON rentals."customerId" = customers.id
        JOIN games
        ON rentals."gameId" = games.id 
        JOIN categories
        ON games."categoryId" = categories.id
        `;

        const { customerId, gameId, offset, limit, status, startDate } =
            req.query;
        let rentals;
        const queryParams = [];

        if (customerId) {
            queryParams.push(customerId);
            queryText += ` WHERE customers.id = $${queryParams.length}`;
        }
        if (gameId) {
            queryParams.push(gameId);
            if (!customerId) {
                queryText += ` WHERE games.id = $${queryParams.length}`;
            } else {
                queryText += ` AND games.id = $${queryParams.length}`;
            }
        }
        if (status) {
            if (status === "open") {
                if (!customerId && !gameId) {
                    queryText += ` WHERE rentals."returnDate" IS null`;
                } else {
                    queryText += ` AND rentals."returnDate" IS null`;
                }
            }
            if (status === "closed") {
                if (!customerId && !gameId) {
                    queryText += ` WHERE rentals."returnDate" IS NOT null`;
                } else {
                    queryText += ` AND rentals."returnDate" IS NOT null`;
                }
            }
        }
        if (startDate) {
            queryParams.push(startDate);
            if (!customerId && !gameId && !status) {
                queryText += ` WHERE rentals."rentDate" >= $${queryParams.length}`;
            } else {
                queryText += ` AND rentals."rentDate" >= $${queryParams.length}`;
            }
        }

        queryText = querySearch(offset, limit, queryText, queryParams);
        rentals = await connection.query(queryText, queryParams);
        rentals.rows.forEach((rental) => {
            rental.rentDate = dayjs(rental.rentDate).format("YYYY-MM-DD");
            rental.returnDate = rental.returnDate
                ? dayjs(rental.returnDate).format("YYYY-MM-DD")
                : null;
            rental.customer = {
                id: rental.customerId,
                name: rental.customerName,
            };
            rental.game = {
                id: rental.gameId,
                name: rental.gameName,
                categoryId: rental.categoryId,
                categoryName: rental.categoryName,
            };
            delete rental.customerName;
            delete rental.gameName;
            delete rental.categoryId;
            delete rental.categoryName;
        });
        res.send(rentals.rows);
    } catch (error) {
        console.log(error);
        res.status(500).send(error.message);
    }
});

router.post("/rentals", async (req, res) => {
    try {
        const { customerId, gameId, daysRented } = req.body;
        const schema = Joi.object({
            customerId: Joi.number().integer().required(),
            gameId: Joi.number().integer().required(),
            daysRented: Joi.number().integer().min(1).required(),
        });

        const validation = schema.validate({
            customerId,
            gameId,
            daysRented,
        });

        if (validation.error) {
            res.status(400).send(validation.error.details[0].message);
            return;
        }

        const customer = await connection.query(
            "SELECT * FROM customers WHERE id = $1",
            [customerId]
        );

        const game = await connection.query(
            "SELECT * FROM games WHERE id = $1",
            [gameId]
        );

        const numberOfGamesRented = await connection.query(
            `
            SELECT rentals.*, games."stockTotal" 
            FROM rentals JOIN games
            ON rentals."gameId" = games.id
            WHERE "gameId" = $1 AND rentals."returnDate" IS null
        `,
            [gameId]
        );

        if (!customer.rows[0] || !game.rows[0]) {
            res.status(400);
            if (!customer.rows[0]) res.send("Cliente inexistente");
            if (!game.rows[0]) res.send("Jogo inexistente");
            return;
        }
        if (
            numberOfGamesRented.rows[0] &&
            numberOfGamesRented.rows.length ===
                numberOfGamesRented.rows[0].stockTotal
        ) {
            res.status(400).send("Não há mais jogos no estoque");
            return;
        }
        const rentDate = dayjs().format("YYYY-MM-DD");
        const originalPrice = game.rows[0].pricePerDay * daysRented;
        await connection.query(
            `
            INSERT INTO rentals 
            ("customerId", "gameId", "rentDate", "daysRented", "returnDate", "originalPrice", "delayFee")
            VALUES 
            ($1, $2, $3, $4, $5, $6, $7)
        `,
            [
                customerId,
                gameId,
                rentDate,
                daysRented,
                null,
                originalPrice,
                null,
            ]
        );
        res.sendStatus(201);
    } catch (error) {
        console.log(error);
        res.status(500).send(error.message);
    }
});

router.post("/rentals/:id/return", async (req, res) => {
    try {
        const id = req.params.id;
        const rental = await connection.query(
            `
            SELECT * FROM rentals WHERE id = $1
            `,
            [id]
        );
        if (!rental.rows[0]) {
            res.sendStatus(404);
            return;
        }
        if (rental.rows[0].returnDate) {
            res.status(400).send("Aluguel já finalizado");
            return;
        }

        rental.rows[0].rentDate = dayjs(rental.rows[0].rentDate).format(
            "YYYY-MM-DD"
        );

        const returnDate = dayjs().format("YYYY-MM-DD");
        let delayFee = null;
        const deliveryDay = dayjs(rental.rows[0].rentDate).add(
            rental.rows[0].daysRented,
            "day"
        );
        if (dayjs(returnDate).diff(deliveryDay, "day") > 0) {
            const pricePerDay =
                rental.rows[0].originalPrice / rental.rows[0].daysRented;
            delayFee = dayjs(returnDate).diff(deliveryDay, "day") * pricePerDay;
        }

        await connection.query(
            `
            UPDATE rentals SET "returnDate" = $1, "delayFee" = $2
            WHERE id = $3
        `,
            [returnDate, delayFee, id]
        );
        res.sendStatus(200);
    } catch (error) {
        console.log(error);
        res.status(500).send(error.message);
    }
});

router.delete("/rentals/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const rental = await connection.query(
            `
            SELECT * FROM rentals WHERE id = $1
        `,
            [id]
        );
        if (!rental.rows[0]) {
            res.sendStatus(404);
            return;
        }
        if (rental.rows[0].returnDate) {
            res.status(400).send("O aluguel já está finalizado");
            return;
        }
        await connection.query("DELETE FROM rentals WHERE id = $1", [id]);
        res.sendStatus(200);
    } catch (error) {
        console.log(error);
        res.status(500).send(error.message);
    }
});

router.get("/rentals/metrics", async (req, res) => {
    const { startDate, endDate } = req.query;
    let queryText = "";
    const queryParams = [];
    if (startDate) {
        queryParams.push(startDate);
        queryText += ` WHERE "rentDate" >= $${queryParams.length}`;
    }
    if (endDate) {
        queryParams.push(endDate);
        if (startDate) {
            queryText += ` AND "rentDate" <= $${queryParams.length}`;
        } else {
            queryText += ` WHERE "rentDate" <= $${queryParams.length}`;
        }
    }
    const originalPrice = await connection.query(
        `
        SELECT SUM ("originalPrice") FROM rentals
    ` + queryText,
        queryParams
    );
    const delayFee = await connection.query(
        `
        SELECT SUM ("delayFee") FROM rentals
    ` + queryText,
        queryParams
    );

    const revenue =
        Number(originalPrice.rows[0].sum) + Number(delayFee.rows[0].sum);
    const rentals = await connection.query(
        `
        SELECT COUNT(id) FROM rentals
    ` + queryText,
        queryParams
    );

    const average = revenue / rentals.rows[0].count;

    res.send({
        revenue: Number(revenue),
        rentals: Number(rentals.rows[0].count),
        average,
    });
});

export default router;
