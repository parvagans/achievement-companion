#!/usr/bin/env node
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { basename, resolve } from "node:path";

const rootDir = process.cwd();
const feedDir = resolve(rootDir, ".local-update");
const manifestPath = resolve(feedDir, "update-manifest.json");
if (!existsSync(manifestPath)) throw new Error("Run pnpm update:test:prepare before serving the local update feed.");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const host = process.env.AC_UPDATE_HOST?.trim();
if (host === undefined || host.length === 0 || host === "0.0.0.0" || host === "::") {
  throw new Error("Set AC_UPDATE_HOST to one explicit LAN address printed by update:test:prepare. Wildcard binding is intentionally disabled.");
}
const port = Number.parseInt(process.env.AC_UPDATE_PORT ?? "8765", 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("AC_UPDATE_PORT must be a valid TCP port.");

const allowedFiles = new Map([
  ["/update-manifest.json", manifestPath],
  [`/${basename(manifest.downloadUrl)}`, resolve(feedDir, basename(manifest.downloadUrl))],
]);

const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? "/", `http://${request.headers.host ?? host}`).pathname;
  const path = allowedFiles.get(pathname);
  if (path === undefined || !existsSync(path) || !statSync(path).isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found\n");
    return;
  }
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Length": statSync(path).size,
    "Content-Type": path.endsWith(".json") ? "application/json" : "application/zip",
  });
  createReadStream(path).pipe(response);
});

server.listen(port, host, () => {
  console.log("Local Achievement Companion update feed\n");
  console.log(`Manifest:\nhttp://${host}:${port}/update-manifest.json`);
  console.log(`\nVersion:\n${manifest.version}`);
  console.log(`\nArtifact:\n${basename(manifest.downloadUrl)}`);
  console.log(`\nSHA-256:\n${manifest.sha256}`);
});
