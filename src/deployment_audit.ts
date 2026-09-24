import { z } from "zod";

export const deploymentHitSchema = z.object({
  deployment: z.string().min(1),
  observedKeyVersion: z.string().min(1),
  observedAt: z.string().datetime()
});

export type DeploymentHit = z.infer<typeof deploymentHitSchema>;

export function deploymentsStillOnOldKey(
  hits: DeploymentHit[],
  oldKeyVersion: string
): string[] {
  const latestByDeployment = new Map<string, DeploymentHit>();
  for (const hit of hits) {
    const previous = latestByDeployment.get(hit.deployment);
    if (!previous || hit.observedAt > previous.observedAt) {
      latestByDeployment.set(hit.deployment, hit);
    }
  }

  return [...latestByDeployment.values()]
    .filter((hit) => hit.observedKeyVersion === oldKeyVersion)
    .map((hit) => hit.deployment)
    .sort();
}
