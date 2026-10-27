import { useEffect, useRef } from "react";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

interface GoogleId {
  initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void;
  renderButton(element: HTMLElement, options: Record<string, unknown>): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

let scriptPromise: Promise<void> | null = null;
function loadGoogleScript(): Promise<void> {
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("Google script failed to load"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/** "Continue with Google". Renders nothing unless VITE_GOOGLE_CLIENT_ID is set. */
export function GoogleButton({
  onCredential,
  onError,
}: {
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  // Keep the latest callbacks without re-running the effect, which would draw the button twice.
  const handlers = useRef({ onCredential, onError });
  handlers.current = { onCredential, onError };

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    loadGoogleScript().then(
      () => {
        const g = window.google?.accounts.id;
        if (cancelled || !g || !box.current) return;
        g.initialize({ client_id: CLIENT_ID, callback: (r) => handlers.current.onCredential(r.credential) });
        g.renderButton(box.current, { theme: "outline", size: "large", text: "continue_with", width: 320 });
      },
      () => {
        if (!cancelled) handlers.current.onError("Google sign-in could not load. Check your connection, or use your email and password.");
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (!CLIENT_ID) return null;
  return (
    <div className="mt-5">
      <p className="mb-3 text-center text-sm text-slate-600">or</p>
      <div ref={box} className="flex min-h-10 justify-center" />
    </div>
  );
}
