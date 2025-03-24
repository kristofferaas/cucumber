"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";

export async function getGoogleToken() {
  const { userId } = await auth();

  const client = await clerkClient();
  const tokenResponse = await client.users.getUserOauthAccessToken(
    userId || "",
    "google"
  );

  const token = tokenResponse.data[0]?.token;

  return {
    token,
  };
}
