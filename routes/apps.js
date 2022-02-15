const router = require("express").Router();
const shell = require("shelljs");
const fs = require("fs");
const { join } = require("path");
const { promisify } = require("util");
const writeFile = promisify(fs.writeFile);
const Dockerode = require("dockerode");
const axios = require("axios");
const SettingsDB = require("../models/Settings");
const yaml = require("yaml");
const compose = require("docker-compose");
const { interpolation } = require("interpolate-json");

// Initialise Docker
const docker = new Dockerode({ socketPath: "/var/run/docker.sock" });

router.get("/", async (req, res) => {
  docker
    .listContainers({ all: true })
    .then((containers) => res.json({ error: false, results: containers }))
    .catch((err) => {
      console.log(err);
      res.json({ error: true, message: "There was an error retreiving a list of " });
    });
});

router.get("/:container_id", async (req, res) => {
  docker
    .getContainer(req.params.container_id)
    .then((container) => res.json({ error: false, results: container }))
    .catch((err) => res.json({ error: true }));
});

router.post("/", async (req, res) => {
  try {
    const { id } = req?.body;
    const composeConfigFile = await axios({
      method: "get",
      url: `https://api.sudobox.io/v1/apps/${id}`,
      headers: { "Content-Type": "application/json" },
    });

    const domain = await SettingsDB.findOne({ name: "domain" });
    const authelia = await SettingsDB.findOne({ name: "authelia" });

    console.log(domain);

    const config = composeConfigFile.data.results.config;

    const tempConfig = {};

    for (const [key, value] of Object.entries(config.services)) {
      let tempService = { ...value };

      const replaceValues = {
        name: tempService.container_name,
        domain: `${tempService.container_name.toLowerCase()}.${domain.value}`,
        container_port: tempService.ports[0].split(":")[1],
      };

      if (authelia.value == "true") replaceValues["protection"] = "auth@file";

      let newService = interpolation.expand(tempService, replaceValues);
      tempConfig[tempService.container_name] = { ...newService };
    }

    config.services = tempConfig;

    shell.mkdir("-p", `/compose/${composeConfigFile.data.results.name}`);
    await writeFile(`/compose/${composeConfigFile.data.results.name}/docker-compose.yml`, yaml.stringify(config));

    compose.upAll({ cwd: `/compose/${composeConfigFile.data.results.name}` }).then(
      () => res.json({ error: false, installed: true, message: `successfully installed` }),
      (err) => {
        console.log("Something went wrong:", err);
        res.json({ error: true, installed: false, message: `There was an errror when trying to install` });
      }
    );
  } catch (err) {
    console.log(err);
    res.json({ error: true, installed: false, message: `There was an error when trying to install` });
  }
});

router.post("/action", async (req, res) => {
  try {
    const { action, id } = req?.body;
    if (!action) return req.json({ error: false, message: "Please include the action you wish to perform" });
    if (!id) return req.json({ error: false, message: "Please provide a valid container ID" });

    const container = await docker.getContainer(id);
    let messageVar = "";

    switch (action) {
      case "start":
        await container.start();
        messageVar = "started";
        break;
      case "stop":
        await container.stop();
        messageVar = "stopped";
        break;
      case "restart":
        await container.restart();
        messageVar = "restarted";
        break;
      case "kill":
        await container.kill();
        messageVar = "killed";
        break;
    }

    res.json({ error: false, message: `Container: ${id} has successfully been ${messageVar}` });
  } catch (err) {
    res.json({ error: true, message: "There was an error when trying to perform an action" });
  }
});

router.delete("/", async (req, res) => {
  try {
    const { id } = req?.body;
    if (!id) return req.json({ error: false, message: "Please provide a valid container ID" });
    await docker.getContainer(id).remove({ force: true });
    res.json({ error: false, deleted: true });
  } catch (err) {
    console.log({ err });
    res.json({ error: true, deleted: false });
  }
});

module.exports = router;
