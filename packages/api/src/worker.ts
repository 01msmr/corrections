import { loadEnv } from "./env.js";

/**
 * Wird vom Plesk-Cronjob aufgerufen, läuft kurz und endet.
 * IMAP-Poll kommt in P3, Artikel-Checks in P5 hinzu.
 */
function main(): void {
  loadEnv();
  console.log(JSON.stringify({ level: "info", msg: "worker gelaufen", tasks: [] }));
}

main();
