'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, GripVertical, ImagePlus, X } from 'lucide-react';

const MAX_PHOTOS = 5;
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp';

export interface PhotoItem {
  /** Stable across reorders, so React keeps the right preview on the right file. */
  id: string;
  file: File;
  url: string;
}

/**
 * The photo step, built to look like what it produces.
 *
 * The empty state is a row of illustrated frames rather than a file input,
 * because "choose files" tells a farmer nothing about what a good listing photo
 * looks like — the illustrations do, at a glance and in no language. Once
 * photos exist they replace the frames one by one, so the panel is a preview of
 * the listing rather than a form control.
 *
 * The first photo is the cover. That is stated in words and shown with a badge,
 * and reordering is drag-and-drop with an explicit "make cover" button beside
 * it — dragging is not reachable by keyboard and is fiddly on a phone.
 */
export function PhotoPanel({
  photos,
  onChange,
}: {
  photos: PhotoItem[];
  onChange: (next: PhotoItem[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Object URLs are a leak if they outlive their file. Revoking on unmount
  // rather than per-change keeps a preview alive while it is still on screen.
  const urls = useMemo(() => photos.map((photo) => photo.url), [photos]);
  useEffect(
    () => () => {
      for (const url of urls) URL.revokeObjectURL(url);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const add = (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);

    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      setError(`Ko'pi bilan ${MAX_PHOTOS} ta rasm`);
      return;
    }

    const accepted: PhotoItem[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      if (file.size > MAX_BYTES) {
        setError(`«${file.name}» juda katta — 8 MB gacha bo'lsin`);
        continue;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${accepted.length}-${photos.length}`,
        file,
        url: URL.createObjectURL(file),
      });
    }

    if (files.length > room) {
      setError(`Ko'pi bilan ${MAX_PHOTOS} ta rasm — qolgani qo'shilmadi`);
    }
    if (accepted.length) onChange([...photos, ...accepted]);
  };

  const remove = (id: string) => {
    const target = photos.find((photo) => photo.id === id);
    if (target) URL.revokeObjectURL(target.url);
    onChange(photos.filter((photo) => photo.id !== id));
  };

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= photos.length) return;
    const next = [...photos];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const full = photos.length >= MAX_PHOTOS;

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        onChange={(event) => {
          add(event.target.files);
          // Reset so re-picking the same file fires change again.
          event.target.value = '';
        }}
      />

      {photos.length === 0 ? (
        <EmptyPanel onPick={() => input.current?.click()} />
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {photos.map((photo, index) => (
            <li
              key={photo.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (dragIndex !== null) move(dragIndex, index);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={`group relative aspect-square overflow-hidden rounded-xl bg-canvas ring-1 ring-hairline ${
                dragIndex === index ? 'opacity-50' : ''
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />

              {index === 0 && (
                <span className="absolute top-1 left-1 rounded-md bg-forest/85 px-1.5 py-0.5 text-[10px] font-bold text-lime">
                  Muqova
                </span>
              )}

              <button
                type="button"
                onClick={() => remove(photo.id)}
                aria-label="Rasmni o'chirish"
                className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-forest/85 text-white transition-colors hover:bg-danger"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>

              {/* Keyboard- and thumb-reachable alternative to dragging. */}
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => move(index, 0)}
                  className="absolute inset-x-1 bottom-1 rounded-md bg-white/90 py-1 text-[10px] font-semibold text-forest opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                >
                  Muqova qilish
                </button>
              )}

              <GripVertical
                className="pointer-events-none absolute bottom-1 left-1 h-4 w-4 text-white/70 drop-shadow"
                aria-hidden="true"
              />
            </li>
          ))}

          {!full && (
            <li>
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-harvest/35 bg-mint text-harvest transition-colors hover:border-harvest hover:bg-mint/70"
              >
                <ImagePlus className="h-6 w-6" aria-hidden="true" />
                <span className="text-[11px] font-semibold">Rasm qo&apos;shish</span>
              </button>
            </li>
          )}
        </ul>
      )}

      <p className="mt-2 text-xs text-ink-muted">
        Birinchi rasm muqova bo&apos;ladi — qidiruvda o&apos;sha ko&apos;rinadi.
        Tartibni o&apos;zgartirish uchun suring. {photos.length}/{MAX_PHOTOS}
      </p>

      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Three illustrated polaroids on a warm panel — a picture of the outcome, not a
 * description of the input. The tilt is what makes them read as photographs
 * lying on a table rather than as empty boxes.
 */
