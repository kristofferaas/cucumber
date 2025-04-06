"use client";

import { EmailIframe } from "@/components/messages/email-iframe";
import { api } from "@/trpc/react";

export function Message({ messageId }: { messageId: string }) {
  const [data] = api.gmail.getMessage.useSuspenseQuery({ messageId });

  if (data.html) {
    return <EmailIframe html={data.html} />;
  }

  return (
    <div>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
