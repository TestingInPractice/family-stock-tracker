import { db } from '../db/db';
import type { HouseholdEnvelopeV2, TrackTemplateEnvelope } from '../types';

export async function buildHouseholdEnvelope(): Promise<HouseholdEnvelopeV2> {
  const [hd, deviceId, trackingMethods, tracks, types, units, places, items, ops] = await Promise.all([
    db.household.toArray(),
    db.meta.get('deviceId'),
    db.trackingMethods.toArray(),
    db.tracks.toArray(),
    db.types.toArray(),
    db.units.toArray(),
    db.places.toArray(),
    db.items.toArray(),
    db.ops.toArray(),
  ]);
  if (!hd[0]) throw new Error('Дом не создан');
  return {
    format: 'household-backup',
    version: 2,
    exportedAt: Date.now(),
    deviceId: String(deviceId?.value ?? 'unknown'),
    deviceLabel: hd[0].deviceLabel,
    household: hd[0],
    trackingMethods, tracks, types, units, places, items, ops,
  };
}

export async function buildTrackTemplate(trackId: string): Promise<TrackTemplateEnvelope> {
  const track = await db.tracks.get(trackId);
  if (!track) throw new Error('Трек не найден');
  const places = (await db.places.where('trackId').equals(trackId).toArray())
    .filter(p => p.deletedAt === null);
  const items = (await db.items.toArray()).filter(
    i => places.some(p => p.id === i.placeId) && i.deletedAt === null,
  );
  const types = (await db.types.toArray()).filter(t => t.deletedAt === null);
  const typeNameById = new Map(types.map(t => [t.id, t.name]));
  return {
    format: 'track-template',
    version: 2,
    trackName: track.name,
    trackEmoji: track.emoji,
    places: places.map(p => ({ name: p.name, emoji: p.emoji })),
    items: items.map(i => {
      const place = places.find(p => p.id === i.placeId);
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
        placeName: place?.name ?? '',
        typeName: typeNameById.get(i.typeId) ?? '',
      };
    }),
  };
}