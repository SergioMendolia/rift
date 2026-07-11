import { Hono } from "hono";
import { env } from "../env";

export const themeRoutes = new Hono();

themeRoutes.get("/custom.css", async (c) => {
  try {
    const file = Bun.file(`${env.dataDir}/themes/custom.css`);
    const exists = await file.exists();
    if (!exists) {
      return new Response("/* No custom theme found */", {
        headers: { "Content-Type": "text/css" },
      });
    }
    return new Response(file, {
      headers: { "Content-Type": "text/css" },
    });
  } catch {
    return new Response("/* Error loading custom theme */", {
      headers: { "Content-Type": "text/css" },
    });
  }
});