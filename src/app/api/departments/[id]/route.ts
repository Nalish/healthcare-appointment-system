
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const isValidUUID = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

// GET: Retrieve one department
export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  const { id } = await params;

  if (!isValidUUID(id)) {
    return NextResponse.json(
      { message: "Invalid department ID" },
      { status: 400 }
    );
  }

  try {
    const department = await prisma.department.findUnique({
      where: { id },
    });

    if (!department) {
      return NextResponse.json(
        { message: "Department not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(department, { status: 200 });
  } catch (error) {
    console.error("Error fetching department:", error);

    return NextResponse.json(
      { message: "Failed to fetch department" },
      { status: 500 }
    );
  }
}

// PATCH: Update an existing department
export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  const { id } = await params;

  if (!isValidUUID(id)) {
    return NextResponse.json(
      { message: "Invalid department ID" },
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
      name?: string;
      description?: string | null;
    } = {};

    if ("name" in data) {
      if (
        typeof data.name !== "string" ||
        !data.name.trim()
      ) {
        return NextResponse.json(
          { message: "Department name must not be empty" },
          { status: 400 }
        );
      }

      updateData.name = data.name.trim();
    }

    if ("description" in data) {
      if (
        data.description !== null &&
        typeof data.description !== "string"
      ) {
        return NextResponse.json(
          { message: "Description must be text or null" },
          { status: 400 }
        );
      }

      updateData.description =
        typeof data.description === "string"
          ? data.description.trim()
          : null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { message: "Provide a name or description to update" },
        { status: 400 }
      );
    }

    const department = await prisma.department.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(department, { status: 200 });
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { message: "Department not found" },
          { status: 404 }
        );
      }

      if (error.code === "P2002") {
        return NextResponse.json(
          { message: "A department with this name already exists" },
          { status: 409 }
        );
      }
    }

    console.error("Error updating department:", error);

    return NextResponse.json(
      { message: "Failed to update department" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a department
export async function DELETE(
  _request: Request,
  { params }: RouteContext
) {
  const { id } = await params;

  if (!isValidUUID(id)) {
    return NextResponse.json(
      { message: "Invalid department ID" },
      { status: 400 }
    );
  }

  try {
    await prisma.department.delete({
      where: { id },
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { message: "Department not found" },
          { status: 404 }
        );
      }

      if (error.code === "P2003") {
        return NextResponse.json(
          {
            message:
              "This department is linked to other records and cannot be deleted.",
          },
          { status: 409 }
        );
      }
    }

    console.error("Error deleting department:", error);

    return NextResponse.json(
      { message: "Failed to delete department" },
      { status: 500 }
    );
  }
}
