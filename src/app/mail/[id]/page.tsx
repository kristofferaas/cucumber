"use client";

import { useParams } from "next/navigation";
import createDynamic from "next/dynamic";

const Message = createDynamic(
  async () => {
    const { Message } = await import("@/components/messages/message");
    return Message;
  },
  {
    ssr: false,
  },
);

export default function MailDetailsPage() {
  const { id } = useParams();

  if (!id || typeof id !== "string") {
    return <div>No id</div>;
  }

  return (
    <div className="container mx-auto max-w-4xl py-6">
      <div className="py-6">
        <Message messageId={id} />
      </div>
    </div>
  );
}
