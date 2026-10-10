#!/usr/bin/env node
/**
 * Build Wandora-owned OpenHands from two checked-out, review-pinned repositories.
 *
 * Usage:
 *   node scripts/wandora-build.mjs [path-to-OARANHA/software-agent-sdk]
 *
 * This script deliberately has NO git pull, push, package publishing, or VPS
 * deployment. It only builds local Docker images with Wandora GHCR names.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = JSON.parse(readFileSync(join(root, "config/wandora-image.json"), "utf8"));
const defaults = JSON.parse(readFileSync(join(root, "config/defaults.json"), "utf8"));
const sdkDir = resolve(process.argv[2] ?? join(root, "..", "software-agent-sdk"));

if (process.argv.length > 3 || process.argv[2] === "--help") {
  console.log("Usage: node scripts/wandora-build.mjs [SDK_CHECKOUT_DIRECTORY]");
  process.exit(process.argv[2] === "--help" ? 0 : 2);
}

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

function read(command, args, cwd) {
  return execFileSync(command, args, { cwd, encoding: "utf8" }).trim();
}

function requireCleanCheckout(dir, label) {
  if (!existsSync(join(dir, ".git"))) {
    throw new Error(label + ": expected an ordinary Git checkout at " + dir);
  }
  if (read("git", ["status", "--porcelain"], dir)) {
    throw new Error(label + ": uncommitted/untracked files detected; commit or clean them before building.");
  }
}

try {
  requireCleanCheckout(root, "Wandora Canvas");
  requireCleanCheckout(sdkDir, "Wandora SDK");

  const sdkSha = read("git", ["rev-parse", "HEAD"], sdkDir);
  const canvasSha = read("git", ["rev-parse", "HEAD"], root);
  if (!/^[0-9a-f]{40}$/.test(source.sdkCommit) || sdkSha !== source.sdkCommit) {
    throw new Error("SDK HEAD does not match config/wandora-image.json. Never build from an unreviewed revision.");
  }
  if (source.sdkRepository !== "OARANHA/software-agent-sdk") {
    throw new Error("Unapproved SDK repository in image configuration.");
  }
  if (source.sdkImage !== "ghcr.io/oaranha/wandora-agent-server" ||
      source.canvasImage !== "ghcr.io/oaranha/openhands-wandora" ||
      source.sdkDockerTarget !== "source") {
    throw new Error("Unapproved image destination or SDK target.");
  }

  const sdkPyproject = readFileSync(join(sdkDir, "openhands-agent-server", "pyproject.toml"), "utf8");
  const sdkVersion = sdkPyproject.match(/^version = "([^"]+)"$/m)?.[1];
  if (sdkVersion !== defaults.versions.agentServer) {
    throw new Error("Canvas expects Agent Server " + defaults.versions.agentServer +
      ", but owned SDK declares " + sdkVersion + ". Align versions before building.");
  }

  const sdkTag = source.sdkImage + ":sdk-" + sdkSha.slice(0, 12) + "-source";
  const canvasTag = source.canvasImage + ":canvas-" + canvasSha.slice(0, 12) +
    "-sdk-" + sdkSha.slice(0, 12);

  console.log("Wandora SDK source: " + sdkDir + " @ " + sdkSha);
  console.log("Wandora Canvas:     " + root + " @ " + canvasSha);
  console.log("Local SDK image:    " + sdkTag);
  console.log("Local Canvas image: " + canvasTag);
  console.log("No push, upstream sync or VPS deployment is performed.");

  const dockerfileSdk = join(sdkDir, "openhands-agent-server", "openhands",
    "agent_server", "docker", "Dockerfile");
  run("docker", [
    "build", "-f", dockerfileSdk, "--target", "source",
    "--build-arg", "BASE_IMAGE=python-node-runtime",
    "--build-arg", "OPENHANDS_BUILD_GIT_SHA=" + sdkSha,
    "--build-arg", "OPENHANDS_BUILD_GIT_REF=wandora-pinned",
    "-t", sdkTag, sdkDir,
  ], root);

  run("docker", [
    "build", "-f", "docker/Dockerfile",
    "--build-arg", "AGENT_SERVER_IMAGE=" + sdkTag,
    "--build-arg", "AGENT_SERVER_VERSION=" + defaults.versions.agentServer,
    "--build-arg", "AUTOMATION_VERSION=" + defaults.versions.automation,
    "--build-arg", "AGENT_CANVAS_VERSION=" + defaults.versions.agentCanvas,
    "--build-arg", "OPENHANDS_BUILD_GIT_SHA=" + canvasSha,
    "--build-arg", "OPENHANDS_BUILD_GIT_REF=wandora-pinned",
    "--build-arg", "VITE_BASE_PATH=" + defaults.paths.canvasBasePath,
    "--build-arg", "AGENT_SERVER_SDK_GIT_REF=",
    "-t", canvasTag, ".",
  ], root);

  console.log("\nImages built LOCALLY. Validate both components before any optional GHCR publication.");
  console.log("Final image: " + canvasTag);
} catch (error) {
  console.error("Wandora image build stopped: " + error.message);
  process.exit(1);
}
