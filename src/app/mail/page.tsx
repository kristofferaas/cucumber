"use client";

import dynamic from "next/dynamic";
import { InboxBanner } from "./_components/layout/inbox-banner";

const MailList = dynamic(
  async () => {
    const { MailList } = await import("./_components/MailList");
    return MailList;
  },
  {
    ssr: false,
  },
);

export default function MailPage() {
  return (
    <>
      <InboxBanner />
      <MailList />
    </>
  );
}
