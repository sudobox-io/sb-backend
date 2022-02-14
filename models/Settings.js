const mongoose = require("mongoose");

const SettingsSchema = new mongoose.Schema({
  name: String,
  value: String || Boolean,
});

module.exports = mongoose.model("settings", SettingsSchema);
