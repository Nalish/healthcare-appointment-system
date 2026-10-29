
import { NextResponse } from "next/server";
import  prisma  from "@/lib/prisma";

// GET /api/availability
// Optional filters: ?doctorId=...&dayOfWeek=1
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const doctorId = searchParams.get("doctorId");
    const dayOfWeekParam = searchParams.get("dayOfWeek");

    const dayOfWeek =
      dayOfWeekParam === null ? undefined : Number(dayOfWeekParam);

    if (
      dayOfWeek !== undefined &&
      (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7)
    ) {
      return NextResponse.json(
        { message: "dayOfWeek must be a number from 1 to 7." },
        { status: 400 }
      );
    }

    const availability = await prisma.availability.findMany({
      where: {
        ...(doctorId ? { doctorId } : {}),
        ...(dayOfWeek !== undefined ? { dayOfWeek } : {}),
      },
      orderBy: [{ doctorId: "asc" }, { dayOfWeek: "asc" }],
    });

    return NextResponse.json(availability);
  } catch (error) {
    console.error("Failed to fetch availability:", error);

    return NextResponse.json(
      { message: "Failed to retrieve availability." },
      { status: 500 }
    );
  }
}

// POST /api/availability
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { doctorId, dayOfWeek, startMinute, endMinute } = body;

    if (
      typeof doctorId !== "string" ||
      !doctorId.trim() ||
      !Number.isInteger(dayOfWeek) ||
      dayOfWeek < 1 ||
      dayOfWeek > 7 ||
      !Number.isInteger(startMinute) ||
      startMinute < 0 ||
      startMinute > 1439 ||
      !Number.isInteger(endMinute) ||
      endMinute < 1 ||
      endMinute > 1440 ||
      endMinute <= startMinute
    ) {
      return NextResponse.json(
        {
          message:
            "Provide a doctorId, dayOfWeek from 1 to 7, and valid start/end minutes. End time must be after start time.",
        },
        { status: 400 }
      );
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
    });

    if (!doctor) {
      return NextResponse.json(
        { message: "Doctor not found." },
        { status: 404 }
      );
    }

    const newAvailability = await prisma.availability.create({
      data: {
        doctorId,
        dayOfWeek,
        startMinute,
        endMinute,
      },
    });

    return NextResponse.json(newAvailability, { status: 201 });
  } catch (error) {
    console.error("Failed to create availability:", error);

    return NextResponse.json(
      { message: "Failed to create availability." },
      { status: 500 }
    );
  }
}
