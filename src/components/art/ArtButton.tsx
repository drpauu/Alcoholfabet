import { forwardRef, type ComponentPropsWithRef, type ReactNode } from 'react';
import type { PlayerRole } from '../../domain/game/game-types';
import { ArtIcon, type ArtIconName } from './ArtIcon';

export type ArtButtonVariant = 'primary' | 'secondary' | 'quiet' | 'correct' | 'incorrect' | 'tp' | 'icon';
export type ArtTone = 'neutral' | 'pau' | 'tecla' | 'tp' | 'correct' | 'incorrect' | 'amber';
export interface ArtButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ArtButtonVariant;
  icon?: ArtIconName;
  trailingIcon?: ArtIconName;
  loading?: boolean;
  status?: 'normal' | 'success' | 'error';
  player?: PlayerRole;
  tone?: ArtTone;
  children?: ReactNode;
}

/** Every action shares one physical button and preserves native DOM/ARIA props. */
export const ArtButton = forwardRef<HTMLButtonElement, Omit<ArtButtonProps, 'ref'>>(function ArtButton({
  variant = 'primary', icon, trailingIcon, loading = false, status = 'normal', player, tone,
  disabled = false, type = 'button', className = '', children, ...props
}, ref) {
  return <button {...props} ref={ref} type={type} disabled={disabled || loading}
    aria-busy={loading || props['aria-busy'] || undefined}
    className={`art-button art-button--${variant} ${className}`.trim()}
    data-loading={loading} data-status={status} data-player={player} data-tone={tone ?? (player === 'PAU' ? 'pau' : player === 'TECLA' ? 'tecla' : variant === 'correct' || variant === 'incorrect' || variant === 'tp' ? variant : 'neutral')}>
    {icon && <span className="art-button__icon" aria-hidden="true"><ArtIcon name={icon} /></span>}
    {children !== undefined && <span className="art-button__label">{children}</span>}
    {trailingIcon && <span className="art-button__icon art-button__icon--trailing" aria-hidden="true"><ArtIcon name={trailingIcon} /></span>}
    <span className="art-button__loading" aria-hidden="true"><i /><i /><i /></span>
  </button>;
});

export type ArtButtonWrapperProps = Omit<ArtButtonProps, 'variant'>;
export const ArtButtonPrimary = (props: ArtButtonWrapperProps) => <ArtButton {...props} variant="primary" />;
export const ArtButtonSecondary = (props: ArtButtonWrapperProps) => <ArtButton {...props} variant="secondary" />;
export const ArtButtonQuiet = (props: ArtButtonWrapperProps) => <ArtButton {...props} variant="quiet" />;
export const ArtButtonCorrect = (props: ArtButtonWrapperProps) => <ArtButton {...props} variant="correct" icon={props.icon ?? 'correct'} />;
export const ArtButtonIncorrect = (props: ArtButtonWrapperProps) => <ArtButton {...props} variant="incorrect" icon={props.icon ?? 'incorrect'} />;
export const ArtButtonTP = (props: ArtButtonWrapperProps) => <ArtButton {...props} variant="tp" icon={props.icon ?? 'tp'} />;
export type ArtIconButtonProps = Omit<ArtButtonProps, 'variant' | 'icon' | 'children'> & { icon: ArtIconName; 'aria-label': string };
export const ArtIconButton = (props: ArtIconButtonProps) => <ArtButton {...props} variant="icon" />;
