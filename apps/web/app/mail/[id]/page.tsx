import { createGmailApiClient } from "@/lib/gmail";
import { getGoogleToken } from "../actions";
import { FullMessage } from "./_components/full-message";

export default async function MailDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { token } = await getGoogleToken();

  if (!token) {
    return <div>No token found</div>;
  }

  const gmail = createGmailApiClient({ accessToken: token });
  const message = await gmail.getMessage(id, "full");

  const subject = message.payload?.headers?.find(
    (header) => header.name === "Subject"
  )?.value;

  const from = message.payload?.headers?.find(
    (header) => header.name === "From"
  )?.value;

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <h1 className="text-2xl font-bold py-6">{subject}</h1>
      <div className="text-sm text-muted-foreground">{from}</div>
      <div className="py-6">
        <FullMessage message={message} id={id} token={token} />
      </div>
    </div>
  );
}
