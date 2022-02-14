const mongoose = require("mongoose");

const statsSchema = new mongoose.Schema({
  container_name: String,
  stats: Array,
});

module.exports = mongoose.model("stats", statsSchema);
