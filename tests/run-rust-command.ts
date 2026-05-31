const mode = Bun.argv[2];

if (mode !== "check" && mode !== "test") {
  console.error("Usage: bun tests/run-rust-command.ts <check|test>");
  process.exit(2);
}

const commandArgs =
  process.platform === "win32"
    ? [mode, "--workspace"]
    : [mode, "-p", "file-explorer-core"];

if (process.platform !== "win32") {
  console.warn(
    `Running cargo ${commandArgs.join(
      " "
    )}; Windows-only crates require a Windows host for full verification.`
  );
}

const cargo = Bun.spawn(["cargo", ...commandArgs], {
  stdout: "inherit",
  stderr: "inherit",
  env: {
    ...Bun.env,
    CARGO_INCREMENTAL: "0"
  }
});

process.exit(await cargo.exited);

export {};
