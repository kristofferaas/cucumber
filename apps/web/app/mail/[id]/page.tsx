import { getGoogleToken } from "../actions";
import { FullMessage } from "./_components/full-message";

export default async function MailDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { token } = await getGoogleToken();
  const { id } = await params;

  if (!token) {
    return <div>No token found</div>;
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="bg-background rounded-lg shadow-sm border">
        <div className="p-6">
          <FullMessage id={id} token={token} />
        </div>
      </div>
    </div>
  );
}
