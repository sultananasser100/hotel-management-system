import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function GuestNotFound() {
  return (
    <Card className="mx-auto w-full max-w-md text-center">
      <CardHeader>
        <CardTitle>Guest not found</CardTitle>
        <CardDescription>This guest doesn&apos;t exist or was removed.</CardDescription>
        <Button asChild className="mx-auto mt-2">
          <Link href="/guests">Back to guests</Link>
        </Button>
      </CardHeader>
    </Card>
  );
}
