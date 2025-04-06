import { Button } from "@/components/ui/button";
import { SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Home() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-8 p-4">
      <SignInButton />
      <UserButton />
      <Button variant="link" asChild>
        <Link href="/mail">Open mail</Link>
      </Button>
    </div>
  );
}
