const router = require("express").Router();
const StatsDB = require("../models/Stats");

const resErr = async (res, error, message) => {
  res.json({ error, message });
};

router.get("/", async (req, res) => {
  try {
    const allStats = await StatsDB.find({});
    res.json({ error: false, results: allStats });
  } catch (err) {
    res.json({ error: true });
  }
});

router.get("/:container", async (req, res) => {
  try {
    const containerStats = await StatsDB.findOne({ container_name: req.params.container });
    res.json({ error: false, results: containerStats });
  } catch (err) {
    res.json({ error: true });
  }
});

router.post("/", async (req, res) => {
  try {
    const { container_name, stats } = req?.body;
    if (!container_name) return resErr(res, false, "Please provide a container name");

    const containerStats = await StatsDB.findOne({ container_name });
    if (!containerStats) {
      const newContainerStats = StatsDB({
        container_name: container_name,
        stats: [...stats],
      });
      newContainerStats.save();
      return res.json({ error: false, message: "Container Stats have been created / added" });
    }

    containerStats.stats = [...stats];
    containerStats.save();
    return res.json({ error: false, message: "Container Stats have been created / added" });
  } catch (err) {
    res.json({ error: true, message: "There was a message when trying to update / add a container stat" });
  }
});

module.exports = router;
