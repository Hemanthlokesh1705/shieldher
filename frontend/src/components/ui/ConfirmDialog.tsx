import { useEffect, useId, useRef, type ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
  cancelLabel?: string;
  error?: string | null;
  confirmDisabled?: boolean;
  children?: ReactNode;
  variant?: "primary" | "destructive";
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
  busy = false,
  cancelLabel = "Cancel",
  error,
  confirmDisabled = false,
  children,
  variant = "primary",
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="confirmation-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <div className="confirmation-dialog-content">
        <span
          className={`confirmation-dialog-icon confirmation-dialog-icon-${variant}`}
          aria-hidden="true"
        >
          {variant === "destructive" ? (
            <AlertTriangle size={20} />
          ) : (
            <Info size={20} />
          )}
        </span>
        <div>
          <h2 id={titleId}>{title}</h2>
          <p id={descriptionId}>{description}</p>
        </div>
      </div>
      {children}
      {error && (
        <p className="confirmation-dialog-error" role="alert">
          {error}
        </p>
      )}
      <div className="confirmation-dialog-actions">
        <button
          type="button"
          className="confirmation-dialog-cancel"
          onClick={onCancel}
          disabled={busy}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`confirmation-dialog-confirm confirmation-dialog-confirm-${variant}`}
          onClick={onConfirm}
          disabled={busy || confirmDisabled}
          aria-busy={busy}
        >
          {busy ? "Please wait…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
