const mongoose = require("mongoose");

const appsInstallingSchema = new mongoose.Schema({
  apps: Array,
});

module.exports = mongoose.model("apps_installing", appsInstallingSchema);
