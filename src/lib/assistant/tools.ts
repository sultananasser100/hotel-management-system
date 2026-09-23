import type { Role } from "@/generated/prisma/enums";
import {
  HousekeepingStatus,
  PaymentMethod,
  PaymentStatus,
  ReservationStatus,
  RoomStatus,
} from "@/generated/prisma/enums";
import type { Resource } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getDashboardData, todayDateOnly } from "@/lib/dashboard";
import { getFrontDeskBoard } from "@/lib/front-desk";
import { getReservations, getReservationById } from "@/lib/reservations";
import { checkAvailability } from "@/lib/availability";
import { getRooms, getRoomTypeOptions } from "@/lib/rooms";
import { getHousekeepingBoard, getHousekeepingSummary } from "@/lib/housekeeping";
import { getGuests, getGuestById } from "@/lib/guests";
import { getPayments } from "@/lib/payments";
import {
  getGuestReport,
  getHousekeepingReport,
  getOccupancyReport,
  getReservationReport,
  getRevenueReport,
} from "@/lib/reports";
import { addDays } from "@/lib/report-utils";
import { DEFAULT_REPORT_RANGE_DAYS } from "@/lib/report-constants";
import { parseDateOnly, toDateInputValue } from "@/lib/reservation-utils";

export type AssistantUser = { id: string; role: Role };

// A plain JSON Schema object (type, properties, enum, required,
// additionalProperties, ...) — passed to Gemini as a FunctionDeclaration's
// `parametersJsonSchema`, which accepts this same standard JSON Schema shape.
export type JsonSchema = Record<string, unknown>;

export type AssistantToolDefinition = {
  name: string;
  description: string;
  input_schema: JsonSchema;
  /** Resource this tool exposes, checked with can(role, resource, "view") before running. */
  resource: Resource;
  handler: (input: Record<string, unknown>, user: AssistantUser) => Promise<unknown>;
};

// Result sizes are capped throughout so a single tool call can't return an
// unbounded amount of data to the model.
const LIST_RESULT_CAP = 25;

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function pageOrDefault(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 1;
}

function parseEnumOrEmpty<T extends string>(value: unknown, valid: readonly T[]): T | "" | null {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "string" && (valid as readonly string[]).includes(value)) return value as T;
  return null;
}

function parseDateInput(value: unknown): Date | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  return parseDateOnly(value) ?? undefined;
}

