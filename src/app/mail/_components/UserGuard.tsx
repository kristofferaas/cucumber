"use client";

import { useUser } from "@clerk/nextjs";

export function UserGuard({ children }: { children: React.ReactNode }) {
  const { user } = useUser();

  if (!user) {
    return <div>Please sign in to continue</div>;
  }

  return <>{children}</>;
}
