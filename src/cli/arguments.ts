export type RequiredLimit = number | "all";

export function parseRequiredLimit(
  value: string | undefined,
  usage: string,
): RequiredLimit {
  if (!value) {
    throw new Error(
      `A count is required. Usage: ${usage}\nUse a positive number or --all.`,
    );
  }

  if (value === "--all") return "all";

  if (!/^\d+$/.test(value) || Number(value) < 1) {
    throw new Error(`Invalid count '${value}'. Use a positive number or --all.`);
  }

  return Number(value);
}
