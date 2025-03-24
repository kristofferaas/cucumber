"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import { MailItem } from "./MailItem";
import { fetchMessages } from "./fetch-messages";

export type ClerkUser = ReturnType<typeof useUser>["user"];

export function MailList({ token }: { token: string }) {
  const { user } = useUser();

  const { data } = useSuspenseQuery({
    queryKey: ["massages"],
    queryFn: () => fetchMessages(token, user),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  if (data.messages.length === 0) {
    return (
      <div className="text-center p-4">
        No messages found or rate limited by Gmail API
      </div>
    );
  }

  return (
    <ol className="flex flex-col gap-4">
      {data.messages.map((message) => (
        <MailItem key={message.id} message={message} />
      ))}
    </ol>
  );
}
