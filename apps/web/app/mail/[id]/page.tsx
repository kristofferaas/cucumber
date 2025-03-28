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

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="bg-background rounded-lg shadow-sm border">
        <div className="p-6">
          <FullMessage message={message} />
        </div>
      </div>
    </div>
  );
}
