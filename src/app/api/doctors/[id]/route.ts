
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const isValidUUID = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

// GET: Retrieve one doctor
export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  const { id } = await params;

  if (!isValidUUID(id)) {
    return NextResponse.json(
      { message: "Invalid doctor ID" },
      { status: 400 }
    );
  }

  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id },
      include: {
        user: {
          select: { fullName: true },
        },
        department: {
          select: { name: true },
        },
      },
    });

    if (!doctor) {
      return NextResponse.json(
        { message: "Doctor not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(doctor, { status: 200 });
  } catch (error) {
    console.error("Error fetching doctor:", error);

    return NextResponse.json(
      { message: "Failed to fetch doctor" },
      { status: 500 }
    );
  }
}

// PATCH: Update a doctor's profile
export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  const { id } = await params;

  if (!isValidUUID(id)) {
    return NextResponse.json(
      { message: "Invalid doctor ID" },
      { status: 400 }
    );
  }

  try {
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { message: "Request body must be a JSON object" },
        { status: 400 }
      );
    }

    const data = body as Record<string, unknown>;

    const updateData: {
      departmentId?: string;
      licenseNumber?: string | null;
      bio?: string | null;
      consultationDurationMinutes?: number;
    } = {};

    if ("departmentId" in data) {
      if (
        typeof data.departmentId !== "string" ||
        !isValidUUID(data.departmentId)
      ) {
        return NextResponse.json(
          { message: "A valid departmentId is required" },
          { status: 400 }
        );
      }

      updateData.departmentId = data.departmentId;
    }

    if ("licenseNumber" in data) {
      if (
        data.licenseNumber !== null &&
        typeof data.licenseNumber !== "string"
      ) {
        return NextResponse.json(
          { message: "License number must be text or null" },
          { status: 400 }
        );
      }

      updateData.licenseNumber =
        typeof data.licenseNumber === "string"
          ? data.licenseNumber.trim() || null
          : null;
    }

    if ("bio" in data) {
      if (data.bio !== null && typeof data.bio !== "string") {
        return NextResponse.json(
          { message: "Bio must be text or null" },
          { status: 400 }
        );
      }

      updateData.bio =
        typeof data.bio === "string"
          ? data.bio.trim() || null
          : null;
    }

    if ("consultationDurationMinutes" in data) {
      const duration = data.consultationDurationMinutes;

      if (
        typeof duration !== "number" ||
        !Number.isInteger(duration) ||
        duration <= 0
      ) {
        return NextResponse.json(
          { message: "Consultation duration must be a positive integer" },
          { status: 400 }
        );
      }

      updateData.consultationDurationMinutes = duration;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { message: "Provide at least one valid field to update" },
        { status: 400 }
      );
    }

    if (updateData.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: updateData.departmentId },
        select: { id: true },
      });

      if (!department) {
        return NextResponse.json(
          { message: "Department not found" },
          { status: 404 }
        );
      }
    }

    const doctor = await prisma.doctor.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: { fullName: true },
        },
        department: {
          select: { name: true },
        },
      },
    });

    return NextResponse.json(doctor, { status: 200 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { message: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    if (error instanceof Error && "code" in error) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { message: "Doctor not found" },
          { status: 404 }
        );
      }

      if (error.code === "P2002") {
        return NextResponse.json(
          { message: "This license number is already in use" },
          { status: 409 }
        );
      }
    }

    console.error("Error updating doctor:", error);

    return NextResponse.json(
      { message: "Failed to update doctor" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a doctor profile
export async function DELETE(
  _request: Request,
  { params }: RouteContext
) {
  const { id } = await params;

  if (!isValidUUID(id)) {
    return NextResponse.json(
      { message: "Invalid doctor ID" },
      { status: 400 }
    );
  }

  try {
    await prisma.doctor.delete({
      where: { id },
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { message: "Doctor not found" },
          { status: 404 }
        );
      }

      if (error.code === "P2003") {
        return NextResponse.json(
          {
            message:
              "This doctor has related records and cannot be deleted.",
          },
          { status: 409 }
        );
      }
    }

    console.error("Error deleting doctor:", error);

    return NextResponse.json(
      { message: "Failed to delete doctor" },
      { status: 500 }
    );
  }
}
