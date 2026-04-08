const { execFile, spawn } = require("child_process");
const path = require("path");

let cachedPath = null;

function execFileAsync(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(new Error([error.message, stderr].filter(Boolean).join("\n").trim() || "command failed"));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function resolveCodexPath() {
  if (cachedPath) {
    return cachedPath;
  }

  const candidates = [];

  if (process.platform === "win32") {
    candidates.push(async () => {
      const { stdout } = await execFileAsync("powershell", [
        "-NoProfile",
        "-Command",
        "(Get-Command codex -ErrorAction Stop).Source",
      ]);
      return stdout.trim();
    });

    candidates.push(async () => {
      const { stdout } = await execFileAsync("where", ["codex"]);
      return stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean);
    });
  } else {
    candidates.push(async () => {
      const { stdout } = await execFileAsync("which", ["codex"]);
      return stdout.trim();
    });
  }

  candidates.push(async () => "codex");

  for (const getCandidate of candidates) {
    try {
      const candidate = await getCandidate();
      if (candidate) {
        cachedPath = candidate;
        return candidate;
      }
    } catch {
      // Continue to the next candidate.
    }
  }

  throw new Error("Unable to resolve codex executable path");
}

function getCommandSpec(codexPath, args) {
  if (process.platform === "win32") {
    const ext = path.extname(codexPath).toLowerCase();

    if (ext === ".ps1") {
      return {
        command: "powershell",
        args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", codexPath, ...args],
      };
    }

    if (ext === ".cmd" || ext === ".bat") {
      return {
        command: "cmd",
        args: ["/c", codexPath, ...args],
      };
    }
  }

  return {
    command: codexPath,
    args,
  };
}

async function runCodex(args, options = {}) {
  const codexPath = await resolveCodexPath();
  const commandSpec = getCommandSpec(codexPath, args);
  return execFileAsync(commandSpec.command, commandSpec.args, options);
}

async function runCodexWithInput(args, input, options = {}) {
  const codexPath = await resolveCodexPath();
  const commandSpec = getCommandSpec(codexPath, args);

  return new Promise((resolve, reject) => {
    const child = spawn(commandSpec.command, commandSpec.args, {
      ...options,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let finished = false;
    let timeoutId = null;

    const cleanup = () => {
      finished = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };

    if (options.timeout) {
      timeoutId = setTimeout(() => {
        if (finished) return;
        child.kill();
        cleanup();
        reject(new Error(`Codex timed out after ${options.timeout}ms`));
      }, options.timeout);
    }

    child.stdout.setEncoding(options.encoding || "utf8");
    child.stderr.setEncoding(options.encoding || "utf8");

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      if (finished) return;
      cleanup();
      reject(new Error([error.message, stderr].filter(Boolean).join("\n").trim() || "command failed"));
    });

    child.on("close", (code) => {
      if (finished) return;
      cleanup();
      if (code !== 0) {
        reject(
          new Error(
            [`Codex exited with code ${code}`, stderr, stdout].filter(Boolean).join("\n").trim() || "command failed",
          ),
        );
        return;
      }
      resolve({ stdout, stderr });
    });

    child.stdin.write(input, options.encoding || "utf8");
    child.stdin.end();
  });
}

module.exports = {
  execFileAsync,
  resolveCodexPath,
  runCodex,
  runCodexWithInput,
};
