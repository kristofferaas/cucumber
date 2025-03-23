'use client';

import { useChat } from '@ai-sdk/react';
import { useState } from 'react';
import { Send } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit, status } = useChat();
  const [inputHeight, setInputHeight] = useState('auto');

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleInputChange(e);
    // Adjust height based on content
    setInputHeight('auto');
    setInputHeight(`${e.target.scrollHeight}px`);
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    handleSubmit(e);
    setInputHeight('auto');
  };

  return (
    <Card className="w-full max-w-3xl mx-auto h-[700px] flex flex-col">
      <CardHeader>
        <CardTitle>Chat with AI</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-4">
          <div className="flex flex-col gap-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg p-4",
                  message.role === 'user' ? 'bg-muted/50 ml-auto max-w-[80%]' : 'bg-primary/10 max-w-[80%]'
                )}
              >
                <Avatar className="h-8 w-8">
                  {message.role === 'user' ? 'U' : 'AI'}
                </Avatar>
                <div className="flex-1 space-y-2">
                  <div className="prose prose-sm break-words">
                    {message.content}
                  </div>
                </div>
              </div>
            ))}
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-12">
                Send a message to start the conversation
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="border-t pt-4">
        <form onSubmit={handleFormSubmit} className="w-full flex gap-2">
          <Textarea
            value={input}
            onChange={handleTextareaChange}
            placeholder="Type your message..."
            className="flex-1 min-h-[40px] resize-none"
            style={{ height: inputHeight }}
            rows={1}
          />
          <Button type="submit" size="icon" disabled={status === 'streaming' || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
} 