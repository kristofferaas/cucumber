import { Checkbox } from "@/components/ui/checkbox";
import { Message } from "./fetch-messages";

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
    <li className="flex flex-row h-12 border border-border rounded overflow-hidden px-4 mx-4 gap-8 items-center hover:bg-accent/50 transition-colors has-[[data-state=checked]]:bg-primary/10">
      <Checkbox />
      <div className="font-sans text-base select-none">{subject}</div>
      <div className="font-sans text-sm text-muted-foreground select-none">
        {from}
      </div>
      <div className="flex-1" />
      <div className="font-sans text-sm text-muted-foreground select-none">
        {date}
      </div>
    </li>
  );
}
