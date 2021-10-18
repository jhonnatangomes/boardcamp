import express from "express";
import querySearch from "../querySearch.js";
import connection from "../connection.js";
import Joi from "joi";
import dayjs from "dayjs";
const router = express.Router();

router.get("/customers", async (req, res) => {
    try {
        const { cpf, offset, limit } = req.query;
        let queryText = `
            SELECT customers.*, COUNT(rentals.id) AS "rentalsCount" 
            FROM customers LEFT JOIN rentals ON customers.id = rentals."customerId"`;
        let customers;
        const queryParams = [];
        if (cpf) {
            queryParams.push(cpf + "%");
            queryText += ` WHERE cpf ILIKE $${queryParams.length}`;
        }

        queryText += ` GROUP BY customers.id ORDER BY customers.id`;
        queryText = querySearch(offset, limit, queryText, queryParams);
        customers = await connection.query(queryText, queryParams);
        customers.rows.forEach((customer) => {
            customer.birthday = dayjs(customer.birthday).format("YYYY-MM-DD");
            customer.rentalsCount = Number(customer.rentalsCount);
        });
        res.send(customers.rows);
    } catch (error) {
        console.log(error.message);
        res.status(500).send(error.message);
    }
});

router.get("/customers/:id", async (req, res) => {
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

router.post("/customers", async (req, res) => {
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

router.put("/customers/:id", async (req, res) => {
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

export default router;
