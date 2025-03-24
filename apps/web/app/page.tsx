import { currentUser } from "@clerk/nextjs/server";

export default async function Home() {
  const user = await currentUser();

  if (!user) {
    return <div>Not signed in</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
      <h1 className="text-4xl font-bold mb-8 text-primary">
        AI Chat Assistant
      </h1>
      <code className="w-200 h-100 bg-accent p-4 rounded overflow-auto">
        <pre>{JSON.stringify(user, null, 2)}</pre>
      </code>
    </div>
  );
}
