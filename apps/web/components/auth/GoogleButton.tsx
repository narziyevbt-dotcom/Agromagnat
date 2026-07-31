'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Google Identity Services. The only script this site loads from a third party. */
const GSI_SRC = 'https://accounts.google.com/gsi/client';

interface GsiButtonOptions {
  type: 'standard';
  theme: 'outline';
  size: 'large';
  text: 'continue_with';
  shape: 'pill';
  logo_alignment: 'center';
  width: number;
  locale: string;
}

interface Gsi {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        callback: (response: { credential?: string }) => void;
        auto_select: boolean;
        cancel_on_tap_outside: boolean;
        use_fedcm_for_prompt: boolean;
      }): void;
      renderButton(parent: HTMLElement, options: GsiButtonOptions): void;
    };
  };
}

declare global {
  interface Window {
    google?: Gsi;
  }
}

/**
 * "Google bilan davom etish".
 *
 * This renders Google's own button rather than a lime pill in our design
 * language, and that is deliberate: the branding is the trust signal. A
 * home-made button next to the word Google is what a phishing page looks
 * like, and Google's terms require their asset anyway. It is the one place
 * on the site where matching the design system would cost more than it buys.
 *
 * Google's button is drawn into an iframe whose width has to be given in
 * pixels, so the container is measured and the button re-rendered when it
 * changes — otherwise it is a fixed 400px stub on a 320px phone.
 */
export function GoogleButton({
  clientId,
  onCredential,
  disabled = false,
}: {
  clientId: string;
  onCredential: (idToken: string) => void;
  disabled?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [width, setWidth] = useState(0);

  // Kept in a ref so re-rendering the button does not depend on the identity
  // of the callback — a new function every parent render would otherwise tear
  // down and rebuild Google's iframe on every keystroke in the phone field.
  const handler = useRef(onCredential);
  handler.current = onCredential;

  useEffect(() => {
    const element = host.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      // Google caps the button at 400px and rejects anything under 200.
      setWidth(Math.min(400, Math.max(200, Math.round(entry.contentRect.width))));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const render = useCallback(() => {
    const gsi = window.google;
    if (!gsi || !host.current || !width) return;

    gsi.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (response.credential) {
          handler.current(response.credential);
        }
      },
      // One Tap is not shown here — see the note in docs/AUTH.md. Sign-in is
      // a deliberate act on this site, not something to interrupt a browsing
      // farmer with on the listing page.
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: true,
    });

    host.current.replaceChildren();
    gsi.accounts.id.renderButton(host.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      logo_alignment: 'center',
      width,
      locale: 'uz',
    });
  }, [clientId, width]);

  useEffect(() => {
    if (ready) render();
  }, [ready, render]);

  return (
    <>
      <Script
        src={GSI_SRC}
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      />
      <div
        ref={host}
        // The height is reserved before the iframe arrives so the phone form
        // below it does not jump — this is the whole of the sign-in page's CLS.
        className={`flex min-h-[44px] justify-center transition-opacity ${
          disabled ? 'pointer-events-none opacity-50' : ''
        }`}
      />
    </>
  );
}
