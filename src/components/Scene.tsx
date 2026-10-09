import type { ReactNode } from 'react';

interface SceneProps {
  children: ReactNode;
  variant?: 'home' | 'game' | 'setup';
}

export function Scene({ children, variant = 'home' }: SceneProps) {
  return (
    <main className={`scene scene--${variant}`}>
      <picture className="scene-background" data-motion="gameScene" aria-hidden="true">
        <source media="(max-width: 767px)" srcSet="/assets/production/backgrounds/sitges_scene_mobile_ai.webp" />
        <img src="/assets/production/backgrounds/sitges_scene_desktop_ai.webp" alt="" />
      </picture>
      <div className="scene-atmosphere" aria-hidden="true" />
      <div className="scene-content">{children}</div>
    </main>
  );
}
