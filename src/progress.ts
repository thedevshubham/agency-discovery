import { logger } from "./logger.js";

export function reportProgress(
  stage: string,
  current: number,
  total: number,
  message: string,
  details: Record<string, unknown> = {},
): void {
  logger.info(
    {
      stage,
      current,
      total,
      percent: total > 0 ? Math.round((current / total) * 100) : 100,
      ...details,
    },
    message,
  );
}
