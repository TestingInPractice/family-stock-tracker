import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../db/db';
import { sortByUrgency, computeStatus } from './status';
import { STATUS_META } from '../constants';
import PT_SANS_REGULAR from '../assets/fonts/PT_Sans-Web-Regular-subset.ttf?inline';
import PT_SANS_BOLD from '../assets/fonts/PT_Sans-Web-Bold-subset.ttf?inline';

/** data URI вида "data:font/ttf;base64,…" → голый base64 для addFileToVFS. */
const toBase64 = (dataUri: string) => dataUri.split(',')[1];

export async function buildTrackPdf(trackId: string): Promise<Blob> {
  const track = await db.tracks.get(trackId);
  if (!track) throw new Error('Трек не найден');
  const [hd] = await Promise.all([db.household.toArray()]);
  const warnDays = hd[0]?.warnDays ?? 30;
  const deviceLabel = hd[0]?.deviceLabel ?? '';
  const today = new Date();
  const cats = (await db.categories.where('trackId').equals(trackId).toArray()).filter(c => c.deletedAt === null);
  const items = (await db.items.toArray()).filter(i => cats.some(c => c.id === i.categoryId) && i.deletedAt === null);
  const rows = sortByUrgency(items, warnDays, today).map(i => {
    const cat = cats.find(c => c.id === i.categoryId);
    return [
      cat?.name ?? '', i.name, `${i.quantity} ${i.unit}`,
      i.expiresAt ?? '—', STATUS_META[computeStatus(i, warnDays, today)].label,
    ];
  });

  const doc = new jsPDF();
  doc.addFileToVFS('PT_Sans-Web-Regular-subset.ttf', toBase64(PT_SANS_REGULAR));
  doc.addFileToVFS('PT_Sans-Web-Bold-subset.ttf', toBase64(PT_SANS_BOLD));
  doc.addFont('PT_Sans-Web-Regular-subset.ttf', 'PTSans', 'normal');
  doc.addFont('PT_Sans-Web-Bold-subset.ttf', 'PTSans', 'bold');
  doc.setFont('PTSans', 'bold').setFontSize(16);
  doc.text(`${track.emoji} ${track.name}`, 14, 18);
  doc.setFont('PTSans', 'normal').setFontSize(10);
  doc.text(`Выгружено: ${today.toLocaleDateString('ru-RU')} · ${deviceLabel}`, 14, 26);
  autoTable(doc, {
    startY: 32,
    head: [['Категория', 'Позиция', 'Кол-во', 'Срок', 'Статус']],
    body: rows,
    styles: { font: 'PTSans', fontSize: 9 },
    headStyles: { font: 'PTSans', fontStyle: 'bold', fillColor: [14, 116, 144] },
  });
  return doc.output('blob');
}