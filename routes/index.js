const mainRouter = require("express").Router();

module.exports = (cache, updateCache) => {
  mainRouter.use("/apps", require("./apps"));
  mainRouter.use("/settings", require("./settings"));
  mainRouter.use("/stats", require("./stats"));
  mainRouter.use("/setup", require("./setup"));
  mainRouter.use("/status", require("./status")(cache, updateCache));

  return mainRouter;
};
