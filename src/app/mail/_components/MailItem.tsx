import { Checkbox } from "@/components/ui/checkbox";
import { type Message } from "./fetch-messages";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

export function MailItem({ message }: { message: Message }) {
  const from = message.payload.headers.find(
    (header) => header.name === "From"
  )?.value;
  const subject = message.payload.headers.find(
    (header) => header.name === "Subject"
  )?.value;

  const date = message.payload.headers.find(
    (header) => header.name === "Date"
  )?.value;

  const isRead = !message.labelIds?.includes("UNREAD");

  const categories = (message.labelIds ?? [])
    .filter((label) => label.startsWith("CATEGORY_"))
    .map((label) => label.replace("CATEGORY_", ""));

  // Format date to relative time if valid date string
  const formattedDate = date
    ? formatDistanceToNow(new Date(date), { addSuffix: true })
    : "";

  return (
    <li className="flex flex-row items-center h-12 border border-border rounded overflow-hidden mx-4 hover:bg-accent/50 transition-colors has-[[data-state=checked]]:bg-primary/10">
      <Checkbox className="mx-4" />
      <Link
        href={`/mail/${message.id}`}
        className="flex-auto flex flex-row items-center gap-8 h-full px-4 cursor-default"
      >
        <div
          className={cn(
            "font-sans text-base select-none font-medium",
            isRead && "text-muted-foreground font-normal"
          )}
        >
          {subject}
        </div>
        <div className="font-sans text-sm text-muted-foreground select-none">
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
        <div className="font-sans text-sm text-muted-foreground select-none">
          {formattedDate}
        </div>
      </Link>
    </li>
  );
}
