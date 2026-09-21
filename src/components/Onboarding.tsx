import { useRef, useState } from 'react';
import { buildImportPreview, importHouseholdEnvelope, parseHouseholdEnvelope } from '../logic/import';
import type { HouseholdEnvelope, ImportSummary } from '../types';
import { ImportPreviewModal } from './ImportPreviewModal';
import { CreateHouseForm, ProfileForm } from './OnboardingForms';

type Step = 'start' | 'create' | 'profile';

/** Первый экран: что это за приложение + два пути (создать дом / импортировать бэкап). */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>('start');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportSummary | null>(null);
  const [pendingEnvelope, setPendingEnvelope] = useState<HouseholdEnvelope | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBackupFile = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const env = parseHouseholdEnvelope(text);
      const summary = await buildImportPreview(env);
      setPendingEnvelope(env);
      setPreview(summary);
    } catch (err) {
      setError(`Не удалось импортировать: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const confirmImport = async () => {
    if (!pendingEnvelope) return;
    try {
      await importHouseholdEnvelope(pendingEnvelope);
      setPreview(null);
      setPendingEnvelope(null);
      setError(null);
      setStep('profile');
    } catch (err) {
      setError(`Не удалось импортировать: ${err instanceof Error ? err.message : String(err)}`);
      setPreview(null);
      setPendingEnvelope(null);
    }
  };

  if (step === 'create') return <CreateHouseForm onDone={onDone} onBack={() => setStep('start')} />;
  if (step === 'profile') return <ProfileForm onDone={onDone} />;

  return (
    <section className="onboarding">
      <h1>Трекер запасов</h1>
      <p className="onboarding-description">Учёт запасов дома: сроки годности, расход, докупка.</p>
      {error ? <p className="onboarding-error" role="alert">{error}</p> : null}
      <div className="onboarding-actions">
        <button type="button" className="onboarding-primary" onClick={() => setStep('create')}>
          Создать новый дом
        </button>
        <button type="button" className="onboarding-secondary" onClick={() => fileInputRef.current?.click()}>
          Импортировать бэкап (JSON)
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        aria-label="Импорт бэкапа (JSON)"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) void handleBackupFile(f);
          e.target.value = '';
        }}
      />
      {preview && pendingEnvelope ? (
        <ImportPreviewModal
          summary={preview}
          onConfirm={() => void confirmImport()}
          onCancel={() => { setPreview(null); setPendingEnvelope(null); }}
        />
      ) : null}
    </section>
  );
}