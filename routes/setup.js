const router = require("express").Router();
const fs = require("fs");
const { promisify } = require("util");
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const shell = require("shelljs");
const { parse_host } = require("tld-extract");
const ldap = require("ldapjs");

const argon2 = require("argon2");
const yaml = require("yaml");
const { join } = require("path");
const compose = require("docker-compose");
const Dockerode = require("dockerode");
const { interpolation } = require("interpolate-json");

const docker = new Dockerode({ socketPath: "/var/run/docker.sock" });
const SettingdDB = require("../models/Settings");

router.post("/", async (req, res) => {
  const { domain, cf_email, cf_api_key, storageType, sso, dashboard } = req.body;

  const apps = [];

  // if (storageType.toLowerCase() === "cloud") ["sb-uploader", "sb-mount"].forEach((item) => apps.push(item));
  if (cf_email !== "" && cf_api_key !== "") apps.push("sb-companion");
  if (dashboard) apps.push("sb-dashboard");
  domain !== "" && sso ? apps.push("traefik_authelia") : storageType.toLowerCase() === "cloud" && domain !== "" && apps.push("traefik");

  res.json({ results: apps });
});

router.post("/:name", async (req, res) => {
  const name = req.params.name;
  const { domain, cftoken, redispassword, mysqlpassword, storageencryptionkey, secretsession, jwtSecret, email, username, password, sso } = req.body;

  switch (name) {
    case "traefik":
      try {
        await installDependents("traefik", "traefik.yml", {
          domain,
          email,
        });
        await installDependents("traefik", "fileConfig.yml", {
          domain,
        });
        await installApp("traefik-compose.yml", "traefik", {
          domain,
          cftoken,
        });
        res.json({ error: false });
      } catch (err) {
        res.json({ error: true });
      }
      break;
    case "traefik_authelia":
      try {
        await installDependents("traefik", "traefik.yml", {
          domain,
          email,
        });
        await installDependents("traefik", "fileConfig.yml", {
          domain,
        });

        const extractedValues = parse_host(domain);

        let basedomain = extractedValues.domain.split(".")[0];
        let tld = extractedValues.tld;
        let domaintld =
          tld.split(".").length > 1
            ? tld
                .split(".")
                .map((value) => `DC=${value}`)
                .join(",")
            : `DC=${tld}`;

        await installDependents("authelia", "configuration.yml", {
          domain,
          redispassword,
          storageencryptionkey,
          mysqlpassword,
          secretsession,
          jwtSecret,
          basedomain,
          domaintld,
          username,
          password,
        });

        await installApp("ldap-compose.yml", "openldap", {
          domain,
          username,
          password,
        });

        // const hashedPassword = await argon2.hash(password, {
        //   type: argon2.argon2id,
        //   memoryCost: 1024,
        //   hashLength: 32,
        //   parallelism: 8,
        //   saltLength: 16,
        //   timeCost: 3,
        // });

        // await installDependents("authelia", "users_database.yml", {
        //   username,
        //   hashedPassword,
        //   email,
        // });

        await installApp("traefik-compose.yml", "traefik", {
          domain,
          cftoken,
        });

        await installApp("authelia-compose.yml", "authelia", {
          redispassword,
          domain,
          mysqlpassword,
        });

        ldapbind(username, password, basedomain, domaintld, email);

        res.json({ error: false });
      } catch (err) {
        console.log(err);
        res.json({ error: true });
      }
      break;
    case "sb-dashboard":
      // await installApp("sb-dashboard-compose.yml", "sb-companion", {
      //   domain,
      //   protection: sso == true ? "auth@file" : "",
      // });
      res.json({ error: false });
      break;
    case "sb-companion":
      await installApp("sb-companion-compose.yml", "sb-companion", { domain });
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

const installApp = async (name, dir, interpolationObj) => {
  // Installs new core app, and injects user defined variables
  // Reads from file
  // Converts file to YAML
  // Injects user defined variables
  // Creates new folder for the app
  // Installs app

  try {
    const file = await readFile(join(__dirname, `../configs/${name}`), "utf8");
    const convertedFile = await yaml.parse(file);
    const interpolatedFile = interpolation.expand(convertedFile, interpolationObj);

    shell.mkdir("-p", `/compose/${dir}`);
    await writeFile(`${join("/compose", dir, "/docker-compose.yml")}`, yaml.stringify(interpolatedFile));
    const installedApp = await compose.upAll({ cwd: join("/compose", dir) });
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
  shell.mkdir("-p", `/appdata/${dir}`);
  await writeFile(`${join("/appdata/", dir, name)}`, yaml.stringify(interpolatedFile));
};

const ldapbind = (username, password, basedomain, domaintld, email) => {
  let loop = true;
  do {
    try {
      const client = ldap.createClient({
        url: ["ldap://openldap"],
      });

      client.on("error", (err) => {
        console.log("There was an error creating a client object with openldap");
      });

      client.bind(`cn=admin,dc=${basedomain},${domaintld}`, password, (err) => {
        if (err) {
          console.log({ err });
          console.log("There was an error authenticating with the openldap server");
          await sleep(10000);
        } else {
          loop = false;
          addLdapUser(username, password, basedomain, domaintld, email);
        }
      });
    } catch (err) {
      console.log("Waiting for openldap server to start...");
      console.log("Retrying in 10 seconds");
      await sleep(10000);
    }
  } while (loop);
};

const addLdapUser = (username, password, basedomain, domaintld, email) => {
  const entry = {
    sn: "sudobox",
    userPassword: password,
    mail: email,
    objectclass: "inetOrgPerson",
  };

  client.add(`cn=${username},dc=${basedomain},${domaintld}`, entry, (err) => {
    if (err) {
      console.log("user error: " + err);
    } else {
      console.log("Created user successfully!");
    }
  });
};

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

module.exports = router;
