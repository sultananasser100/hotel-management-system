import { requirePermission } from "@/lib/session";
import { AssistantChat } from "@/components/assistant/assistant-chat";

export default async function AssistantPage() {
  await requirePermission("aiAssistant");

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Assistant</h1>
        <p className="text-muted-foreground">
          Ask about reservations, rooms, guests, payments, housekeeping, or reports. The assistant
          only looks up existing data — it can&apos;t make changes.
        </p>
      </div>
      <AssistantChat />
    </div>
  );
}
