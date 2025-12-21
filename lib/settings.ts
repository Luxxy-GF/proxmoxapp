import { prisma } from "./db"

export type FeatureKey = "store_enabled" | "deploy_enabled"

const DEFAULT_FLAGS: Record<FeatureKey, boolean> = {
  store_enabled: true,
  deploy_enabled: true,
}

export async function getFeatureFlags(): Promise<Record<FeatureKey, boolean>> {
  const settings = await prisma.setting.findMany({
    where: { key: { in: Object.keys(DEFAULT_FLAGS) } },
  })

  const map = { ...DEFAULT_FLAGS }
  settings.forEach((setting) => {
    if (setting.key in map) {
      map[setting.key as FeatureKey] = setting.value === "true"
    }
  })

  return map
}

export async function setFeatureFlag(key: FeatureKey, value: boolean) {
  await prisma.setting.upsert({
    where: { key },
    update: { value: value ? "true" : "false" },
    create: { key, value: value ? "true" : "false" },
  })
}
