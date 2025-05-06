import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import type { InfiniteMessage } from "@/server/gmail/schemas";
import { api } from "@/trpc/react";

export function MailItem({ message }: { message: InfiniteMessage }) {
  const from = message.payload.headers.find(
    (header) => header.name === "From",
  )?.value;
  const subject = message.payload.headers.find(
    (header) => header.name === "Subject",
  )?.value;

  const date = message.payload.headers.find(
    (header) => header.name === "Date",
  )?.value;

  const isRead = !message.labelIds?.includes("UNREAD");

  const categories = (message.labelIds ?? [])
    .filter((label) => label.startsWith("CATEGORY_"))
    .map((label) => label.replace("CATEGORY_", ""));

  // Format date to relative time if valid date string
  const formattedDate = date
    ? formatDistanceToNow(new Date(date), { addSuffix: true })
    : "";

  const utils = api.useUtils();
  const prefetchMessage = () => {
    void utils.gmail.getMessage.prefetch({ messageId: message.id });
  };

  return (
    <li
      className="border-border hover:bg-accent/50 has-[[data-state=checked]]:bg-primary/10 mx-4 flex h-12 flex-row items-center overflow-hidden rounded border transition-colors"
      onMouseOver={prefetchMessage}
    >
      <Checkbox className="mx-4" />
      <Link
        href={`/mail/${message.id}`}
        className="flex h-full flex-auto cursor-default flex-row items-center gap-8 px-4"
      >
        <div
          className={cn(
            "font-sans text-base font-medium select-none",
            isRead && "text-muted-foreground font-normal",
          )}
        >
          {subject}
        </div>
        <div className="text-muted-foreground font-sans text-sm select-none">
          {from}
        </div>
        <div className="flex-1" />
        <div className="flex flex-row gap-1">
          {categories.map((category) => (
            <Badge key={category} variant="secondary">
              {category}
            </Badge>
          ))}
        </div>
        <div className="text-muted-foreground font-sans text-sm select-none">
          {formattedDate}
        </div>
      </Link>
    </li>
  );
}
