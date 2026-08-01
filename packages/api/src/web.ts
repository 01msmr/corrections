import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadEnv } from "./env.js";

const env = loadEnv();

// Passenger reicht den Port über PORT herein und fängt listen() ab.
serve({ fetch: createApp().fetch, port: env.PORT }, (info) => {
  console.log(JSON.stringify({ level: "info", msg: "web gestartet", port: info.port }));
});
