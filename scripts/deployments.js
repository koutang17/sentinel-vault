const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "deployments.local.json");

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return {}; }
}

function save(patch) {
  const d = { ...load(), ...patch };
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
  return d;
}

module.exports = { load, save, FILE };
