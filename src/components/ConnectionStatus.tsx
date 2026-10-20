import type { SyncMode } from '../types/game';

const LABELS: Record<SyncMode, string> = {
  connecting: 'Connecting…',
  realtime: 'Live',
  polling: 'Syncing',
  offline: 'Offline',
};

export function ConnectionStatus({ mode }: { mode: SyncMode }) {
  return (
    <span
      className={`conn conn-${mode}`}
      role="status"
      title={mode === 'polling' ? 'Fallback mode (periodic refresh)' : undefined}
    >
      <i /> {LABELS[mode]}
    </span>
  );
}
