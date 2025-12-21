import { prisma } from "./db"

export type FeatureKey = "store_enabled" | "deploy_enabled"
export type StripeKey = "stripe_publishable_key" | "stripe_secret_key" | "stripe_webhook_secret"

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

export async function getSettingValue(key: string) {
  const setting = await prisma.setting.findUnique({ where: { key } })
  return setting?.value ?? null
}

export async function setSettingValue(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
}

export async function getStripeSettings() {
  const [publishable, secret, webhook] = await Promise.all([
    getSettingValue("stripe_publishable_key"),
    getSettingValue("stripe_secret_key"),
    getSettingValue("stripe_webhook_secret"),
  ])

  return {
    publishableKey: publishable,
    secretKey: secret,
    webhookSecret: webhook,
  }
}

export async function setStripeSettings(values: {
  publishableKey?: string
  secretKey?: string
  webhookSecret?: string
}) {
  const updates: Promise<any>[] = []
  if (values.publishableKey !== undefined) {
    updates.push(setSettingValue("stripe_publishable_key", values.publishableKey))
  }
  if (values.secretKey !== undefined) {
    updates.push(setSettingValue("stripe_secret_key", values.secretKey))
  }
  if (values.webhookSecret !== undefined) {
    updates.push(setSettingValue("stripe_webhook_secret", values.webhookSecret))
  }
  await Promise.all(updates)
}