export const ASSISTANT_TOOLS: AssistantToolDefinition[] = [
  {
    name: "get_dashboard_summary",
    description:
      "Get the current hotel-wide snapshot: room counts by status, reservation counts by status, and today's arrivals and departures.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
    resource: "dashboard",
    handler: async () => {
      const data = await getDashboardData();
      return {
        totalRooms: data.totalRooms,
        availableRooms: data.availableRooms,
        occupiedRooms: data.occupiedRooms,
        roomStatusBreakdown: data.roomStatusBreakdown,
        reservationStatusBreakdown: data.reservationStatusBreakdown,
        todaysArrivals: data.todaysArrivals,
        todaysDepartures: data.todaysDepartures,
      };
    },
  },

  {
    name: "get_front_desk_board",
    description:
      "Get the front desk board: reservations confirmed to arrive today or earlier (arrivals), pending (unconfirmed) arrivals, and guests currently checked in (in-house), including how late an arrival or departure is.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
    resource: "checkInOut",
    handler: async () => {
      const board = await getFrontDeskBoard();
      const cap = <T>(items: T[]) => items.slice(0, LIST_RESULT_CAP);
      return {
        arrivals: cap(board.arrivals),
        pendingArrivals: cap(board.pendingArrivals),
        inHouse: cap(board.inHouse),
      };
    },
  },

  {
    name: "list_reservations",
    description:
      "Search and list reservations, optionally filtered by status, a check-in date range, and/or a text query (matches confirmation code, guest name, or room number). Returns a page of results with pagination info.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search by confirmation code, guest name, or room number.",
        },
        status: {
          type: "string",
          enum: Object.values(ReservationStatus),
          description: "Filter by exact reservation status.",
        },
        from: { type: "string", description: "Start of check-in date range, format YYYY-MM-DD." },
        to: { type: "string", description: "End of check-in date range, format YYYY-MM-DD." },
        page: { type: "number", description: "Page number starting at 1. Defaults to 1." },
      },
      additionalProperties: false,
    },
    resource: "reservations",
    handler: async (input) => {
      const status = parseEnumOrEmpty(
        input.status,
        Object.values(ReservationStatus) as ReservationStatus[],
      );
      if (status === null) return { error: "Invalid status value." };
      const from = parseDateInput(input.from);
      if (from === undefined) return { error: "`from` must be a date in YYYY-MM-DD format." };
      const to = parseDateInput(input.to);
      if (to === undefined) return { error: "`to` must be a date in YYYY-MM-DD format." };

      const result = await getReservations({
        query: stringOrEmpty(input.query),
        status,
        from,
        to,
        page: pageOrDefault(input.page),
      });

      return {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
        reservations: result.items,
      };
    },
  },

  {
    name: "get_reservation",
    description:
      "Get full details for a single reservation, including guest, room, dates, and payment summary. Look it up by its internal id (if already known from another tool call) or by its human-readable confirmation code.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The reservation's internal id, if already known." },
        confirmationCode: { type: "string", description: "The reservation's confirmation code." },
      },
      additionalProperties: false,
    },
    resource: "reservations",
    handler: async (input) => {
      let id = optionalString(input.id);
      const code = optionalString(input.confirmationCode);
      if (!id) {
        if (!code) return { found: false, message: "Provide an id or a confirmation code." };
        const { items } = await getReservations({
          query: code,
          status: "",
          from: null,
          to: null,
          page: 1,
        });
        const match =
          items.find((item) => item.confirmationCode.toLowerCase() === code.toLowerCase()) ??
          items[0] ??
          null;
        id = match?.id ?? null;
      }
      if (!id) return { found: false, message: "No matching reservation was found." };

      const reservation = await getReservationById(id);
      if (!reservation) return { found: false, message: "No matching reservation was found." };
      return { found: true, reservation };
    },
  },

  {
    name: "check_room_availability",
    description:
      "Check how many rooms of a given room type are available for a date range. Identify the room type by its id (if known) or its name (e.g. 'Deluxe Double').",
    input_schema: {
      type: "object",
      properties: {
        roomTypeId: {
          type: "string",
          description: "The room type's internal id, if already known.",
        },
        roomTypeName: {
          type: "string",
          description: "The room type's name, e.g. 'Deluxe Double'.",
        },
        checkIn: { type: "string", description: "Check-in date, format YYYY-MM-DD." },
        checkOut: { type: "string", description: "Check-out date, format YYYY-MM-DD." },
      },
      required: ["checkIn", "checkOut"],
      additionalProperties: false,
    },
    resource: "rooms",
    handler: async (input) => {
      const checkIn = parseDateOnly(stringOrEmpty(input.checkIn));
      const checkOut = parseDateOnly(stringOrEmpty(input.checkOut));
      if (!checkIn || !checkOut) {
        return { error: "checkIn and checkOut must be valid dates in YYYY-MM-DD format." };
      }
      if (checkOut <= checkIn) return { error: "checkOut must be after checkIn." };

      const roomTypes = await getRoomTypeOptions();
      let roomTypeId = optionalString(input.roomTypeId);
      const roomTypeName = optionalString(input.roomTypeName);
      if (!roomTypeId && roomTypeName) {
        const match = roomTypes.find((rt) => rt.name.toLowerCase() === roomTypeName.toLowerCase());
        roomTypeId = match?.id ?? null;
      }
      if (!roomTypeId) {
        return {
          error: "Unknown or unspecified room type.",
          availableRoomTypes: roomTypes.map((rt) => rt.name),
        };
      }

      const availability = await checkAvailability(prisma, { roomTypeId, checkIn, checkOut });
      const roomType = roomTypes.find((rt) => rt.id === roomTypeId);
      return {
        roomTypeName: roomType?.name ?? null,
        checkIn: toDateInputValue(checkIn),
        checkOut: toDateInputValue(checkOut),
        bookableCount: availability.bookableCount,
        availableCount: availability.availableCount,
        freeRoomNumbers: availability.freeRooms.slice(0, 10).map((room) => room.roomNumber),
      };
    },
  },

  {
    name: "list_rooms",
    description:
      "List rooms, optionally filtered by room status, housekeeping status, and/or floor.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: Object.values(RoomStatus),
          description: "Filter by room status.",
        },
        housekeepingStatus: {
          type: "string",
          enum: Object.values(HousekeepingStatus),
          description: "Filter by housekeeping status.",
        },
        floor: { type: "number", description: "Filter by floor number." },
      },
      additionalProperties: false,
    },
    resource: "rooms",
    handler: async (input) => {
      const statusFilter = parseEnumOrEmpty(
        input.status,
        Object.values(RoomStatus) as RoomStatus[],
      );
      if (statusFilter === null) return { error: "Invalid status value." };
      const hkFilter = parseEnumOrEmpty(
        input.housekeepingStatus,
        Object.values(HousekeepingStatus) as HousekeepingStatus[],
      );
      if (hkFilter === null) return { error: "Invalid housekeepingStatus value." };
      const floorFilter = typeof input.floor === "number" ? input.floor : null;

      const rooms = await getRooms();
      const filtered = rooms.filter(
        (room) =>
          (!statusFilter || room.status === statusFilter) &&
          (!hkFilter || room.housekeepingStatus === hkFilter) &&
          (floorFilter === null || room.floor === floorFilter),
      );

      return {
        total: filtered.length,
        truncated: filtered.length > LIST_RESULT_CAP,
        rooms: filtered.slice(0, LIST_RESULT_CAP).map((room) => ({
          roomNumber: room.roomNumber,
          floor: room.floor,
          roomTypeName: room.roomType.name,
          status: room.status,
          housekeepingStatus: room.housekeepingStatus,
          isActive: room.isActive,
        })),
      };
    },
  },

  {
    name: "get_housekeeping_board",
    description:
      "Get the housekeeping board: rooms with their current housekeeping status and any open cleaning task, plus a summary count by status. Optionally filter by status ('attention' means dirty or in-progress) and/or floor.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: [...Object.values(HousekeepingStatus), "attention"],
          description: "Filter by housekeeping status, or 'attention' for dirty + in-progress.",
        },
        floor: { type: "number", description: "Filter by floor number." },
        page: { type: "number", description: "Page number starting at 1. Defaults to 1." },
      },
      additionalProperties: false,
    },
    resource: "housekeeping",
    handler: async (input, user) => {
      const status = parseEnumOrEmpty(input.status, [
        ...(Object.values(HousekeepingStatus) as HousekeepingStatus[]),
        "attention" as const,
      ]);
      if (status === null) return { error: "Invalid status value." };
      const floor = typeof input.floor === "number" ? input.floor : null;

      const [board, summary] = await Promise.all([
        getHousekeepingBoard(
          { query: "", status, floor, assignee: "", page: pageOrDefault(input.page) },
          user.id,
        ),
        getHousekeepingSummary(),
      ]);

      return {
        summaryByStatus: summary,
        total: board.total,
        page: board.page,
        totalPages: board.totalPages,
        rooms: board.items.map((item) => ({
          roomNumber: item.roomNumber,
          floor: item.floor,
          roomTypeName: item.roomTypeName,
          housekeepingStatus: item.housekeepingStatus,
          roomStatus: item.roomStatus,
          task: item.task
            ? {
                status: item.task.status,
                priority: item.task.priority,
                assigneeName: item.task.assigneeName,
              }
            : null,
          inHouse: item.inHouse,
          departsToday: item.departsToday,
          arrivingToday: item.arrivingToday,
        })),
      };
    },
  },

  {
    name: "list_guests",
    description:
      "Search and list guests by name, email, or phone. Returns basic contact info, not identity documents.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search by first name, last name, email, or phone." },
        page: { type: "number", description: "Page number starting at 1. Defaults to 1." },
      },
      additionalProperties: false,
    },
    resource: "guests",
    handler: async (input) => {
      const { items, total, page, totalPages } = await getGuests({
        query: stringOrEmpty(input.query),
        page: pageOrDefault(input.page),
      });
      return {
        total,
        page,
        totalPages,
        // Identity documents and free-text notes are deliberately excluded.
        guests: items.map((guest) => ({
          id: guest.id,
          name: `${guest.firstName} ${guest.lastName}`,
          email: guest.email,
          phone: guest.phone,
          nationality: guest.nationality,
          isActive: guest.isActive,
          reservationCount: guest._count.reservations,
        })),
      };
    },
  },

  {
    name: "get_guest",
    description:
      "Get one guest's contact info and reservation history/summary. Look them up by internal id (if already known) or by name.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The guest's internal id, if already known." },
        name: { type: "string", description: "The guest's full or partial name." },
      },
      additionalProperties: false,
    },
    resource: "guests",
    handler: async (input) => {
      let id = optionalString(input.id);
      const name = optionalString(input.name);
      if (!id) {
        if (!name) return { found: false, message: "Provide an id or a name." };
        const { items } = await getGuests({ query: name, page: 1 });
        id = items[0]?.id ?? null;
      }
      if (!id) return { found: false, message: "No matching guest was found." };

      const detail = await getGuestById(id);
      if (!detail) return { found: false, message: "No matching guest was found." };

      return {
        found: true,
        // Identity documents, address, and free-text notes are deliberately excluded.
        guest: {
          id: detail.guest.id,
          name: `${detail.guest.firstName} ${detail.guest.lastName}`,
          email: detail.guest.email,
          phone: detail.guest.phone,
          nationality: detail.guest.nationality,
          isActive: detail.guest.isActive,
        },
        summary: detail.summary,
        history: detail.history.slice(0, LIST_RESULT_CAP),
      };
    },
  },

  {
    name: "list_payments",
    description:
      "Search and list payment records, optionally filtered by status, method, a date range, and/or a text query (matches confirmation code or guest name).",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search by confirmation code or guest name." },
        status: {
          type: "string",
          enum: Object.values(PaymentStatus),
          description: "Filter by payment status.",
        },
        method: {
          type: "string",
          enum: Object.values(PaymentMethod),
          description: "Filter by payment method.",
        },
        from: { type: "string", description: "Start of date range, format YYYY-MM-DD." },
        to: { type: "string", description: "End of date range, format YYYY-MM-DD." },
        page: { type: "number", description: "Page number starting at 1. Defaults to 1." },
      },
      additionalProperties: false,
    },
    resource: "payments",
    handler: async (input) => {
      const status = parseEnumOrEmpty(
        input.status,
        Object.values(PaymentStatus) as PaymentStatus[],
      );
      if (status === null) return { error: "Invalid status value." };
      const method = parseEnumOrEmpty(
        input.method,
        Object.values(PaymentMethod) as PaymentMethod[],
      );
      if (method === null) return { error: "Invalid method value." };
      const from = parseDateInput(input.from);
      if (from === undefined) return { error: "`from` must be a date in YYYY-MM-DD format." };
      const to = parseDateInput(input.to);
      if (to === undefined) return { error: "`to` must be a date in YYYY-MM-DD format." };

      const result = await getPayments({
        query: stringOrEmpty(input.query),
        status,
        method,
        from,
        to,
        page: pageOrDefault(input.page),
      });

      return {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
        payments: result.items,
      };
    },
  },

  {
    name: "get_report",
    description:
      "Get an aggregated report for a date range: 'revenue' (received/refunded/outstanding amounts, by method, trend), 'occupancy' (occupancy rate, trend), 'reservations' (status breakdown, arrivals, departures), 'guests' (totals, new, returning, nationality breakdown), or 'housekeeping' (completed/open counts, by type, by priority). Defaults to the last 30 days if no range is given.",
    input_schema: {
      type: "object",
      properties: {
        reportType: {
          type: "string",
          enum: ["revenue", "occupancy", "reservations", "guests", "housekeeping"],
        },
        from: { type: "string", description: "Start of date range, format YYYY-MM-DD." },
        to: { type: "string", description: "End of date range, format YYYY-MM-DD." },
      },
      required: ["reportType"],
      additionalProperties: false,
    },
    resource: "reports",
    handler: async (input) => {
      const reportType = stringOrEmpty(input.reportType);
      const validTypes = ["revenue", "occupancy", "reservations", "guests", "housekeeping"];
      if (!validTypes.includes(reportType)) {
        return { error: `reportType must be one of: ${validTypes.join(", ")}` };
      }

      const today = todayDateOnly();
      const defaultFrom = addDays(today, -(DEFAULT_REPORT_RANGE_DAYS - 1));
      const parsedFrom = parseDateInput(input.from);
      if (parsedFrom === undefined) return { error: "`from` must be a date in YYYY-MM-DD format." };
      const parsedTo = parseDateInput(input.to);
      if (parsedTo === undefined) return { error: "`to` must be a date in YYYY-MM-DD format." };
      const to = parsedTo ?? today;
      const from = parsedFrom && parsedFrom <= to ? parsedFrom : defaultFrom;
      const range = { range: { from: toDateInputValue(from), to: toDateInputValue(to) } };

      const centsToAmount = (cents: number) => Math.round(cents) / 100;

      switch (reportType) {
        case "revenue": {
          const r = await getRevenueReport({ from, to });
          return {
            ...range,
            receivedAmount: centsToAmount(r.receivedCents),
            refundedAmount: centsToAmount(r.refundedCents),
            outstandingAmount: centsToAmount(r.outstandingCents),
            byMethod: r.byMethod.map((m) => ({ method: m.method, amount: centsToAmount(m.cents) })),
            trend: r.trend.map((t) => ({ label: t.label, amount: centsToAmount(t.cents) })),
          };
        }
        case "occupancy": {
          const r = await getOccupancyReport({ from, to });
          const toPercent = (ratio: number) => Math.round(ratio * 1000) / 10;
          return {
            ...range,
            activeRoomCount: r.activeRoomCount,
            occupiedRoomsNow: r.occupiedRoomsNow,
            availableRoomsNow: r.availableRoomsNow,
            occupancyRatePercent: toPercent(r.occupancyRate),
            trend: r.trend.map((t) => ({ label: t.label, ratePercent: toPercent(t.rate) })),
          };
        }
        case "reservations":
          return { ...range, ...(await getReservationReport({ from, to })) };
        case "guests":
          return { ...range, ...(await getGuestReport({ from, to })) };
        case "housekeeping":
          return { ...range, ...(await getHousekeepingReport({ from, to })) };
        default:
          return { error: "Unreachable." };
      }
    },
  },
];
