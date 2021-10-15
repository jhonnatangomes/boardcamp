import express from 'express';
import cors from 'cors';
import pg from 'pg';
import Joi from 'joi';

const { Pool } = pg;

const app = express();
app.use(cors());
app.use(express.json());

const connection = new Pool({
    user: 'bootcamp_role',
    password: 'senha_super_hiper_ultra_secreta_do_role_do_bootcamp',
    host: 'localhost',
    port: 5432,
    database: 'boardcamp',
});

app.get('/check-status', (req, res) => {
    res.send('It works');
});

app.get('/categories', async (req, res) => {
    try {
        const categories = await connection.query('SELECT * FROM categories');
        res.send(categories.rows);
    } catch {
        console.log(error.message);
        res.sendStatus(500);
    }
});

app.post('/categories', async (req, res) => {
    try {
        const { name } = req.body;
        if (typeof name !== 'string' || name === '') {
            res.sendStatus(400);
            return;
        }
        const categories = await connection.query(
            'SELECT * FROM categories WHERE name = $1',
            [name]
        );

        if (categories.rows[0]) {
            res.sendStatus(409);
        } else {
            await connection.query(
                'INSERT INTO categories (name) VALUES ($1)',
                [name]
            );
            res.sendStatus(201);
        }
    } catch {
        console.log(error.message);
        res.sendStatus(500);
    }
});

app.get('/games', async (req, res) => {
    try {
        const games = await connection.query('SELECT * FROM games');
        res.send(games.rows);
    } catch {
        console.log(error.message);
        res.sendStatus(500);
    }
});

app.post('/games', async (req, res) => {
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
            'SELECT * FROM categories WHERE id = $1',
            [categoryId]
        );

        const nameSearch = await connection.query(
            'SELECT * FROM games WHERE name = $1',
            [name]
        );

        if (validation.error) {
            res.status(400);
            res.send(validation.error.details[0].message);
            return;
        }
        if (!categorySearch.rows[0]) {
            res.status(400);
            res.send('Categoria não existente');
            return;
        }
        if (nameSearch.rows[0]) {
            res.sendStatus(409);
            return;
        }

        await connection.query(
            'INSERT INTO games (name, image, "stockTotal", "categoryId", "pricePerDayAA") VALUES ($1, $2, $3, $4, $5)',
            [name, image, stockTotal, categoryId, pricePerDay]
        );
        res.sendStatus(201);
    } catch (error) {
        console.log(error.message);
        res.sendStatus(500);
    }
});

app.listen(4000);
