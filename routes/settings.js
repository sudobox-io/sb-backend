const router = require("express").Router();
const SettingsDB = require("../models/Settings");

router.get("/", async (req, res) => {
  try {
    const settings = await SettingsDB.find({});
    res.json({ error: false, results: settings });
  } catch (err) {
    console.log(err);
    res.json({ error: true });
  }
});

router.post("/", async (req, res) => {
  try {
    const { type, options } = req?.body;
    if (!type) return res.json({ error: false, message: "Please include a valid setting to change" });
    if (!options) return res.json({ error: false, message: "Please include valid options" });

    const setting = await SettingsDB.findOne({ name: type });
    if (!setting) {
      const newSetting = SettingsDB({
        name: type,
        options: [...options],
      });
      newSetting.save();
      return res.json({ error: false });
    }
    setting.options = [...options];
    res.json({ error: false, message: "Successfully saved options" });
  } catch (err) {
    res.json({ error: true });
  }
});

module.exports = router;
