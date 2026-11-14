
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";
import { UserRole } from "@/generated/prisma/client";

const isValidUUID = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

// GET: Retrieve doctor availability
export async function GET(request: Request) {
  try {
    const { user, response } = await requireRole([
      UserRole.PATIENT,
      UserRole.DOCTOR,
      UserRole.ADMIN,
    ]);

    if (response) {
      return response;
    }

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

    if (doctorId && !isValidUUID(doctorId)) {
      return NextResponse.json(
        { message: "Invalid doctor ID." },
        { status: 400 }
      );
    }

    // Doctors can only view their own availability
    if (user.role === UserRole.DOCTOR) {
      const ownDoctorId = user.doctorProfile?.id;

      if (!ownDoctorId) {
        return NextResponse.json(
          { message: "Doctor profile not found." },
          { status: 403 }
        );
      }

      if (doctorId && doctorId !== ownDoctorId) {
        return NextResponse.json(
          {
            message: "You can only view your own availability.",
          },
          { status: 403 }
        );
      }
    }

    const effectiveDoctorId =
      user.role === UserRole.DOCTOR
        ? user.doctorProfile!.id
        : doctorId;

    const availability = await prisma.availability.findMany({
      where: {
        ...(effectiveDoctorId
          ? { doctorId: effectiveDoctorId }
          : {}),
        ...(dayOfWeek !== undefined ? { dayOfWeek } : {}),
      },
      orderBy: [
        { doctorId: "asc" },
        { dayOfWeek: "asc" },
        { startMinute: "asc" },
      ],
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

// POST: Create doctor availability
// Doctors can create their own availability.
// Admins can create availability for any doctor.
export async function POST(request: Request) {
  try {
    const { user, response } = await requireRole([
      UserRole.DOCTOR,
      UserRole.ADMIN,
    ]);

    if (response) {
      return response;
    }

    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { message: "Request body must be a JSON object." },
        { status: 400 }
      );
    }

    const data = body as Record<string, unknown>;

    const doctorId =
      typeof data.doctorId === "string"
        ? data.doctorId.trim()
        : "";

    const { dayOfWeek, startMinute, endMinute } = data;

    if (
      !doctorId ||
      !isValidUUID(doctorId) ||
      typeof dayOfWeek !== "number" ||
      !Number.isInteger(dayOfWeek) ||
      dayOfWeek < 1 ||
      dayOfWeek > 7 ||
      typeof startMinute !== "number" ||
      !Number.isInteger(startMinute) ||
      startMinute < 0 ||
      startMinute > 1439 ||
      typeof endMinute !== "number" ||
      !Number.isInteger(endMinute) ||
      endMinute < 1 ||
      endMinute > 1440 ||
      endMinute <= startMinute
    ) {
      return NextResponse.json(
        {
          message:
            "Provide a valid doctorId, dayOfWeek from 1 to 7, and valid start/end minutes. End time must be after start time.",
        },
        { status: 400 }
      );
    }

    // Doctors can only create availability for themselves
    if (user.role === UserRole.DOCTOR) {
      const ownDoctorId = user.doctorProfile?.id;

      if (!ownDoctorId) {
        return NextResponse.json(
          { message: "Doctor profile not found." },
          { status: 403 }
        );
      }

      if (doctorId !== ownDoctorId) {
        return NextResponse.json(
          {
            message:
              "You can only create availability for your own profile.",
          },
          { status: 403 }
        );
      }
    }

    // Verify that the selected doctor exists and is active
    const doctor = await prisma.doctor.findFirst({
      where: {
        id: doctorId,
        user: {
          role: UserRole.DOCTOR,
          isActive: true,
        },
      },
      select: {
        id: true,
      },
    });

    if (!doctor) {
      return NextResponse.json(
        { message: "Active doctor not found." },
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
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { message: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          message:
            "An availability record with these details already exists.",
        },
        { status: 409 }
      );
    }

    console.error("Failed to create availability:", error);

    return NextResponse.json(
      { message: "Failed to create availability." },
      { status: 500 }
    );
  }
}
