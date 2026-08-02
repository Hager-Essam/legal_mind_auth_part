export const isDryRun = (): boolean =>
  process.argv.includes("--dry-run") || process.argv.includes("-n");

export const printSummary = (
  label: string,
  summary: Record<string, number | string | boolean>,
): void => {
  console.log(`${label}: ${JSON.stringify(summary)}`);
};
