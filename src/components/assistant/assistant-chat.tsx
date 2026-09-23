"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChatMessage, type ChatMessageData } from "@/components/assistant/chat-message";
import { ChatInput } from "@/components/assistant/chat-input";

const SUGGESTIONS = [
  "What are today's arrivals and departures?",
  "Which rooms need cleaning right now?",
  "What's this month's revenue so far?",
  "Are any Deluxe rooms available next weekend?",
];

export function AssistantChat() {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  async function sendMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed || pending) return;

    const nextMessages: ChatMessageData[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setPending(true);

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      const data: unknown = await response.json().catch(() => null);
      const errorMessage =
        data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
          ? (data as { error: string }).error
          : null;

      if (!response.ok) {
        const message = errorMessage ?? "Something went wrong.";
        toast.error(message);
        setMessages((current) => [
          ...current,
          { role: "assistant", content: `Sorry — ${message}` },
        ]);
        return;
      }

      const reply =
        data && typeof data === "object" && typeof (data as { reply?: unknown }).reply === "string"
          ? (data as { reply: string }).reply
          : "I don't have a response for that.";
      setMessages((current) => [...current, { role: "assistant", content: reply }]);
    } catch {
      toast.error("Could not reach the assistant.");
      setMessages((current) => [
        ...current,
        { role: "assistant", content: "Sorry — I couldn't reach the assistant. Please try again." },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="flex h-[70vh] flex-col">
      <CardContent className="flex flex-1 flex-col gap-4 overflow-hidden">
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center text-sm text-muted-foreground">
              <Bot className="size-8" />
              <p>Ask about reservations, rooms, guests, payments, housekeeping, or reports.</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <Button
                    key={suggestion}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => sendMessage(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) => <ChatMessage key={index} message={message} />)
          )}
          {pending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Thinking…
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <ChatInput disabled={pending} onSend={sendMessage} />
      </CardContent>
    </Card>
  );
}
