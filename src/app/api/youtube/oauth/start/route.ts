import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { googleAuthUrl } from "@/lib/youtube/oauth";

/**
 * Kicks off Google OAuth for YouTube.
 *
 * Two modes:
 *   1. GET /api/youtube/oauth/start?channelId=xxx
 *      Reconnects an existing Channel record to its Google account.
 *   2. GET /api/youtube/oauth/start?clientId=xxx
 *      Initiates a new connection for a client. After authorization we'll
 *      discover every YouTube channel the account manages and let the
 *      admin pick which ones to track (channel picker flow).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const channelId = req.nextUrl.searchParams.get("channelId");
  const clientId = req.nextUrl.searchParams.get("clientId");

  if (!channelId && !clientId) {
    return NextResponse.json(
      { error: "Either channelId or clientId is required" },
      { status: 400 }
    );
  }

  let statePayload: Record<string, string>;

  if (channelId) {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel || channel.platform !== "YOUTUBE") {
      return NextResponse.json(
        { error: "Channel not found or not a YouTube channel" },
        { status: 404 }
      );
    }
    statePayload = { mode: "channel", channelId };
  } else {
    const client = await prisma.client.findUnique({ where: { id: clientId! } });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    statePayload = { mode: "client", clientId: clientId! };
  }

  // CSRF-safe state: opaque random token stored in a short-lived cookie
  const csrf = crypto.randomBytes(16).toString("hex");
  const state = Buffer.from(
    JSON.stringify({ ...statePayload, csrf })
  ).toString("base64url");

  let url: string;
  try {
    url = googleAuthUrl(state);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const res = NextResponse.redirect(url);
  res.cookies.set("yt_oauth_csrf", csrf, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60, // 10 minutes
  });
  return res;
}
