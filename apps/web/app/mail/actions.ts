"use server";

import { err, ok, wrap } from "@/lib/try-catch";
import { auth, clerkClient } from "@clerk/nextjs/server";

export async function getGoogleToken() {
  const [user, authError] = await wrap(auth());

  if (authError) {
    return err(authError);
  }

  const [client, clerkError] = await wrap(clerkClient());
  if (clerkError) {
    return err(clerkError);
  }

  const [tokenResponse, tokenError] = await wrap(
    client.users.getUserOauthAccessToken(user.userId || "", "google")
  );

  if (tokenError) {
    return err(tokenError);
  }

  const token = tokenResponse.data[0]?.token;

  if (!token) {
    return err(new Error("No token found"));
  }

  return ok(token);
}
