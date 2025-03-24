import { Message } from "./fetch-messages";

export function MailItem({ message }: { message: Message }) {
  return <li>{message.snippet}</li>;
}
