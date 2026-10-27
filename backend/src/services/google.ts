import { OAuth2Client } from "google-auth-library";

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

export type GoogleVerifier = (credential: string) => Promise<GoogleProfile>;

/** Checks a Google sign-in token against our own client id and returns who it belongs to. */
export function createGoogleVerifier(clientId: string): GoogleVerifier {
  const client = new OAuth2Client(clientId);
  return async (credential) => {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email) throw new Error("Google token has no email");
    return { sub: p.sub, email: p.email.toLowerCase(), emailVerified: p.email_verified === true, name: p.name ?? p.email };
  };
}
