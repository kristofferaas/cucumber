import { Button } from "@/components/ui/button";
import { SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background gap-8">
      <SignInButton />
      <UserButton />
      <Button variant="link" asChild>
        <Link href="/mail">Open mail</Link>
      </Button>
    </div>
  );
}
