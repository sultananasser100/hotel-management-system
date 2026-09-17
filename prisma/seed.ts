import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  Role,
  RoomStatus,
  HousekeepingStatus,
  type Room,
} from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function hoursFromNow(hours: number): Date {
  const d = new Date();
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(d.getUTCHours() + hours);
  return d;
}

async function main() {
  console.log("Seeding database...");

  // --- Users (one row per role, plus one extra housekeeping staffer) ---
  const password = await bcrypt.hash("Password123!", 10);

  const [admin, receptionistAlice, receptionistBob, housekeeperCarla, housekeeperDan] =
    await Promise.all(
      [
        { name: "Amara Osei", email: "admin@hotel.test", role: Role.ADMIN },
        { name: "Alice Nguyen", email: "receptionist@hotel.test", role: Role.RECEPTIONIST },
        { name: "Bob Martinez", email: "bob.reception@hotel.test", role: Role.RECEPTIONIST },
        { name: "Carla Jimenez", email: "housekeeping@hotel.test", role: Role.HOUSEKEEPING },
        { name: "Dan Okafor", email: "dan.housekeeping@hotel.test", role: Role.HOUSEKEEPING },
      ].map((u) =>
        prisma.user.upsert({
          where: { email: u.email },
          update: {},
          create: { ...u, passwordHash: password },
        }),
      ),
    );

  // --- Hotel settings (singleton) ---
  await prisma.hotelSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      hotelName: "Harborview Hotel",
      address: "42 Bayfront Avenue, Harborview",
      currency: "USD",
      checkInTime: "15:00",
      checkOutTime: "11:00",
      timezone: "America/New_York",
      taxRate: 8.5,
      contactEmail: "frontdesk@harborviewhotel.test",
      contactPhone: "+1-555-0142",
    },
  });

  // --- Room types ---
  const standard = await prisma.roomType.create({
    data: {
      name: "Standard Room",
      description: "A comfortable room with everything needed for a short stay.",
      basePrice: 89,
      maxOccupancy: 2,
      amenities: ["Free Wi-Fi", "Air conditioning", "TV", "Work desk"],
    },
  });
  const deluxe = await prisma.roomType.create({
    data: {
      name: "Deluxe Room",
      description: "A spacious room with a city view and upgraded amenities.",
      basePrice: 139,
      maxOccupancy: 3,
      amenities: ["Free Wi-Fi", "Air conditioning", "TV", "Work desk", "Mini bar", "City view"],
    },
  });
  const suite = await prisma.roomType.create({
    data: {
      name: "Suite",
      description: "A separate living area, premium furnishings, and a private balcony.",
      basePrice: 229,
      maxOccupancy: 4,
      amenities: [
        "Free Wi-Fi",
        "Air conditioning",
        "TV",
        "Work desk",
        "Mini bar",
        "Separate living area",
        "Bathtub",
        "Balcony",
      ],
    },
  });

  // --- Rooms: 4 floors x 6 rooms ---
  const floorPlan: { floor: number; roomType: typeof standard }[] = [
    { floor: 1, roomType: standard },
    { floor: 2, roomType: standard },
    { floor: 3, roomType: deluxe },
    { floor: 4, roomType: suite },
  ];

  const rooms: Room[] = [];
  for (const { floor, roomType } of floorPlan) {
    for (let seq = 1; seq <= 6; seq++) {
      const roomNumber = `${floor}${String(seq).padStart(2, "0")}`;
      rooms.push(
        await prisma.room.create({
          data: {
            roomNumber,
            floor,
            roomTypeId: roomType.id,
            status: RoomStatus.AVAILABLE,
            housekeepingStatus: HousekeepingStatus.CLEAN,
          },
        }),
      );
    }
  }

  // Give a few rooms non-default states so the dashboard/housekeeping views have variety.
  await prisma.room.update({
    where: { roomNumber: "406" },
    data: { status: RoomStatus.MAINTENANCE, housekeepingStatus: HousekeepingStatus.DIRTY },
  });
  await prisma.room.update({
    where: { roomNumber: "305" },
    data: { housekeepingStatus: HousekeepingStatus.IN_PROGRESS },
  });
  await prisma.room.update({
    where: { roomNumber: "104" },
    data: { housekeepingStatus: HousekeepingStatus.INSPECTED },
  });

  const roomByNumber = (n: string) => rooms.find((r) => r.roomNumber === n)!;

  // --- Guests ---
  const guestData = [
    {
      firstName: "Elena",
      lastName: "Petrova",
      email: "elena.petrova@example.com",
      phone: "+1-555-0101",
    },
    {
      firstName: "Marcus",
      lastName: "Chen",
      email: "marcus.chen@example.com",
      phone: "+1-555-0102",
    },
    {
      firstName: "Sofia",
      lastName: "Rossi",
      email: "sofia.rossi@example.com",
      phone: "+1-555-0103",
    },
    {
      firstName: "James",
      lastName: "Turner",
      email: "james.turner@example.com",
      phone: "+1-555-0104",
    },
    { firstName: "Aisha", lastName: "Khan", email: "aisha.khan@example.com", phone: "+1-555-0105" },
    {
      firstName: "Lucas",
      lastName: "Silva",
      email: "lucas.silva@example.com",
      phone: "+1-555-0106",
    },
    {
      firstName: "Nora",
      lastName: "Andersen",
      email: "nora.andersen@example.com",
      phone: "+1-555-0107",
    },
    {
      firstName: "Ibrahim",
      lastName: "Diallo",
      email: "ibrahim.diallo@example.com",
      phone: "+1-555-0108",
    },
    { firstName: "Grace", lastName: "Kim", email: "grace.kim@example.com", phone: "+1-555-0109" },
    {
      firstName: "Tomas",
      lastName: "Novak",
      email: "tomas.novak@example.com",
      phone: "+1-555-0110",
    },
    {
      firstName: "Priya",
      lastName: "Sharma",
      email: "priya.sharma@example.com",
      phone: "+1-555-0111",
    },
    {
      firstName: "Ethan",
      lastName: "Brown",
      email: "ethan.brown@example.com",
      phone: "+1-555-0112",
    },
  ];
  const guests = [];
  for (const g of guestData) {
    guests.push(await prisma.guest.create({ data: { ...g, nationality: "N/A" } }));
  }

  let confirmationSeq = 1000;
  const nextConfirmationCode = () => `HV-${confirmationSeq++}`;

  const reservationsToCreate: {
    guestId: string;
    roomTypeId: string;
    roomId: string | null;
    checkInDate: Date;
    checkOutDate: Date;
    actualCheckInAt?: Date;
    actualCheckOutAt?: Date;
    status: "PENDING" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";
    totalAmount: number;
    createdById: string;
  }[] = [
    // Past, checked out (5)
    {
      guestId: guests[0].id,
      roomTypeId: standard.id,
      roomId: roomByNumber("101").id,
      checkInDate: daysFromNow(-6),
      checkOutDate: daysFromNow(-4),
      actualCheckInAt: hoursFromNow(-6 * 24 + 1),
      actualCheckOutAt: hoursFromNow(-4 * 24 - 1),
      status: "CHECKED_OUT",
      totalAmount: 178,
      createdById: receptionistAlice.id,
    },
    {
      guestId: guests[1].id,
      roomTypeId: deluxe.id,
      roomId: roomByNumber("301").id,
      checkInDate: daysFromNow(-5),
      checkOutDate: daysFromNow(-2),
      actualCheckInAt: hoursFromNow(-5 * 24 + 1),
      actualCheckOutAt: hoursFromNow(-2 * 24 - 1),
      status: "CHECKED_OUT",
      totalAmount: 417,
      createdById: receptionistBob.id,
    },
    {
      guestId: guests[2].id,
      roomTypeId: suite.id,
      roomId: roomByNumber("401").id,
      checkInDate: daysFromNow(-10),
      checkOutDate: daysFromNow(-7),
      actualCheckInAt: hoursFromNow(-10 * 24 + 1),
      actualCheckOutAt: hoursFromNow(-7 * 24 - 1),
      status: "CHECKED_OUT",
      totalAmount: 687,
      createdById: receptionistAlice.id,
    },
    {
      guestId: guests[3].id,
      roomTypeId: standard.id,
      roomId: roomByNumber("102").id,
      checkInDate: daysFromNow(-3),
      checkOutDate: daysFromNow(-1),
      actualCheckInAt: hoursFromNow(-3 * 24 + 1),
      actualCheckOutAt: hoursFromNow(-1 * 24 - 1),
      status: "CHECKED_OUT",
      totalAmount: 178,
      createdById: receptionistBob.id,
    },
    {
      guestId: guests[4].id,
      roomTypeId: deluxe.id,
      roomId: roomByNumber("302").id,
      checkInDate: daysFromNow(-8),
      checkOutDate: daysFromNow(-6),
      actualCheckInAt: hoursFromNow(-8 * 24 + 1),
      actualCheckOutAt: hoursFromNow(-6 * 24 - 1),
      status: "CHECKED_OUT",
      totalAmount: 278,
      createdById: receptionistAlice.id,
    },
    // Currently checked in (4) — check-in was in the past, check-out is today or later
    {
      guestId: guests[5].id,
      roomTypeId: standard.id,
      roomId: roomByNumber("103").id,
      checkInDate: daysFromNow(-2),
      checkOutDate: daysFromNow(1),
      actualCheckInAt: hoursFromNow(-2 * 24 + 2),
      status: "CHECKED_IN",
      totalAmount: 267,
      createdById: receptionistAlice.id,
    },
    {
      guestId: guests[6].id,
      roomTypeId: deluxe.id,
      roomId: roomByNumber("303").id,
      checkInDate: daysFromNow(-1),
      checkOutDate: daysFromNow(2),
      actualCheckInAt: hoursFromNow(-1 * 24 + 3),
      status: "CHECKED_IN",
      totalAmount: 417,
      createdById: receptionistBob.id,
    },
    {
      guestId: guests[7].id,
      roomTypeId: suite.id,
      roomId: roomByNumber("402").id,
      checkInDate: daysFromNow(0),
      checkOutDate: daysFromNow(3),
      actualCheckInAt: hoursFromNow(-1),
      status: "CHECKED_IN",
      totalAmount: 687,
      createdById: receptionistAlice.id,
    },
    {
      guestId: guests[8].id,
      roomTypeId: standard.id,
      roomId: roomByNumber("201").id,
      checkInDate: daysFromNow(-1),
      checkOutDate: daysFromNow(1),
      actualCheckInAt: hoursFromNow(-1 * 24 + 2),
      status: "CHECKED_IN",
      totalAmount: 178,
      createdById: receptionistBob.id,
    },
    // Arriving today, still just confirmed (not checked in yet) (2)
    {
      guestId: guests[9].id,
      roomTypeId: standard.id,
      roomId: roomByNumber("105").id,
      checkInDate: daysFromNow(0),
      checkOutDate: daysFromNow(2),
      status: "CONFIRMED",
      totalAmount: 178,
      createdById: receptionistAlice.id,
    },
    {
      guestId: guests[10].id,
      roomTypeId: deluxe.id,
      roomId: roomByNumber("304").id,
      checkInDate: daysFromNow(0),
      checkOutDate: daysFromNow(4),
      status: "CONFIRMED",
      totalAmount: 556,
      createdById: receptionistBob.id,
    },
    // Upcoming confirmed (4)
    {
      guestId: guests[11].id,
      roomTypeId: suite.id,
      roomId: roomByNumber("403").id,
      checkInDate: daysFromNow(3),
      checkOutDate: daysFromNow(6),
      status: "CONFIRMED",
      totalAmount: 687,
      createdById: receptionistAlice.id,
    },
    {
      guestId: guests[0].id,
      roomTypeId: standard.id,
      roomId: null,
      checkInDate: daysFromNow(5),
      checkOutDate: daysFromNow(7),
      status: "CONFIRMED",
      totalAmount: 178,
      createdById: receptionistBob.id,
    },
    {
      guestId: guests[1].id,
      roomTypeId: deluxe.id,
      roomId: null,
      checkInDate: daysFromNow(7),
      checkOutDate: daysFromNow(10),
      status: "CONFIRMED",
      totalAmount: 417,
      createdById: receptionistAlice.id,
    },
    {
      guestId: guests[2].id,
      roomTypeId: suite.id,
      roomId: null,
      checkInDate: daysFromNow(14),
      checkOutDate: daysFromNow(18),
      status: "PENDING",
      totalAmount: 916,
      createdById: receptionistBob.id,
    },
    // Cancelled / no-show (3)
    {
      guestId: guests[3].id,
      roomTypeId: standard.id,
      roomId: null,
      checkInDate: daysFromNow(2),
      checkOutDate: daysFromNow(4),
      status: "CANCELLED",
      totalAmount: 178,
      createdById: receptionistAlice.id,
    },
    {
      guestId: guests[4].id,
      roomTypeId: deluxe.id,
      roomId: null,
      checkInDate: daysFromNow(-1),
      checkOutDate: daysFromNow(1),
      status: "NO_SHOW",
      totalAmount: 139,
      createdById: receptionistBob.id,
    },
    {
      guestId: guests[5].id,
      roomTypeId: standard.id,
      roomId: null,
      checkInDate: daysFromNow(9),
      checkOutDate: daysFromNow(11),
      status: "PENDING",
      totalAmount: 178,
      createdById: receptionistAlice.id,
    },
  ];

  const reservations = [];
  for (const r of reservationsToCreate) {
    reservations.push(
      await prisma.reservation.create({
        data: { ...r, confirmationCode: nextConfirmationCode() },
      }),
    );
  }

  // --- Payments: paid in full for checked-out/checked-in stays, deposits for upcoming ones ---
  for (const reservation of reservations) {
    if (reservation.status === "CHECKED_OUT" || reservation.status === "CHECKED_IN") {
      await prisma.payment.create({
        data: {
          reservationId: reservation.id,
          amount: reservation.totalAmount,
          method: "CARD",
          status: "COMPLETED",
          transactionRef: `TXN-${reservation.confirmationCode}`,
          paidAt: reservation.actualCheckInAt ?? reservation.createdAt,
          createdById: reservation.createdById,
        },
      });
    } else if (reservation.status === "CONFIRMED") {
      const deposit = Number(reservation.totalAmount) * 0.3;
      await prisma.payment.create({
        data: {
          reservationId: reservation.id,
          amount: deposit,
          method: "ONLINE",
          status: "COMPLETED",
          transactionRef: `TXN-${reservation.confirmationCode}-DEP`,
          paidAt: reservation.createdAt,
          createdById: reservation.createdById,
        },
      });
    }
  }
  // One overdue/pending payment for a pending reservation, for report/notification variety.
  const pendingReservation = reservations.find((r) => r.status === "PENDING");
  if (pendingReservation) {
    await prisma.payment.create({
      data: {
        reservationId: pendingReservation.id,
        amount: Number(pendingReservation.totalAmount) * 0.3,
        method: "BANK_TRANSFER",
        status: "PENDING",
        createdById: pendingReservation.createdById,
      },
    });
  }

  // --- Housekeeping tasks ---
  await prisma.housekeepingTask.createMany({
    data: [
      {
        roomId: roomByNumber("101").id,
        assignedToId: housekeeperCarla.id,
        type: "CLEANING",
        status: "PENDING",
        priority: "HIGH",
        notes: "Guest checked out this morning.",
      },
      {
        roomId: roomByNumber("102").id,
        assignedToId: housekeeperDan.id,
        type: "CLEANING",
        status: "IN_PROGRESS",
        priority: "MEDIUM",
      },
      {
        roomId: roomByNumber("302").id,
        assignedToId: housekeeperCarla.id,
        type: "CLEANING",
        status: "COMPLETED",
        priority: "MEDIUM",
        completedAt: hoursFromNow(-2),
      },
      {
        roomId: roomByNumber("104").id,
        assignedToId: housekeeperDan.id,
        type: "INSPECTION",
        status: "VERIFIED",
        priority: "LOW",
        completedAt: hoursFromNow(-5),
      },
      {
        roomId: roomByNumber("406").id,
        assignedToId: null,
        type: "MAINTENANCE",
        status: "PENDING",
        priority: "URGENT",
        notes: "AC unit not cooling — needs maintenance contractor.",
      },
      {
        roomId: roomByNumber("305").id,
        assignedToId: housekeeperCarla.id,
        type: "CLEANING",
        status: "IN_PROGRESS",
        priority: "MEDIUM",
      },
    ],
  });

  // --- Notifications ---
  await prisma.notification.createMany({
    data: [
      {
        role: Role.HOUSEKEEPING,
        type: "HOUSEKEEPING",
        title: "Rooms awaiting cleaning",
        message: "Several rooms are marked dirty and need attention today.",
        isRead: false,
      },
      {
        userId: receptionistAlice.id,
        type: "RESERVATION",
        title: "Arrivals today",
        message: "2 guests are arriving today and have not yet checked in.",
        isRead: false,
      },
      {
        role: Role.ADMIN,
        type: "PAYMENT",
        title: "Pending payment",
        message: "A reservation deposit is still marked pending.",
        isRead: false,
      },
      {
        userId: admin.id,
        type: "SYSTEM",
        title: "Welcome to Harborview Hotel",
        message: "Your hotel management system is set up and ready to use.",
        isRead: true,
      },
    ],
  });

  // --- Activity log (a few recent entries for the AI assistant's "today's activity" queries) ---
  await prisma.activityLog.createMany({
    data: [
      {
        userId: receptionistAlice.id,
        action: "CHECK_IN",
        entityType: "Reservation",
        entityId: reservations[7].id,
        metadata: { room: "402" },
      },
      {
        userId: receptionistBob.id,
        action: "CREATE_RESERVATION",
        entityType: "Reservation",
        entityId: reservations[9].id,
        metadata: { confirmationCode: reservations[9].confirmationCode },
      },
      {
        userId: housekeeperCarla.id,
        action: "COMPLETE_TASK",
        entityType: "HousekeepingTask",
        entityId: roomByNumber("302").id,
        metadata: { room: "302" },
      },
    ],
  });

  console.log("Seed complete.");
  console.log("Demo accounts (password for all: Password123!):");
  console.log("  admin@hotel.test            (ADMIN)");
  console.log("  receptionist@hotel.test     (RECEPTIONIST)");
  console.log("  bob.reception@hotel.test    (RECEPTIONIST)");
  console.log("  housekeeping@hotel.test     (HOUSEKEEPING)");
  console.log("  dan.housekeeping@hotel.test (HOUSEKEEPING)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
