import express from "express";
import cors from "cors";
import categories from "./routes/categories.js";
import games from "./routes/games.js";
import customers from "./routes/customers.js";
import rentals from "./routes/rentals.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(categories);
app.use(games);
app.use(customers);
app.use(rentals);

app.listen(4000);
