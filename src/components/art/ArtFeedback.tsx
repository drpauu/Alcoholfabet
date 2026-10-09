import { useEffect, useId, useRef, type ComponentPropsWithoutRef, type HTMLAttributes, type ReactNode } from 'react';
import { ca } from '../../content/ca';
import { ArtIconButton, type ArtTone } from './ArtButton';
import { ArtIcon, type ArtIconName } from './ArtIcon';

export interface ArtModalProps extends Omit<ComponentPropsWithoutRef<'dialog'>, 'open' | 'onClose' | 'onCancel' | 'title'> {
  open: boolean;
  title: string;
  onClose: () => void;
  closeLabel?: string;
}

export function ArtModal({ open, title, onClose, closeLabel = ca.close, className = '', children, ...props }: ArtModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const internalClosures = useRef(0);
  const headingId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) { internalClosures.current += 1; dialog.close(); }
    return () => {
      // close dispatches asynchronously. Strict Mode can reopen this same
      // dialog before that event arrives, so count internal events explicitly.
      if (dialog.open) { internalClosures.current += 1; dialog.close(); }
      if (open && previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open]);
  return <dialog {...props} ref={ref} className={`art-surface art-modal ${className}`.trim()} data-material="paper"
    aria-labelledby={props['aria-label'] ? undefined : headingId} onCancel={(event) => { event.preventDefault(); onClose(); }} onClose={() => {
      if (internalClosures.current > 0) { internalClosures.current -= 1; return; }
      if (open && !ref.current?.open) onClose();
    }}>
    <ArtIconButton className="art-modal__close" icon="close" aria-label={closeLabel} onClick={onClose} />
    <h2 className="art-modal__title" id={headingId}>{title}</h2>{children}
  </dialog>;
}

export interface ArtToastProps extends HTMLAttributes<HTMLElement> {
  tone?: ArtTone;
  icon?: ArtIconName;
  onDismiss?: () => void;
  dismissLabel?: string;
  children?: ReactNode;
}
export function ArtToast({ tone = 'incorrect', icon, onDismiss, dismissLabel = ca.close, className = '', children, role, ...props }: ArtToastProps) {
  const symbol = icon ?? (tone === 'correct' ? 'correct' : tone === 'incorrect' ? 'incorrect' : 'connection');
  return <aside {...props} className={`art-surface art-toast ${className}`.trim()} data-material="paper" data-tone={tone}
    role={role ?? (tone === 'incorrect' ? 'alert' : 'status')}>
    <ArtIcon name={symbol} /><div className="art-toast__content">{children}</div>
    {onDismiss && <ArtIconButton className="art-toast__dismiss" icon="close" aria-label={dismissLabel} onClick={onDismiss} />}
  </aside>;
}

export interface ArtLoaderProps extends HTMLAttributes<HTMLDivElement> { label?: string; compact?: boolean }
export function ArtLoader({ label = ca.loading, compact = false, className = '', ...props }: ArtLoaderProps) {
  return <div {...props} className={`art-loader ${compact ? 'art-loader--compact' : ''} ${className}`.trim()} role="status" aria-live="polite">
    <span className="art-loader__disc" aria-hidden="true"><ArtIcon name="clock" /><span className="art-loader__grains"><i /><i /><i /></span></span>
    <span className="art-loader__label">{label}</span>
  </div>;
}