function EmptyPanel({ onPick }: { onPick: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[var(--radius-card)] bg-[#FBF6EC] px-4 py-6 ring-1 ring-[#E8DCC6] sm:flex-row sm:justify-between sm:px-6">
      <div className="flex items-end" aria-hidden="true">
        <Polaroid rotate="-8" z="z-10">
          <TomatoArt />
        </Polaroid>
        <Polaroid rotate="3" z="z-20" className="-ml-4">
          <CrateArt />
        </Polaroid>
        <Polaroid rotate="10" z="z-10" className="-ml-4 hidden sm:block">
          <FieldArt />
        </Polaroid>
      </div>

      <div className="text-center sm:max-w-xs sm:text-left">
        <p className="text-sm font-bold text-forest">Mahsulotingiz rasmini qo&apos;shing</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          Rasmli e&apos;lonlar 5 barobar ko&apos;p ko&apos;riladi. Kunduzi, yaqindan va
          fon toza bo&apos;lsin.
        </p>

        <button
          type="button"
          onClick={onPick}
          className="tap-target mt-3 inline-flex items-center gap-2 rounded-full bg-lime px-5 text-sm font-bold text-forest transition-colors hover:bg-lime-dark"
        >
          <Camera className="h-4 w-4" aria-hidden="true" />
          Rasm qo&apos;shish
        </button>
      </div>
    </div>
  );
}

function Polaroid({
  children,
  rotate,
  z,
  className = '',
}: {
  children: React.ReactNode;
  rotate: string;
  z: string;
  className?: string;
}) {
  return (
    <div
      className={`${z} ${className} w-20 rounded-lg bg-white p-1.5 pb-4 shadow-md sm:w-24`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <div className="aspect-square overflow-hidden rounded-md">{children}</div>
    </div>
  );
}

function TomatoArt() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full">
      <rect width="64" height="64" fill="#F3E4D2" />
      <circle cx="26" cy="40" r="15" fill="#D4462F" />
      <circle cx="42" cy="42" r="12" fill="#C13A26" />
      <ellipse cx="21" cy="34" rx="5" ry="3.5" fill="#fff" opacity="0.4" transform="rotate(-25 21 34)" />
      <path d="M26 26c-4-4-9-4-11-1 3 4 8 5 11 1Z" fill="#3F8A52" />
      <path d="M26 25c1-5 6-7 9-5-1 5-5 7-9 5Z" fill="#4E9C5E" />
    </svg>
  );
}

function CrateArt() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full">
      <rect width="64" height="64" fill="#EFE7DA" />
      <rect x="8" y="30" width="48" height="26" rx="4" fill="#A9743B" />
      <g stroke="#8A5A2B" strokeWidth="2.5">
        <path d="M8 39h48M8 48h48" />
      </g>
      <circle cx="20" cy="26" r="8" fill="#E0932A" />
      <circle cx="34" cy="23" r="9" fill="#EBA23C" />
      <circle cx="47" cy="27" r="7" fill="#E0932A" />
    </svg>
  );
}

function FieldArt() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full">
      <rect width="64" height="64" fill="#CFE3EE" />
      <circle cx="47" cy="16" r="8" fill="#E0932A" />
      <path d="M0 34q32-8 64 0v12q-32-8-64 0Z" fill="#4E9C5E" />
      <path d="M0 46q32-8 64 0v18H0Z" fill="#2F7040" />
      <g stroke="#D4E96A" strokeWidth="1.5" opacity="0.6">
        <path d="M10 64 4 46M30 64l-2-18M52 64l6-18" />
      </g>
    </svg>
  );
}
