
import { NextRequest, NextResponse } from "next/server";
import  prisma  from "@/lib/prisma";
import { AppointmentStatus } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/authorization";
import { UserRole } from "@/generated/prisma/client";

// GET: Retrieve one appointment

// GET: Retrieve one appointment with ownership authorization
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Step 1: Authenticate and authorize the user
    const { user, response } = await requireRole([
      UserRole.PATIENT,
      UserRole.DOCTOR,
      UserRole.ADMIN,
    ]);

    if (response) {
      return response;
    }

    const { id } = await params;

    // Step 2: Check whether the doctor has a profile
    if (user.role === UserRole.DOCTOR && !user.doctorProfile) {
      return NextResponse.json(
        { message: "Doctor profile not found." },
        { status: 404 }
      );
    }

    // Step 3: Construct ownership conditions
    const where =
      user.role === UserRole.PATIENT
        ? { id, patientId: user.id }
        : user.role === UserRole.DOCTOR
          ? { id, doctorId: user.doctorProfile!.id }
          : { id };

    // Step 4: Retrieve the authorized appointment
    const appointment = await prisma.appointment.findFirst({
      where,
      include: {
        patient: {
          select: {
            id: true,
          },
        },
        doctor: {
          select: {
            id: true,
            departmentId: true,
          },
        },
      },
    });

    if (!appointment) {
      return NextResponse.json(
        { message: "Appointment not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(appointment, { status: 200 });

  } catch (error) {
    console.error("Error fetching appointment:", error);

    return NextResponse.json(
      { message: "Failed to fetch appointment." },
      { status: 500 }
    );
  }
}
 // PATCH: Update an appointment with role-based authorization
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Step 1: Authenticate the user
    const { user, response } = await requireRole([
      UserRole.PATIENT,
      UserRole.DOCTOR,
      UserRole.ADMIN,
    ]);

    if (response) {
      return response;
    }

    const { id } = await params;
    const body = await request.json();

    const { startTime, status, reason } = body;

    // Step 2: Verify doctor profile
    if (user.role === UserRole.DOCTOR && !user.doctorProfile) {
      return NextResponse.json(
        { message: "Doctor profile not found." },
        { status: 403 }
      );
    }

    // Step 3: Retrieve appointment with ownership conditions
    const where =
      user.role === UserRole.PATIENT
        ? { id, patientId: user.id }
        : user.role === UserRole.DOCTOR
          ? { id, doctorId: user.doctorProfile!.id }
          : { id };

    const existingAppointment = await prisma.appointment.findFirst({
      where,
      include: {
        doctor: {
          select: {
            consultationDurationMinutes: true,
          },
        },
      },
    });

    if (!existingAppointment) {
      return NextResponse.json(
        { message: "Appointment not found." },
        { status: 404 }
      );
    }

    // Step 4: Prevent updates to final appointments
    if (
      existingAppointment.status === "COMPLETED" ||
      existingAppointment.status === "CANCELLED"
    ) {
      return NextResponse.json(
        { message: "This appointment can no longer be updated." },
        { status: 400 }
      );
    }

    // Step 5: Validate requested status
    if (
      status !== undefined &&
      !Object.values(AppointmentStatus).includes(status)
    ) {
      return NextResponse.json(
        { message: "Invalid appointment status." },
        { status: 400 }
      );
    }

    // Step 6: Enforce role-specific permissions
    if (status !== undefined) {
      const allowedStatuses: Record<string, string[]> = {
        PATIENT: ["CANCELLED"],
        DOCTOR: ["CONFIRMED", "CANCELLED", "COMPLETED"],
        ADMIN: ["CONFIRMED", "CANCELLED", "COMPLETED"],
      };

      if (!allowedStatuses[user.role].includes(status)) {
        return NextResponse.json(
          { message: "You are not permitted to perform this status change." },
          { status: 403 }
        );
      }

      // Enforce valid status transitions
      const validTransitions: Record<string, string[]> = {
        PENDING: ["CONFIRMED", "CANCELLED"],
        CONFIRMED: ["CANCELLED", "COMPLETED"],
      };

      if (!validTransitions[existingAppointment.status].includes(status)) {
        return NextResponse.json(
          { message: "This status transition is not allowed." },
          { status: 400 }
        );
      }
    }

    // Step 7: Determine new start time
    let start = existingAppointment.startTime;

    if (startTime !== undefined) {
      if (
        user.role === UserRole.DOCTOR ||
        user.role === UserRole.ADMIN ||
        user.role === UserRole.PATIENT
      ) {
        start = new Date(startTime);

        if (Number.isNaN(start.getTime())) {
          return NextResponse.json(
            { message: "Please provide a valid startTime." },
            { status: 400 }
          );
        }

        if (start <= new Date()) {
          return NextResponse.json(
            { message: "The appointment must be scheduled in the future." },
            { status: 400 }
          );
        }
      }
    }

    // Step 8: Calculate appointment end time
    const end =
      startTime !== undefined
        ? new Date(
            start.getTime() +
              existingAppointment.doctor.consultationDurationMinutes *
                60 *
                1000
          )
        : existingAppointment.endTime;

    // Step 9: Check appointment conflicts when rescheduling
    if (startTime !== undefined) {
      const conflict = await prisma.appointment.findFirst({
        where: {
          id: { not: id },
          doctorId: existingAppointment.doctorId,
          status: { not: "CANCELLED" },
          startTime: { lt: end },
          endTime: { gt: start },
        },
        select: { id: true },
      });

      if (conflict) {
        return NextResponse.json(
          { message: "The doctor already has an appointment during that time." },
          { status: 409 }
        );
      }
    }

    // Step 10: Update only explicitly permitted fields
    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: {
        ...(startTime !== undefined && {
          startTime: start,
          endTime: end,
        }),
        ...(status !== undefined && { status }),
        ...(reason !== undefined && { reason }),
      },
    });

    return NextResponse.json(updatedAppointment, { status: 200 });

  } catch (error) {
    console.error("Error updating appointment:", error);

    return NextResponse.json(
      { message: "Failed to update appointment." },
      { status: 500 }
    );
  }
}


 // DELETE: Permanently delete an appointment (Admin only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Step 1: Authenticate and authorize administrator
    const { user, response } = await requireRole([
      UserRole.ADMIN,
    ]);

    if (response) {
      return response;
    }

    const { id } = await params;

    // Step 2: Find the appointment
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
      },
    });

    if (!appointment) {
      return NextResponse.json(
        { message: "Appointment not found." },
        { status: 404 }
      );
    }

    // Step 3: Prevent deletion of completed appointments
    if (appointment.status === "COMPLETED") {
      return NextResponse.json(
        { message: "Completed appointments cannot be deleted." },
        { status: 400 }
      );
    }

    // Step 4: Permanently delete the appointment
    await prisma.appointment.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "Appointment deleted successfully." },
      { status: 200 }
    );

  } catch (error) {
    console.error("Error deleting appointment:", error);

    return NextResponse.json(
      { message: "Failed to delete appointment." },
      { status: 500 }
    );
  }
}

