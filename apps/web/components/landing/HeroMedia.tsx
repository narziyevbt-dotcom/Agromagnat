import { existsSync } from 'node:fs';
import path from 'node:path';
import Image from 'next/image';
import { FarmScene } from './FarmScene';

/**
 * The hero's background layer, photo-first with an illustrated fallback.
 *
 * Drop a file at `apps/web/public/hero.jpg` and it becomes the hero — no code
 * change, no import to add. Until one exists the illustrated field scene fills
 * the frame, which is a deliberate choice over a grey box: the hero is the
 * first thing a farmer sees, and an empty placeholder there reads as a broken
 * page rather than as work in progress.
 *
 * The check runs at render on the server, so swapping the file in only needs a
 * redeploy, not a rebuild of this component.
 */
const HERO_CANDIDATES = ['hero.jpg', 'hero.jpeg', 'hero.webp', 'hero.png'];

function heroFile(): string | null {
  for (const name of HERO_CANDIDATES) {
    if (existsSync(path.join(process.cwd(), 'public', name))) {
      return `/${name}`;
    }
  }
  return null;
}

export function HeroMedia() {
  const photo = heroFile();

  return (
    <div className="absolute inset-0" aria-hidden="true">
      {photo ? (
        <Image
          src={photo}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      ) : (
        <FarmScene fill />
      )}

      {/*
        Two overlays, not one. The vertical wash keeps the headline legible over
        whatever lands in the top-left of the image; the bottom fade hands the
        panel off to the section beneath it instead of ending on a hard edge.
        Both are needed for a photograph and neither hurts the illustration.
      */}
      <div className="absolute inset-0 bg-gradient-to-r from-forest/88 via-forest/52 to-forest/12" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-forest/85 via-forest/35 to-transparent" />
      {/* Top scrim so a transparent nav stays legible over a bright sky. */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-forest/70 to-transparent" />
    </div>
  );
}
