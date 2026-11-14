
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";
import { UserRole } from "@/generated/prisma/client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const isValidUUID = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

// GET: Retrieve one availability record
export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const { user, response } = await requireRole([
      UserRole.PATIENT,
      UserRole.DOCTOR,
      UserRole.ADMIN,
    ]);

    if (response) {
      return response;
    }

    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json(
        { message: "Invalid availability ID." },
        { status: 400 }
      );
    }

    // Doctors can only retrieve their own availability records
    const availability = await prisma.availability.findFirst({
      where: {
        id,
        ...(user.role === UserRole.DOCTOR
          ? { doctorId: user.doctorProfile?.id ?? "" }
          : {}),
      },
    });

    if (!availability) {
      return NextResponse.json(
        { message: "Availability record not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(availability);
  } catch (error) {
    console.error("Failed to fetch availability:", error);

    return NextResponse.json(
      { message: "Failed to retrieve availability." },
      { status: 500 }
    );
  }
}

// PATCH: Update availability
// Doctors can update their own records. Admins can update any record.
export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  try {
    const { user, response } = await requireRole([
      UserRole.DOCTOR,
      UserRole.ADMIN,
    ]);

    if (response) {
      return response;
    }

    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json(
        { message: "Invalid availability ID." },
        { status: 400 }
      );
    }

    // Restrict doctors to their own availability records
    const existingAvailability = await prisma.availability.findFirst({
      where: {
        id,
        ...(user.role === UserRole.DOCTOR
          ? { doctorId: user.doctorProfile?.id ?? "" }
          : {}),
      },
    });

    if (!existingAvailability) {
      return NextResponse.json(
        { message: "Availability record not found." },
        { status: 404 }
      );
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

    // Only these fields can be updated.
    const allowedFields = [
      "dayOfWeek",
      "startMinute",
      "endMinute",
      "isActive",
    ];

    if (Object.keys(data).some((key) => !allowedFields.includes(key))) {
      return NextResponse.json(
        { message: "One or more fields cannot be updated." },
        { status: 400 }
      );
    }

    const { dayOfWeek, startMinute, endMinute, isActive } = data;

    if (
      dayOfWeek !== undefined &&
      (typeof dayOfWeek !== "number" ||
        !Number.isInteger(dayOfWeek) ||
        dayOfWeek < 1 ||
        dayOfWeek > 7)
    ) {
      return NextResponse.json(
        { message: "dayOfWeek must be a number from 1 to 7." },
        { status: 400 }
      );
    }

    if (
      startMinute !== undefined &&
      (typeof startMinute !== "number" ||
        !Number.isInteger(startMinute) ||
        startMinute < 0 ||
        startMinute > 1439)
    ) {
      return NextResponse.json(
        { message: "startMinute must be between 0 and 1439." },
        { status: 400 }
      );
    }

    if (
      endMinute !== undefined &&
      (typeof endMinute !== "number" ||
        !Number.isInteger(endMinute) ||
        endMinute < 1 ||
        endMinute > 1440)
    ) {
      return NextResponse.json(
        { message: "endMinute must be between 1 and 1440." },
        { status: 400 }
      );
    }

    if (
      isActive !== undefined &&
      typeof isActive !== "boolean"
    ) {
      return NextResponse.json(
        { message: "isActive must be true or false." },
        { status: 400 }
      );
    }

    const updatedStartMinute =
      startMinute ?? existingAvailability.startMinute;

    const updatedEndMinute =
      endMinute ?? existingAvailability.endMinute;

    if (updatedEndMinute <= updatedStartMinute) {
      return NextResponse.json(
        {
          message: "endMinute must be greater than startMinute.",
        },
        { status: 400 }
      );
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { message: "Provide at least one field to update." },
        { status: 400 }
      );
    }

    const updatedAvailability = await prisma.availability.update({
      where: { id },
      data: {
        ...(dayOfWeek !== undefined ? { dayOfWeek } : {}),
        ...(startMinute !== undefined ? { startMinute } : {}),
        ...(endMinute !== undefined ? { endMinute } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });

    return NextResponse.json(updatedAvailability);
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
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { message: "Availability record not found." },
        { status: 404 }
      );
    }

    console.error("Failed to update availability:", error);

    return NextResponse.json(
      { message: "Failed to update availability." },
      { status: 500 }
    );
  }
}

// DELETE: Delete availability
// Doctors can delete their own records. Admins can delete any record.
export async function DELETE(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const { user, response } = await requireRole([
      UserRole.DOCTOR,
      UserRole.ADMIN,
    ]);

    if (response) {
      return response;
    }

    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json(
        { message: "Invalid availability ID." },
        { status: 400 }
      );
    }

    const existingAvailability = await prisma.availability.findFirst({
      where: {
        id,
        ...(user.role === UserRole.DOCTOR
          ? { doctorId: user.doctorProfile?.id ?? "" }
          : {}),
      },
      select: {
        id: true,
      },
    });

    if (!existingAvailability) {
      return NextResponse.json(
        { message: "Availability record not found." },
        { status: 404 }
      );
    }

    await prisma.availability.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "Availability record deleted successfully." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to delete availability:", error);

    return NextResponse.json(
      { message: "Failed to delete availability." },
      { status: 500 }
    );
  }
}
