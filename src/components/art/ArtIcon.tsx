import type { ImgHTMLAttributes } from 'react';

export const artIconNames = ['home', 'rules', 'clock', 'settings', 'sound_on', 'sound_off', 'turn', 'personal', 'crossed', 'tp', 'question', 'correct', 'incorrect', 'drink', 'double_drink', 'plus_one', 'finish', 'connection', 'reconnect', 'copy', 'share', 'back', 'close', 'rotate', 'online', 'person', 'start'] as const;
export type ArtIconName = typeof artIconNames[number];
const iconLabels: Record<ArtIconName, string> = {
  home: 'Inici', rules: 'Normes', clock: 'Durada', settings: 'Configuració', sound_on: 'So activat', sound_off: 'So desactivat',
  turn: 'Torn', personal: 'Personal', crossed: 'Creuada', tp: 'T&P', question: 'Pregunta', correct: 'Correcte', incorrect: 'Incorrecte',
  drink: 'Beure', double_drink: 'Beure doble', plus_one: 'Una casella extra', finish: 'Meta', connection: 'Connexió interrompuda',
  reconnect: 'Connexió recuperada', copy: 'Copiar', share: 'Compartir', back: 'Enrere', close: 'Tancar', rotate: 'Girar el dispositiu',
  online: 'En línia', person: 'Jugador', start: 'Sortida',
};
export interface ArtIconProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  name: ArtIconName;
  decorative?: boolean;
  label?: string;
}

export function ArtIcon({ name, decorative = true, label, className = '', ...props }: ArtIconProps) {
  return <img {...props} className={`art-icon ${className}`.trim()} src={`/assets/production/art/icons/${name}.svg`}
    alt={decorative ? '' : label ?? iconLabels[name]} aria-hidden={decorative ? true : undefined} draggable={false} />;
}
