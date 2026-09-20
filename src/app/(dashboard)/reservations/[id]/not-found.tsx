import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReservationNotFound() {
  return (
    <Card className="mx-auto w-full max-w-md text-center">
      <CardHeader>
        <CardTitle>Reservation not found</CardTitle>
        <CardDescription>This reservation doesn&apos;t exist or was removed.</CardDescription>
        <Button asChild className="mx-auto mt-2">
          <Link href="/reservations">Back to reservations</Link>
        </Button>
      </CardHeader>
    </Card>
  );
}
