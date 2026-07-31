'use client';

import Image from 'next/image';
import { useState } from 'react';
import { t } from '@/lib/strings';
import type { ListingPhoto } from '@/lib/types';

export function PhotoGallery({ photos, title }: { photos: ListingPhoto[]; title: string }) {
  const [index, setIndex] = useState(0);

  if (!photos.length) {
    return (
      <div className="flex aspect-4/3 items-center justify-center rounded-[var(--radius-card)] bg-canvas text-ink-faint ring-1 ring-hairline">
        {t.listing.noPhoto}
      </div>
    );
  }

  const active = photos[index] ?? photos[0];

  return (
    <div>
      <div className="relative aspect-4/3 overflow-hidden rounded-[var(--radius-card)] bg-canvas ring-1 ring-hairline">
        <Image
          src={active.url}
          alt={`${title} — ${index + 1}`}
          fill
          sizes="(max-width: 1024px) 100vw, 60vw"
          className="object-cover"
          priority
        />
      </div>

      {photos.length > 1 && (
        <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {photos.map((photo, i) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`${i + 1}-rasm`}
                aria-current={i === index}
                className={`relative block h-16 w-20 shrink-0 overflow-hidden rounded-lg ring-2 ${
                  i === index ? 'ring-turquoise' : 'ring-hairline'
                }`}
              >
                <Image
                  src={photo.thumbUrl ?? photo.url}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
