export function genId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

export function syncMeta(deviceId: string): { updatedAt: number; updatedBy: string } {
  return { updatedAt: Date.now(), updatedBy: deviceId };
}