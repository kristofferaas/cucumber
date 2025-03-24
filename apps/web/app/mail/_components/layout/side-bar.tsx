import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { UserButton } from "@clerk/nextjs";

export function MailSideBar() {
  return (
    <nav className="h-screen w-16 flex flex-col gap-4 py-4 items-center justify-center bg-accent">
      <UserButton />
      <div className="flex-1" />
      <ThemeSwitcher />
    </nav>
  );
}
