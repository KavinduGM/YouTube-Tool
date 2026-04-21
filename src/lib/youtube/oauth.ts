import { prisma } from "@/lib/prisma";
import { decryptString, encryptString } from "@/lib/crypto";

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/yt-analytics-monetary.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

export function googleAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirect = process.env.YOUTUBE_REDIRECT_URI;
  if (!clientId || !redirect) {
    throw new Error(
      "GOOGLE_CLIENT_ID and YOUTUBE_REDIRECT_URI must be set before connecting YouTube"
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: YOUTUBE_SCOPES.join(" "),
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  id_token?: string;
};

export async function exchangeCodeForTokens(
  code: string
): Promise<GoogleTokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirect = process.env.YOUTUBE_REDIRECT_URI!;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirect,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${body}`);
  }

  return res.json();
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<GoogleTokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Returns a valid access token for a channel, refreshing if needed.
 * Throws if the channel isn't connected or refresh fails.
 */
export async function getValidAccessToken(channelId: string): Promise<string> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      platform: true,
      connected: true,
      accessToken: true,
      refreshToken: true,
      tokenExpiresAt: true,
    },
  });

  if (!channel || channel.platform !== "YOUTUBE") {
    throw new Error("Channel is not a YouTube channel");
  }
  if (!channel.connected || !channel.accessToken) {
    throw new Error("Channel is not connected");
  }

  const expiresAt = channel.tokenExpiresAt?.getTime() ?? 0;
  const now = Date.now();
  const safetyWindowMs = 60_000; // refresh 1 minute before expiry

  if (expiresAt - safetyWindowMs > now) {
    return decryptString(channel.accessToken);
  }

  // Need to refresh
  if (!channel.refreshToken) {
    throw new Error(
      "Access token expired and no refresh token is stored — reconnect the channel"
    );
  }

  const refresh = decryptString(channel.refreshToken);
  const refreshed = await refreshAccessToken(refresh);

  await prisma.channel.update({
    where: { id: channelId },
    data: {
      accessToken: encryptString(refreshed.access_token),
      tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      // Google may or may not return a new refresh token; keep the old one if not
      refreshToken: refreshed.refresh_token
        ? encryptString(refreshed.refresh_token)
        : undefined,
    },
  });

  return refreshed.access_token;
}
