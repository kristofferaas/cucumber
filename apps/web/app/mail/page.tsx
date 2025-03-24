import { getGoogleToken } from "./actions";
import { MailList } from "./_components/MailList";
import { UserGuard } from "./_components/UserGuard";
import { InboxBanner } from "./_components/layout/inbox-banner";

export default async function MailPage() {
  const { token } = await getGoogleToken();

  if (!token) {
    return <div>No token found</div>;
  }

  return (
    <UserGuard>
      <InboxBanner />
      <MailList token={token} />
    </UserGuard>
  );
}
