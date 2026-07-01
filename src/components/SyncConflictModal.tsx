import React from 'react';
import { CloudDownload, Smartphone, X } from 'lucide-react';
import { formatSyncTime } from '../services/accountSync';

interface SyncConflictModalProps {
  open: boolean;
  remoteUpdatedAt: string | null;
  onUseCloud: () => void;
  onKeepDevice: () => void;
  onDismiss: () => void;
  busy?: boolean;
}

export const SyncConflictModal: React.FC<SyncConflictModalProps> = ({
  open,
  remoteUpdatedAt,
  onUseCloud,
  onKeepDevice,
  onDismiss,
  busy = false,
}) => {
  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-conflict-title"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onDismiss(); }}
    >
      <div className="modal-content account-conflict-modal">
        <button
          type="button"
          className="account-conflict-modal__close"
          onClick={onDismiss}
          disabled={busy}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <h2 id="sync-conflict-title" className="account-conflict-modal__title">
          Two copies of your data
        </h2>
        <p className="account-conflict-modal__lead">
          This device and your cloud backup both have tracking data. Choose which copy to keep — the other will be replaced.
        </p>

        {remoteUpdatedAt ? (
          <p className="account-conflict-modal__meta">
            Cloud backup last updated {formatSyncTime(remoteUpdatedAt)}.
          </p>
        ) : null}

        <div className="account-conflict-modal__actions">
          <button
            type="button"
            className="btn btn-primary account-conflict-modal__choice"
            disabled={busy}
            onClick={onUseCloud}
          >
            <CloudDownload size={18} aria-hidden />
            <span>
              <strong>Use cloud backup</strong>
              <small>Replace this device with data from your account</small>
            </span>
          </button>
          <button
            type="button"
            className="btn btn-secondary account-conflict-modal__choice"
            disabled={busy}
            onClick={onKeepDevice}
          >
            <Smartphone size={18} aria-hidden />
            <span>
              <strong>Keep this device</strong>
              <small>Upload local data and overwrite the cloud copy</small>
            </span>
          </button>
        </div>

        <button
          type="button"
          className="account-conflict-modal__skip"
          disabled={busy}
          onClick={onDismiss}
        >
          Decide later in Settings
        </button>
      </div>
    </div>
  );
};

export default SyncConflictModal;
