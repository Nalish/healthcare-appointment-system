
import { NextRequest, NextResponse } from "next/server";
import  prisma  from "@/lib/prisma";
import { AppointmentStatus } from "@/generated/prisma/enums";

// GET: Retrieve one appointment
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
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

// PATCH: Update an appointment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { startTime, status, reason } = body;

    const existingAppointment = await prisma.appointment.findUnique({
      where: { id },
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

    if (existingAppointment.status === "COMPLETED") {
      return NextResponse.json(
        { message: "A completed appointment cannot be updated." },
        { status: 400 }
      );
    }

    if (existingAppointment.status === "CANCELLED") {
      return NextResponse.json(
        { message: "A cancelled appointment cannot be updated." },
        { status: 400 }
      );
    }

    // Validate the requested status
    if (
      status !== undefined &&
      !Object.values(AppointmentStatus).includes(status)
    ) {
      return NextResponse.json(
        { message: "Invalid appointment status." },
        { status: 400 }
      );
    }

    // Determine the new start time
    let start = existingAppointment.startTime;

    if (startTime !== undefined) {
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

    // Recalculate end time if the appointment is rescheduled
    const end =
      startTime !== undefined
        ? new Date(
            start.getTime() +
              existingAppointment.doctor.consultationDurationMinutes *
                60 *
                1000
          )
        : existingAppointment.endTime;

    // Check conflicts when rescheduling
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

// DELETE: Delete an appointment
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!appointment) {
      return NextResponse.json(
        { message: "Appointment not found." },
        { status: 404 }
      );
    }

    if (appointment.status === "COMPLETED") {
      return NextResponse.json(
        { message: "Completed appointments cannot be deleted." },
        { status: 400 }
      );
    }

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
