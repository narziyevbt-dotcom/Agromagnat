'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ApiError, apiFetch, needsPhone } from '@/lib/api';
import { getAccessToken, phoneGatePath } from '@/lib/session';

export interface ProfileState {
  ok?: boolean;
  error?: string;
}

export async function updateProfileAction(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const token = await getAccessToken();
  if (!token) {
    return { error: 'Avtorizatsiya talab qilinadi' };
  }

  const name = String(formData.get('name') ?? '').trim();
  const regionId = String(formData.get('regionId') ?? '');
  const districtId = String(formData.get('districtId') ?? '');

  if (name.length < 2) {
    return { error: "Ism kamida 2 ta belgidan iborat bo'lishi kerak" };
  }

  try {
    await apiFetch('/auth/me', {
      method: 'PATCH',
      token,
      body: {
        name,
        ...(regionId ? { regionId } : {}),
        ...(districtId ? { districtId } : {}),
      },
    });
    revalidatePath('/dashboard/sozlamalar');
    revalidatePath('/dashboard');
    revalidatePath('/profil');
    return { ok: true };
  } catch (error) {
    if (needsPhone(error)) {
      redirect(phoneGatePath('/dashboard/sozlamalar'));
    }
    return {
      error: error instanceof ApiError ? error.message : 'Saqlab bo‘lmadi',
    };
  }
}
