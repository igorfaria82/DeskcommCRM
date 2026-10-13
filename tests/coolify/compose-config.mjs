// Verifica a configuração real do Compose sem iniciar serviços nem acessar volumes.
// Uso: node tests/coolify/compose-config.mjs [compose anterior]
// DOCKER_COMPOSE_BIN aponta para um Compose standalone; por padrão, usa docker compose.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "crm-compose-check-"));
const current = path.join(root, "docker-compose.prod.yml");
const previous = process.argv[2] && path.resolve(process.argv[2]);
const key = "chave-apenas-para-teste-local";
const hash = createHash("sha512").update(key).digest("hex");
const executable = process.env.DOCKER_COMPOSE_BIN || "docker";
const prefix = process.env.DOCKER_COMPOSE_BIN ? [] : ["compose"];
const cleanEnvironment = { ...process.env };
for (const name of ["WAHA_IMAGE", "CRM_WAHA_API_KEY", "CRM_WAHA_API_KEY_SHA512", "COMPOSE_PROFILES"]) {
  delete cleanEnvironment[name];
}

function configuration(file, variables = {}, allProfiles = true) {
  const values = { WAHA_API_KEY: key, WAHA_API_KEY_SHA512: hash, ...variables };
  fs.writeFileSync(path.join(temporary, ".env"), Object.entries(values).map(([name, value]) => `${name}=${value}`).join("\n"));
  const args = [...prefix, "--project-directory", temporary, "--env-file", path.join(temporary, ".env"), "-f", file];
  if (allProfiles) args.push("--profile", "*");
  args.push("config", "--format", "json");
  return JSON.parse(execFileSync(executable, args, {
    cwd: root, env: cleanEnvironment, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }));
}

try {
  const resolved = configuration(current);
  assert.equal(resolved.services.waha.image, "devlikeapro/waha:noweb-arm-2026.7.2");
  assert.equal(resolved.services.waha.environment.WHATSAPP_DEFAULT_ENGINE, "NOWEB");
  assert.equal(resolved.services.waha.environment.WHATSAPP_HOOK_URL, "http://app:3000/api/v1/webhooks/waha");
  for (const aliases of [{}, { CRM_WAHA_API_KEY: "", CRM_WAHA_API_KEY_SHA512: "" }, {
    CRM_WAHA_API_KEY: "outra-chave-de-teste", CRM_WAHA_API_KEY_SHA512: createHash("sha512").update("outra-chave-de-teste").digest("hex"),
  }]) {
    const config = configuration(current, aliases);
    const expectedKey = aliases.CRM_WAHA_API_KEY || key;
    const expectedHash = aliases.CRM_WAHA_API_KEY_SHA512 || hash;
    for (const service of ["app", "worker", "voice-agent"]) {
      assert.equal(config.services[service].environment.WAHA_API_KEY, expectedKey);
      const ca = config.services[service].volumes.find((volume) => volume.target === "/etc/deskcomm/ca/supabase-ca.crt");
      assert.equal(ca.read_only, true);
      assert.equal(ca.bind.create_host_path, false);
    }
    assert.equal(config.services.waha.environment.WAHA_API_KEY, `sha512:${expectedHash}`);
  }
  const override = configuration(current, { WAHA_IMAGE: "devlikeapro/waha:latest-2026.7.2" });
  assert.equal(override.services.waha.image, "devlikeapro/waha:latest-2026.7.2");
  const defaults = configuration(current, {}, false);
  assert.equal(defaults.services.caddy, undefined);
  assert.equal(defaults.services.wacalls, undefined);
  assert.equal(defaults.services["voice-agent"], undefined);
  assert.equal(resolved.services.app.environment.EVENT_LOG_WORKER_DRAINS, "true");
  if (previous) {
    const original = configuration(previous);
    assert.deepEqual(Object.keys(resolved.services).sort(), Object.keys(original.services).sort());
    assert.deepEqual(resolved.volumes, original.volumes);
    assert.deepEqual(resolved.networks, original.networks);
    for (const [name, service] of Object.entries(original.services)) {
      for (const [field, value] of Object.entries(service)) {
        if (["image", "environment", "volumes", "profiles"].includes(field)) continue;
        assert.deepEqual(resolved.services[name][field], value, `${name}.${field}`);
      }
      for (const [variable, value] of Object.entries(service.environment || {})) {
        if (variable === "NODE_EXTRA_CA_CERTS") continue;
        assert.deepEqual(resolved.services[name].environment[variable], value, `${name}.${variable}`);
      }
      for (const volume of service.volumes || []) {
        assert.ok(resolved.services[name].volumes.some((candidate) => JSON.stringify(candidate) === JSON.stringify(volume)), `${name}: montagem existente preservada`);
      }
      if (name !== "waha") assert.equal(resolved.services[name].image, service.image);
    }
  }
  process.stdout.write("PASS: ARM64, engine, webhook interno, aliases, CA somente-leitura, profiles e preservação da configuração.\n");
} finally {
  // Pasta criada exclusivamente por este teste, fora de qualquer instalação real.
  fs.rmSync(temporary, { recursive: true, force: true });
}
