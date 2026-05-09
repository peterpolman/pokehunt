// Themed yes/no modal. Used for the Reset-all confirm in /admin.

import { useEffect, useRef } from "react";
import s from "./ConfirmDialog.module.scss";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Bevestigen",
  cancelLabel = "Annuleren",
  onConfirm,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  return (
    <dialog ref={ref} className={s.dialog} onClose={onCancel}>
      <header className={s.header}>
        <h2 className={s.title}>{title}</h2>
      </header>
      <p className={s.message}>{message}</p>
      <div className={s.actions}>
        <button className={s.cancel} onClick={onCancel}>
          {cancelLabel}
        </button>
        <button className={s.confirm} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
