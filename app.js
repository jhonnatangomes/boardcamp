import express from "express";
import cors from "cors";
import pg from "pg";
import Joi from "joi";
import dayjs from "dayjs";

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

app.get("/categories", async (req, res) => {
    try {
        const categories = await connection.query("SELECT * FROM categories");
        res.send(categories.rows);
    } catch (error) {
        console.log(error.message);
        res.status(500).send(error.message);
    }
});

app.post("/categories", async (req, res) => {
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

app.get("/games", async (req, res) => {
    try {
        const { name } = req.query;
        if (name) {
            const games = await connection.query(
                `
                SELECT games.*, categories.name AS "categoryName" 
                FROM games JOIN categories ON games."categoryId" = categories.id
                WHERE games.name ILIKE $1;
                `,
                [name + "%"]
            );
            res.send(games.rows);
            return;
        }
        const games = await connection.query(`
        SELECT games.*, categories.name AS "categoryName" 
        FROM games JOIN categories ON games."categoryId" = categories.id;
        `);
        res.send(games.rows);
    } catch (error) {
        console.log(error.message);
        res.status(500).send(error.message);
    }
});

app.post("/games", async (req, res) => {
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

app.get("/customers", async (req, res) => {
    try {
        const { cpf } = req.query;
        if (cpf) {
            const customers = await connection.query(
                "SELECT * FROM customers WHERE cpf ILIKE $1",
                [cpf + "%"]
            );
            customers.rows = customers.rows.map((customer) => {
                return {
                    ...customer,
                    birthday: dayjs(customer.birthday).format("YYYY-MM-DD"),
                };
            });
            res.send(customers.rows);
            return;
        }
        const customers = await connection.query("SELECT * FROM customers");
        customers.rows = customers.rows.map((customer) => {
            return {
                ...customer,
                birthday: dayjs(customer.birthday).format("YYYY-MM-DD"),
            };
        });
        res.send(customers.rows);
    } catch (error) {
        console.log(error.message);
        res.status(500).send(error.message);
    }
});

app.get("/customers/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const customer = await connection.query(
            "SELECT * FROM customers WHERE id = $1",
            [id]
        );
        if (customer.rows[0]) {
            customer.rows[0] = {
                ...customer.rows[0],
                birthday: dayjs(customer.rows[0].birthday).format("YYYY-MM-DD"),
            };
            res.send(customer.rows[0]);
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        console.log(error.message);
        res.status(500).send(error.message);
    }
});

app.post("/customers", async (req, res) => {
    try {
        const { name, phone, cpf, birthday } = req.body;
        const schema = Joi.object({
            name: Joi.string().required(),
            phone: Joi.string()
                .min(10)
                .max(11)
                .pattern(/^[0-9]+$/)
                .required(),
            cpf: Joi.string().length(11).required(),
            birthday: Joi.string()
                .pattern(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/)
                .required(),
        });

        const validation = schema.validate({
            name,
            phone,
            cpf,
            birthday,
        });

        const cpfSearch = await connection.query(
            "SELECT * FROM customers WHERE cpf = $1",
            [cpf]
        );

        if (validation.error) {
            res.status(400).send(validation.error.details[0].message);
            return;
        }
        if (cpfSearch.rows[0]) {
            res.sendStatus(409);
            return;
        }

        await connection.query(
            "INSERT INTO customers (name, phone, cpf, birthday) VALUES ($1, $2, $3, $4)",
            [name, phone, cpf, birthday]
        );
        res.sendStatus(201);
    } catch (error) {
        console.log(error.message);
        res.status(500).send(error.message);
    }
});

app.put("/customers/:id", async (req, res) => {
    try {
        const { name, phone, cpf, birthday } = req.body;
        const { id } = req.params;
        const schema = Joi.object({
            name: Joi.string().required(),
            phone: Joi.string()
                .min(10)
                .max(11)
                .pattern(/^[0-9]+$/)
                .required(),
            cpf: Joi.string().length(11).required(),
            birthday: Joi.string()
                .pattern(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/)
                .required(),
        });

        const validation = schema.validate({
            name,
            phone,
            cpf,
            birthday,
        });

        const cpfSearch = await connection.query(
            "SELECT * FROM customers WHERE cpf = $1",
            [cpf]
        );

        if (validation.error) {
            res.status(400).send(validation.error.details[0].message);
            return;
        }
        if (cpfSearch.rows[0]) {
            res.sendStatus(409);
            return;
        }

        await connection.query(
            "UPDATE customers SET name = $1, phone = $2, cpf = $3, birthday = $4 WHERE id = $5",
            [name, phone, cpf, birthday, id]
        );
        res.sendStatus(200);
    } catch (error) {
        console.log(error);
        res.status(500).send(error.message);
    }
});

app.get("/rentals", async (req, res) => {
    try {
        const queryText = `
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

        const { customerId, gameId } = req.query;
        let rentals;

        if (customerId && !gameId) {
            rentals = await connection.query(
                queryText +
                    `
                WHERE customers.id = $1
            `,
                [customerId]
            );
        }
        if (gameId && !customerId) {
            rentals = await connection.query(
                queryText +
                    `
                WHERE games.id = $1
            `,
                [gameId]
            );
        }
        if (!gameId && !customerId) {
            rentals = await connection.query(queryText);
        }
        rentals.rows.forEach((rental) => {
            rental.rentDate = dayjs(rental.rentDate).format("YYYY-MM-DD");
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

app.post("/rentals", async (req, res) => {
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
            WHERE "gameId" = $1
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

app.listen(4000);
