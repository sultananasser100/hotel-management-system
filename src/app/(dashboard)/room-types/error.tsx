"use client";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RoomTypesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Card className="mx-auto w-full max-w-md text-center">
      <CardHeader>
        <CardTitle>Couldn&apos;t load room types</CardTitle>
        <CardDescription>Something went wrong. Please try again.</CardDescription>
        <Button className="mx-auto mt-2" onClick={reset}>
          Try again
        </Button>
      </CardHeader>
    </Card>
  );
}
