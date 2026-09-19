import { db } from '../db/db';
import type { HouseholdEnvelope, TrackTemplateEnvelope } from '../types';

export async function buildHouseholdEnvelope(): Promise<HouseholdEnvelope> {
  const [hd, deviceId, trackingMethods, tracks, categories, items, ops] = await Promise.all([
    db.household.toArray(),
    db.meta.get('deviceId'),
    db.trackingMethods.toArray(),
    db.tracks.toArray(),
    db.categories.toArray(),
    db.items.toArray(),
    db.ops.toArray(),
  ]);
  if (!hd[0]) throw new Error('Дом не создан');
  return {
    format: 'household-backup',
    version: 1,
    exportedAt: Date.now(),
    deviceId: String(deviceId?.value ?? 'unknown'),
    deviceLabel: hd[0].deviceLabel,
    household: hd[0],
    trackingMethods, tracks, categories, items, ops,
  };
}

export async function buildTrackTemplate(trackId: string): Promise<TrackTemplateEnvelope> {
  const track = await db.tracks.get(trackId);
  if (!track) throw new Error('Трек не найден');
  const cats = await db.categories.where('trackId').equals(trackId).toArray();
  const activeCats = cats.filter(c => c.deletedAt === null);
  const items = (await db.items.toArray()).filter(
    i => activeCats.some(c => c.id === i.categoryId) && i.deletedAt === null,
  );
  return {
    format: 'track-template',
    version: 1,
    trackName: track.name,
    trackEmoji: track.emoji,
    // categoryId в TemplateItem — это ИМЯ категории (в целевой базе категорий ещё нет)
    categories: activeCats.map(c => ({ name: c.name, emoji: c.emoji })),
    items: items.map(i => {
      const cat = activeCats.find(c => c.id === i.categoryId);
      return {
        name: i.name,
        unit: i.unit,
        quantity: i.quantity,
        minThreshold: i.minThreshold,
        maxThreshold: i.maxThreshold,
        expiresAt: null,
        packSize: i.packSize,
        trackExpiry: i.trackExpiry,
        trackQuantity: i.trackQuantity,
        notes: i.notes,
        categoryId: cat?.name ?? '',
      };
    }),
  };
}