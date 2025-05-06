"use client";

import { ClientOnly } from "@/components/app-layout/client-only";
import { InboxBanner } from "./_components/layout/inbox-banner";
import { MailList } from "./_components/MailList";

export default function MailPage() {
  return (
    <>
      <InboxBanner />
      <ClientOnly fallback={<div>Loading...</div>}>
        <MailList />
      </ClientOnly>
    </>
  );
}
