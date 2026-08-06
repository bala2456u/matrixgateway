export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startSandboxWatcher } = await import("./lib/watcher");
    startSandboxWatcher();
  }
}
