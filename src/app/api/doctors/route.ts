
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const doctors = await prisma.doctor.findMany({
      include: {
        user: {
          select: {
            fullName: true,
          },
        },
        department: {
          select: {
            name: true,
            description:true
          },
          
        },
      },
    });

    return NextResponse.json(doctors);
  } catch (error) {
    console.error("Failed to fetch doctors:", error);

    return NextResponse.json(
      { error: "Failed to fetch doctors" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
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

    const userId =
      typeof data.userId === "string" ? data.userId.trim() : "";

    const departmentId =
      typeof data.departmentId === "string"
        ? data.departmentId.trim()
        : "";

    const licenseNumber =
      typeof data.licenseNumber === "string"
        ? data.licenseNumber.trim() || null
        : data.licenseNumber === undefined ||
            data.licenseNumber === null
          ? null
          : undefined;

    const bio =
      typeof data.bio === "string"
        ? data.bio.trim() || null
        : data.bio === undefined || data.bio === null
          ? null
          : undefined;

    const duration = data.consultationDurationMinutes;

    if (
      !userId ||
      !departmentId ||
      licenseNumber === undefined ||
      bio === undefined
    ) {
      return NextResponse.json(
        {
          message:
            "Valid userId, departmentId, licenseNumber, and bio values are required",
        },
        { status: 400 }
      );
    }

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(userId) || !uuidPattern.test(departmentId)) {
      return NextResponse.json(
        { message: "userId and departmentId must be valid UUIDs" },
        { status: 400 }
      );
    }

    if (
      duration !== undefined &&
      (!Number.isInteger(duration) || (duration as number) <= 0)
    ) {
      return NextResponse.json(
        {
          message: "Consultation duration must be a positive integer",
        },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    if (user.role !== "DOCTOR") {
      return NextResponse.json(
        { message: "The selected user does not have the doctor role" },
        { status: 400 }
      );
    }

    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true },
    });

    if (!department) {
      return NextResponse.json(
        { message: "Department not found" },
        { status: 404 }
      );
    }

    const doctor = await prisma.doctor.create({
      data: {
        userId,
        departmentId,
        licenseNumber,
        bio,
        ...(duration !== undefined
          ? { consultationDurationMinutes: duration as number }
          : {}),
      },
    });

    return NextResponse.json(doctor, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { message: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    if (error instanceof Error && "code" in error) {
      if (error.code === "P2002") {
        return NextResponse.json(
          {
            message:
              "This user or license number may already have a doctor profile",
          },
          { status: 409 }
        );
      }

      if (error.code === "P2003") {
        return NextResponse.json(
          { message: "The selected user or department is invalid" },
          { status: 400 }
        );
      }
    }

    console.error("Error creating doctor:", error);

    return NextResponse.json(
      { message: "Failed to create doctor" },
      { status: 500 }
    );
  }
}
