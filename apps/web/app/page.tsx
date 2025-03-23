import { Chat } from "@/components/chat/chat";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
      <h1 className="text-4xl font-bold mb-8 text-primary">AI Chat Assistant</h1>
      <Chat />
    </div>
  );
}
