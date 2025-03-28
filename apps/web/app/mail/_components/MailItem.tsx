import { Checkbox } from "@/components/ui/checkbox";
import { Message } from "./fetch-messages";
import Link from "next/link";

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

  return (
    <li className="flex flex-row items-center h-12 border border-border rounded overflow-hidden mx-4 hover:bg-accent/50 transition-colors has-[[data-state=checked]]:bg-primary/10">
      <Checkbox className="mx-4" />
      <Link
        href={`/mail/${message.id}`}
        className="flex-auto flex flex-row items-center gap-8 h-full px-4"
      >
        <div className="font-sans text-base select-none">{subject}</div>
        <div className="font-sans text-sm text-muted-foreground select-none">
          {from}
        </div>
        <div className="flex-1" />
        <div className="font-sans text-sm text-muted-foreground select-none">
          {date}
        </div>
      </Link>
    </li>
  );
}
