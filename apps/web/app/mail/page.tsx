import { getGoogleToken } from "./actions";
import { MailList } from "./_components/MailList";
import { UserGuard } from "./_components/UserGuard";

export default async function MailPage() {
  const { token } = await getGoogleToken();

  if (!token) {
    return <div>No token found</div>;
  }

  return (
    <UserGuard>
      <MailList token={token} />
    </UserGuard>
  );
}
