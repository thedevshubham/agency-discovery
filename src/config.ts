import { z } from "zod";

const configSchema = z.object({
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
});

export const config = configSchema.parse(process.env);
