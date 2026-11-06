import { notFound } from "next/navigation";
import { z } from "zod";
import { TicketPrint } from "@/components/kitchen/ticket-print";
import { requirePageStaff } from "@/server/auth/current-staff";
import { ApiError } from "@/server/errors";
import { getTicket } from "@/server/services/kitchen";

export default async function TicketPrintPage(props: PageProps<"/kitchen/tickets/[id]/print">) {
  await requirePageStaff("kitchen:view");
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  let ticket: Awaited<ReturnType<typeof getTicket>>;
  try {
    ticket = await getTicket(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return <TicketPrint ticket={ticket} />;
}
