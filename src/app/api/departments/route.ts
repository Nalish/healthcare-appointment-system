
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";
import { UserRole } from "@/generated/prisma/client";

// GET: Retrieve all departments
export async function GET() {
  try {
    const { response } = await requireRole([
      UserRole.PATIENT,
      UserRole.DOCTOR,
      UserRole.ADMIN,
    ]);

    if (response) {
      return response;
    }

    const departments = await prisma.department.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(departments, { status: 200 });
  } catch (error) {
    console.error("Error fetching departments:", error);

    return NextResponse.json(
      { message: "Failed to fetch departments." },
      { status: 500 }
    );
  }
}

// POST: Create a department (Admin only)
export async function POST(request: Request) {
  try {
    const { response } = await requireRole([UserRole.ADMIN]);

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

    const name =
      typeof data.name === "string" ? data.name.trim() : "";

    const description =
      typeof data.description === "string"
        ? data.description.trim() || null
        : data.description === undefined || data.description === null
          ? null
          : undefined;

    if (!name || description === undefined) {
      return NextResponse.json(
        {
          message:
            "A valid department name and description are required.",
        },
        { status: 400 }
      );
    }

    const department = await prisma.department.create({
      data: {
        name,
        description,
      },
    });

    return NextResponse.json(department, { status: 201 });
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
        { message: "A department with this name already exists." },
        { status: 409 }
      );
    }

    console.error("Error creating department:", error);

    return NextResponse.json(
      { message: "Failed to create department." },
      { status: 500 }
    );
  }
}
