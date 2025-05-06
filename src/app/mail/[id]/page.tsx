"use client";

import { useParams } from "next/navigation";
import { ClientOnly } from "@/components/app-layout/client-only";
import { Message } from "@/components/messages/message";

export default function MailDetailsPage() {
  const { id } = useParams();

  if (!id || typeof id !== "string") {
    return <div>No id</div>;
  }

  return (
    <div className="container mx-auto max-w-4xl py-6">
      <div className="py-6">
        <ClientOnly fallback={<div>Loading...</div>}>
          <Message messageId={id} />
        </ClientOnly>
      </div>
    </div>
  );
}
