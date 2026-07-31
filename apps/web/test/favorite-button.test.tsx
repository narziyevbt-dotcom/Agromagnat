import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FavoriteButton } from '@/components/FavoriteButton';

/**
 * The gate's hardest path.
 *
 * Saving is a background fetch, not a navigation, so the server cannot redirect
 * the visitor itself — it hands back a code and a URL and this button has to do
 * the navigating. It is also optimistic, which means a refusal has to undo a
 * change already on screen: get that wrong and the heart stays filled for
 * something that was never saved.
 */

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
});

const heart = () => screen.getByRole('button');

describe('signed out', () => {
  it('goes to sign-in instead of calling the API', async () => {
    render(<FavoriteButton listingId="abc" initial={false} signedIn={false} />);

    await userEvent.click(heart());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/kirish?next=/e/abc');
  });
});

describe('signed in with a verified phone', () => {
  it('fills the heart before the request finishes', async () => {
    let resolve: (value: unknown) => void = () => {};
    fetchMock.mockReturnValue(new Promise((r) => (resolve = r)));

    render(<FavoriteButton listingId="abc" initial={false} signedIn />);
    await userEvent.click(heart());

    // On a 3G connection, waiting for a round trip before the heart fills
    // makes the tap feel broken.
    expect(heart()).toHaveAttribute('aria-pressed', 'true');

    resolve({ ok: true, status: 204 });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
  });

  it('rolls the heart back when the save fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => ({}) });

    render(<FavoriteButton listingId="abc" initial={false} signedIn />);
    await userEvent.click(heart());

    await waitFor(() => expect(heart()).toHaveAttribute('aria-pressed', 'false'));
    expect(push).not.toHaveBeenCalled();
  });

  it('unsaves with DELETE', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204 });

    render(<FavoriteButton listingId="abc" initial signedIn />);
    await userEvent.click(heart());

    await waitFor(() => expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'DELETE' }));
  });
});

describe('signed in without a verified phone', () => {
  const refused = () =>
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: 'PHONE_VERIFICATION_REQUIRED',
        verifyUrl: '/telefon?next=%2Fe%2Fabc',
      }),
    });

  it('takes the visitor to verification with this listing as the return address', async () => {
    refused();

    render(<FavoriteButton listingId="abc" initial={false} signedIn />);
    await userEvent.click(heart());

    // Not an error message: the person can finish what they started, and lands
    // back on the listing they were trying to save.
    await waitFor(() => expect(push).toHaveBeenCalledWith('/telefon?next=%2Fe%2Fabc'));
  });

  it('rolls the heart back — the save genuinely did not happen', async () => {
    refused();

    render(<FavoriteButton listingId="abc" initial={false} signedIn />);
    await userEvent.click(heart());

    await waitFor(() => expect(heart()).toHaveAttribute('aria-pressed', 'false'));
  });

  it('still navigates when the body cannot be read', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => {
        throw new Error('not json');
      },
    });

    render(<FavoriteButton listingId="abc" initial={false} signedIn />);
    await userEvent.click(heart());

    // A dead end here would be the worst outcome of the whole feature: the tap
    // does nothing and there is no way to find out why.
    await waitFor(() => expect(push).toHaveBeenCalledWith('/telefon?next=/e/abc'));
  });
});
