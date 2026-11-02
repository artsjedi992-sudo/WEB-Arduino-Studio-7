import express from "express";
import cors from "cors";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

const app = express();
const PORT = Number(process.env.PORT || 8080);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*").split(",").map(x => x.trim());
const ALLOWED_FQBN = new Set([
  "arduino:avr:uno",
  "arduino:avr:nano",
  "arduino:avr:mega",
  "arduino:avr:leonardo",
  "arduino:avr:micro"
]);

app.use(cors({ origin(origin, done) {
  if (!origin || ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin)) return done(null, true);
  return done(new Error("Origin is not allowed"));
}}));
app.use(express.json({ limit: "12mb" }));

function run(command, args, cwd, timeoutMs = 180000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, CI: "1" } });
    let output = "";
    let settled = false;
    const timer = setTimeout(() => { child.kill("SIGKILL"); finish(124, "\nГрешка: изтече времето за компилация."); }, timeoutMs);
    const finish = (code, extra = "") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, output: output + extra });
    };
    child.stdout.on("data", chunk => { output += chunk.toString(); });
    child.stderr.on("data", chunk => { output += chunk.toString(); });
    child.on("error", error => finish(127, "\n" + error.message));
    child.on("close", code => finish(code ?? 1));
  });
}

function safeRelativePath(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Невалиден път на файл.");
  const normalized = value.replaceAll("\\\\", "/");
  if (normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized) || normalized.split("/").some(p => !p || p === "." || p === "..")) {
    throw new Error("Небезопасен път на файл: " + value);
  }
  return normalized;
}

app.get("/health", (_req, res) => res.json({ ok: true, compiler: "arduino-cli", upload: false }));

app.post("/api/compile", async (req, res) => {
  const fqbn = String(req.body?.fqbn || "");
  const files = req.body?.files;
  if (!ALLOWED_FQBN.has(fqbn)) return res.status(400).json({ success: false, message: "Неподдържана платка/FQBN." });
  if (!Array.isArray(files) || files.length === 0 || files.length > 200) {
    return res.status(400).json({ success: false, message: "Проектът трябва да съдържа от 1 до 200 файла." });
  }

  const sourceFiles = files.filter(f => f && /\.(ino|cpp|c|h|hpp|S)$/i.test(String(f.name || f.path || "")));
  if (!sourceFiles.some(f => /\.ino$/i.test(String(f.name || f.path || "")))) {
    return res.status(400).json({ success: false, message: "В проекта липсва основен .ino файл." });
  }

  const work = await fs.mkdtemp(path.join(os.tmpdir(), "a7-build-"));
  try {
    const sketchName = "A7Sketch";
    const sketchDir = path.join(work, sketchName);
    const buildDir = path.join(work, "build");
    await fs.mkdir(sketchDir, { recursive: true });
    await fs.mkdir(buildDir, { recursive: true });

    let primaryInoWritten = false;
    const firstIno = sourceFiles.find(f => /\\.ino$/i.test(String(f.name || f.path || "")));
    const firstInoPath = safeRelativePath(String(firstIno.path || firstIno.name));
    const projectPrefix = firstInoPath.includes("/") ? firstInoPath.slice(0, firstInoPath.lastIndexOf("/") + 1) : "";
    for (const file of sourceFiles) {
      const original = safeRelativePath(String(file.path || file.name));
      const basename = path.basename(original);
      let relative = projectPrefix && original.startsWith(projectPrefix) ? original.slice(projectPrefix.length) : original;
      if (/\.ino$/i.test(relative) && !primaryInoWritten) {
        relative = sketchName + ".ino";
        primaryInoWritten = true;
      } else if (/\.ino$/i.test(relative) && basename.toLowerCase() === (sketchName + ".ino").toLowerCase()) {
        relative = "extra_" + basename;
      }
      const destination = path.resolve(sketchDir, relative);
      if (!destination.startsWith(sketchDir + path.sep)) throw new Error("Невалиден път: " + original);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, String(file.content ?? ""), "utf8");
    }

    const result = await run("arduino-cli", [
      "compile", "--fqbn", fqbn, "--warnings", "all", "--export-binaries",
      "--build-path", path.join(buildDir, "tmp"), "--output-dir", buildDir,
      "--libraries", path.join(sketchDir, "libraries"), sketchDir
    ], work);
    const artifacts = await fs.readdir(buildDir);
    const hexName = artifacts.find(name => name.toLowerCase().endsWith(".hex"));
    const elfName = artifacts.find(name => name.toLowerCase().endsWith(".elf"));
    if (result.code !== 0 || !hexName) {
      return res.status(422).json({ success: false, exitCode: result.code, log: result.output || "Компилацията е неуспешна. Не е генериран HEX файл." });
    }
    const hex = await fs.readFile(path.join(buildDir, hexName));
    const elf = elfName ? await fs.readFile(path.join(buildDir, elfName)) : null;
    return res.json({
      success: true, fqbn, log: result.output,
      hex: { name: hexName, base64: hex.toString("base64"), bytes: hex.length },
      elf: elf ? { name: elfName, base64: elf.toString("base64"), bytes: elf.length } : null
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  } finally {
    await fs.rm(work, { recursive: true, force: true }).catch(() => {});
  }
});

app.listen(PORT, "0.0.0.0", () => console.log("A7 Arduino CLI compile service listening on " + PORT));
