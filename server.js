const express = require("express");
const app = express();
const morgan = require("morgan");
const helmet = require("helmet");
const cors = require("cors");
const mongoose = require("mongoose");

require("dotenv").config();

const cache = new Map();

const updateCache = (key, value) => {
  if (!cache.has(key)) {
    cache.set(key, value);

    setTimeout(() => {
      cache.delete(key);
    }, 60000);
  }
};

// Mongoose connection
mongoose
  .connect(`${process.env.MONGO_URL_STRING}`, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Successfully connected to DB"))
  .catch((err) => console.log(err));

// Middleware
app.use(express.json());
app.use(morgan());
app.use(helmet());
app.use(cors());

// Load Routes
app.use("/", require("./routes")(cache, updateCache));

let PORT = process.env.PORT || 5830;
app.listen(PORT, () => console.log(`Now listening on PORT: ${PORT}`));
