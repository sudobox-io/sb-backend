const router = require("express").Router();
const https = require("https");

module.exports = (cache, updateCache) => {
  router.post("/", async (req, res) => {
    if (cache.has("sb-api-status")) {
      const value = cache.get("sb-api-status");
      return res.status(200).json({ reachable: value });
    }

    const { url } = req.body;

    try {
      https
        .get(url, function (result) {
          updateCache("sb-api-status", true);
          res.status(200).json({ reachable: true });
        })
        .on("error", function (e) {
          updateCache("sb-api-status", false);
          res.status(200).json({ reachable: false });
        });
    } catch (err) {
      updateCache("sb-api-status", false);
      res.status(500).json({ reachable: false });
    }
  });

  return router;
};
