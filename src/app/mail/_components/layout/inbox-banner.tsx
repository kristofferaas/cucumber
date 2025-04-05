"use client";

import { Button } from "@/components/ui/button";

export function InboxBanner() {
  return (
    <div className="h-12 border-b border-border flex items-center px-4">
      <Button variant="ghost">All</Button>
    </div>
  );
}
