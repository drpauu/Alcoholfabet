import { createElement, type ComponentPropsWithRef, type HTMLAttributes, type ReactNode } from 'react';
import type { ArtTone } from './ArtButton';
import { ArtIcon, type ArtIconName } from './ArtIcon';

export type ArtMaterial = 'paper' | 'ceramic' | 'wood' | 'slate';
export interface ArtSurfaceOptions { material?: ArtMaterial; tone?: ArtTone; className?: string }
type PanelTag = 'article' | 'section' | 'div' | 'form';
export type ArtPanelProps<T extends PanelTag = 'article'> = ComponentPropsWithRef<T> & ArtSurfaceOptions & { as?: T };

/** Shared surface geometry/material for panels and physical cards. */
export function ArtPanel<T extends PanelTag = 'article'>({ as, material = 'paper', tone = 'neutral', className = '', children, ...props }: ArtPanelProps<T>) {
  return createElement(as ?? 'article', { ...props, className: `art-surface art-panel ${className}`.trim(), 'data-material': material, 'data-tone': tone }, children as ReactNode);
}

export interface ArtCardProps extends ComponentPropsWithRef<'article'>, ArtSurfaceOptions { face?: 'front' | 'back' }
export function ArtCard({ material = 'paper', tone = 'neutral', face = 'front', className = '', children, ...props }: ArtCardProps) {
  return <ArtPanel {...props} material={material} tone={tone} className={`art-card ${className}`.trim()} data-face={face}>{children}</ArtPanel>;
}

export interface ArtBadgeProps extends HTMLAttributes<HTMLSpanElement> { tone?: ArtTone; icon?: ArtIconName }
export function ArtBadge({ tone = 'neutral', icon, className = '', children, ...props }: ArtBadgeProps) {
  return <span {...props} className={`art-badge ${className}`.trim()} data-tone={tone}>
    {icon && <ArtIcon name={icon} />}<span className="art-badge__label">{children}</span>
  </span>;
}
