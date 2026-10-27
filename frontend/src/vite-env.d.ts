/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_TIMEZONE?: string;
  /** Public Google OAuth client id. Without it the Google button is not shown. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}
