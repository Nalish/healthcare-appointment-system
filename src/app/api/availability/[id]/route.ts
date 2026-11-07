
import { NextResponse } from "next/server";
import  prisma  from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/availability/:id
export async function GET(
  request: Request,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    const availability = await prisma.availability.findUnique({
      where: { id },
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

// PATCH /api/availability/:id
export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existingAvailability = await prisma.availability.findUnique({
      where: { id },
    });

    if (!existingAvailability) {
      return NextResponse.json(
        { message: "Availability record not found." },
        { status: 404 }
      );
    }

    const { dayOfWeek, startMinute, endMinute, isActive } = body;

    // Validate only the fields supplied by the client.
    if (
      dayOfWeek !== undefined &&
      (!Number.isInteger(dayOfWeek) ||
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
      (!Number.isInteger(startMinute) ||
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
      (!Number.isInteger(endMinute) ||
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

    // Combine existing values with any new values.
    const updatedStartMinute =
      startMinute ?? existingAvailability.startMinute;

    const updatedEndMinute =
      endMinute ?? existingAvailability.endMinute;

    if (updatedEndMinute <= updatedStartMinute) {
      return NextResponse.json(
        { message: "endMinute must be greater than startMinute." },
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
    console.error("Failed to update availability:", error);

    return NextResponse.json(
      { message: "Failed to update availability." },
      { status: 500 }
    );
  }
}

// DELETE /api/availability/:id
export async function DELETE(
  request: Request,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    const existingAvailability = await prisma.availability.findUnique({
      where: { id },
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

    return NextResponse.json({
      message: "Availability record deleted successfully.",
    });
  } catch (error) {
    console.error("Failed to delete availability:", error);

    return NextResponse.json(
      { message: "Failed to delete availability." },
      { status: 500 }
    );
  }
}
