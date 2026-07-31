'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ApiError, createListing, uploadListingPhotos } from '@/lib/api';
import { getAccessToken } from '@/lib/session';

export interface PublishState {
  error?: string;
  /** Field-level messages, keyed by DTO field name. */
  fieldErrors?: Record<string, string>;
}

const numberOrUndefined = (value: FormDataEntryValue | null): number | undefined => {
  if (value === null || value === '') return undefined;
  const parsed = Number(String(value).replace(/\s/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const stringOrUndefined = (value: FormDataEntryValue | null): string | undefined => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.length ? text : undefined;
};

/**
 * Category-specific answers arrive as `attr.<key>` so they ride in the same
 * FormData as everything else. Reassembled here rather than in the client so
 * the prefix stays an implementation detail of this one round trip; the API
 * checks every key against the category's spec regardless.
 */
const collectAttributes = (formData: FormData): Record<string, string> => {
  const attributes: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('attr.') || typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) attributes[key.slice(5)] = trimmed;
  }
  return attributes;
};

export async function publishListing(
  _prev: PublishState,
  formData: FormData,
): Promise<PublishState> {
  const token = await getAccessToken();
  if (!token) {
    redirect('/kirish?next=/joylash');
  }

  const payload = {
    title: String(formData.get('title') ?? '').trim(),
    description: stringOrUndefined(formData.get('description')),
    categoryId: String(formData.get('categoryId') ?? ''),
    quantity: numberOrUndefined(formData.get('quantity')),
    quantityUnit: String(formData.get('quantityUnit') ?? 'kg'),
    price: numberOrUndefined(formData.get('price')),
    priceUnit: String(formData.get('priceUnit') ?? 'kg'),
    minOrder: numberOrUndefined(formData.get('minOrder')),
    wholesalePrice: numberOrUndefined(formData.get('wholesalePrice')),
    regionId: String(formData.get('regionId') ?? ''),
    districtId: String(formData.get('districtId') ?? ''),
    harvestDate: stringOrUndefined(formData.get('harvestDate')),
    delivery: stringOrUndefined(formData.get('delivery')) ?? 'none',
    attributes: collectAttributes(formData),
  };

  // Check client-side-visible requirements before the round trip, so a farmer
  // on a weak connection is not made to wait to be told a field is empty.
  const fieldErrors: Record<string, string> = {};
  if (payload.title.length < 5) {
    fieldErrors.title = "Sarlavha kamida 5 ta belgidan iborat bo'lishi kerak";
  }
  if (!payload.categoryId) fieldErrors.categoryId = 'Kategoriyani tanlang';
  if (!payload.regionId) fieldErrors.regionId = 'Viloyatni tanlang';
  if (!payload.districtId) fieldErrors.districtId = 'Tumanni tanlang';
  if (!payload.quantity || payload.quantity <= 0) fieldErrors.quantity = 'Hajmni kiriting';
  if (!payload.price || payload.price <= 0) fieldErrors.price = 'Narxni kiriting';

  if (Object.keys(fieldErrors).length) {
    return { fieldErrors };
  }

  let listingId: string;
  try {
    const listing = await createListing(payload, token);
    listingId = listing.id;
  } catch (error) {
    return {
      error: error instanceof ApiError ? error.message : "E'lon joylanmadi",
    };
  }

  // Photos are uploaded after the listing exists, and a failure here does not
  // discard the listing — the seller can add photos from the listing page.
  const photos = formData.getAll('photos').filter((file): file is File => file instanceof File);
  const usable = photos.filter((file) => file.size > 0).slice(0, 5);

  if (usable.length) {
    const upload = new FormData();
    for (const file of usable) {
      upload.append('files', file);
    }
    await uploadListingPhotos(listingId, upload, token).catch(() => null);
  }

  revalidatePath('/');
  revalidatePath('/profil');
  redirect(`/e/${listingId}`);
}
