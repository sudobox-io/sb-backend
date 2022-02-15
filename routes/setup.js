const router = require("express").Router();
const fs = require("fs");
const { promisify } = require("util");
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

const argon2 = require("argon2");
const yaml = require("yaml");
const { join } = require("path");
const SettingdDB = require("../models/Settings");
const Dockerode = require("dockerode");
const docker = new Dockerode({ socketPath: "/var/run/docker.sock" });
const compose = require("docker-compose");
const { interpolation } = require("interpolate-json");

router.post("/", async (req, res) => {
  const { domain, cf_email, cf_api_key, storageType, sso, dashboard } = req.body;

  const apps = [];

  domain !== "" && sso ? apps.push("traefik_authelia") : storageType === "cloud" && domain !== "" && apps.push("traefik");
  if (storageType.toLowerCase() === "cloud") ["sb-uploader", "sb-mount"].forEach((item) => apps.push(item));
  if (cf_email !== "" && cf_api_key !== "") apps.push("sb-companion");
  if (dashboard) apps.push("sb-dashboard");

  res.json({ results: apps });
});

router.post("/:name", async (req, res) => {
  const name = req.params.name;

  console.log({ name });

  switch (name) {
    case "traefik":
      // await installApp("traefik-compose.yml");
      res.json({ error: false });
      break;
    case "traefik_authelia":
      try {
        const { domain, cftoken, redispassword, mysqlpassword, storageencryptionkey, secretsession, jwtSecret, email, username, password } = req.body;

        await installDependents("traefik", "traefik.yml", {
          domain,
          email,
        });
        await installDependents("traefik", "fileConfig.yml", {
          domain,
        });
        await installDependents("authelia", "configuration.yml", {
          domain,
          redispassword,
          storageencryptionkey,
          mysqlpassword,
          secretsession,
          jwtSecret,
        });

        const hashedPassword = await argon2.hash(password, {
          type: argon2.argon2id,
          memoryCost: 1024,
          hashLength: 32,
          parallelism: 8,
          saltLength: 16,
          timeCost: 3,
        });

        await installDependents("authelia", "users_database.yml", {
          username,
          hashedPassword,
          email,
        });

        await installApp("traefik-compose.yml", {
          domain,
          cftoken,
        });

        await installApp("authelia-compose.yml", {
          redispassword,
          domain,
          mysqlpassword,
        });

        res.json({ error: false });
      } catch (err) {
        console.log(err);
        res.json({ error: true });
      }
      break;
    case "sb-dashboard":
      // await installApp("sb-dashboard-compose.yml");
      res.json({ error: false });
      break;
    case "sb-companion":
      await installApp("sb-companion-compose.yml");
      res.json({ error: false });
      break;
    case "sb-uploader":
      // await installApp("sb-uploader-compose.yml");
      res.json({ error: false });
      break;
    case "sb-mount":
      // await installApp("sb-mount-compose.yml");
      res.json({ error: false });
      break;
  }
});

const installApp = async (name, interpolationObj) => {
  try {
    const file = await readFile(join(__dirname, `../configs/${name}`), "utf8");
    const convertedFile = await yaml.parse(file);
    const interpolatedFile = interpolation.expand(convertedFile, interpolationObj);

    shell.mkdir("-p", `/compose/${name}`);
    await writeFile(`${join("/compose", name, "/docker-compose.yml")}`, yaml.stringify(interpolatedFile));
    const installedApp = await compose.upAll({ cwd: join("/compose", name) });
    console.log(installedApp);
    return { error: false, installed: true, message: `successfully installed` };
  } catch (err) {
    console.log(err);
    return { error: true, installed: false, message: `There was an errror when trying to install` };
  }
};

const installDependents = async (dir, name, interpolationObj) => {
  const file = await readFile(join(__dirname, `../configs/${dir}/${name}`), "utf8");
  const convertedFile = await yaml.parse(file);
  const interpolatedFile = interpolation.expand(convertedFile, interpolationObj);
  await writeFile(`${join("/appdata/", dir, name)}`, yaml.stringify(interpolatedFile));
};

module.exports = router;
