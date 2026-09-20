import { requirePermission } from "@/lib/session";
import { PaymentMethod, PaymentStatus } from "@/generated/prisma/enums";
import { getPayments } from "@/lib/payments";
import { parseDateOnly } from "@/lib/reservation-utils";
import { PaymentsTable } from "./payments-table";

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requirePermission("payments");
  const params = await searchParams;

  const query = firstValue(params.q).trim().slice(0, 100);
  const statusRaw = firstValue(params.status);
  const status = (Object.values(PaymentStatus) as string[]).includes(statusRaw)
    ? (statusRaw as PaymentStatus)
    : "";
  const methodRaw = firstValue(params.method);
  const method = (Object.values(PaymentMethod) as string[]).includes(methodRaw)
    ? (methodRaw as PaymentMethod)
    : "";
  const fromRaw = firstValue(params.from);
  const toRaw = firstValue(params.to);
  const from = parseDateOnly(fromRaw);
  const to = parseDateOnly(toRaw);
  const parsedPage = Number.parseInt(firstValue(params.page), 10);
  const requestedPage = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const { items, total, page, totalPages } = await getPayments({
    query,
    status,
    method,
    from,
    to,
    page: requestedPage,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="text-muted-foreground">
          A ledger of recorded payments. Record payments from a reservation&apos;s page.
        </p>
      </div>
      <PaymentsTable
        payments={items}
        total={total}
        page={page}
        totalPages={totalPages}
        filters={{
          q: query,
          status,
          method,
          from: from ? fromRaw : "",
          to: to ? toRaw : "",
        }}
      />
    </div>
  );
}
