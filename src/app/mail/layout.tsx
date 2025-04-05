import { MailSideBar } from "./_components/layout/side-bar";

export default function MailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full bg-background">
      <MailSideBar />
      <div className="flex-1">{children}</div>
    </div>
  );
}
