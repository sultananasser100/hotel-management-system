import { PaymentMethod } from "@/generated/prisma/enums";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PAYMENT_METHOD_LABEL } from "@/lib/payment-constants";
import { formatCurrency } from "@/lib/format";

type RevenueByMethodProps = {
  byMethod: { method: PaymentMethod; cents: number }[];
};

export function RevenueByMethod({ byMethod }: RevenueByMethodProps) {
  const max = Math.max(1, ...byMethod.map((m) => m.cents));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue by method</CardTitle>
      </CardHeader>
      <CardContent>
        {byMethod.every((m) => m.cents === 0) ? (
          <p className="text-sm text-muted-foreground">No payments received in this range.</p>
        ) : (
          <ul className="space-y-3">
            {byMethod.map(({ method, cents }) => (
              <li key={method} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-sm">{PAYMENT_METHOD_LABEL[method]}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(cents / max) * 100}%` }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right text-sm font-medium">
                  {formatCurrency(cents / 100)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
