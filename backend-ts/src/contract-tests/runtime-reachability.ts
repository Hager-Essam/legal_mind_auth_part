const normalized = (path: string): string => path.replaceAll("\\", "/");

export const runtimeReachabilityScope = {
  entryPoints: ["src/index.ts"],
  productionRoots: [
    "src/app/",
    "src/config/",
    "src/controllers/",
    "src/core/",
    "src/errors/",
    "src/infrastructure/",
    "src/legal-governance/",
    "src/middlewares/",
    "src/models/",
    "src/modules/",
    "src/regex/",
    "src/routes/",
    "src/schemas/",
    "src/services/",
    "src/shared/",
    "src/types/",
    "src/utils/",
  ],
  excludedSegments: [
    "/auth-tests/",
    "/chat-tests/",
    "/contract-tests/",
    "/query-tests/",
    "/security-tests/",
    "/scripts/",
    "/migrations/",
    "/cli/",
    "/fixtures/",
    "/generated/",
  ],
} as const;

export const isInRuntimeReachabilityScope = (path: string): boolean => {
  const candidate = normalized(path);
  if (candidate.endsWith(".d.ts") || candidate.includes(".test.") || candidate.includes(".spec.")) {
    return false;
  }
  if (runtimeReachabilityScope.excludedSegments.some((segment) => candidate.includes(segment))) {
    return false;
  }
  return runtimeReachabilityScope.entryPoints.includes(candidate as "src/index.ts")
    || runtimeReachabilityScope.productionRoots.some((root) => candidate.startsWith(root));
};
