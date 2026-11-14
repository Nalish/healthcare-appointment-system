import { NextRequest, NextResponse } from "next/server";
import  prisma  from "@/lib/prisma";
import { AppointmentStatus } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/authorization";
import { UserRole } from "@/generated/prisma/client";

function getNairobiTimeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const weekdays: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  const hour = Number(getPart("hour"));
  const minute = Number(getPart("minute"));

  return {
    dayOfWeek: weekdays[getPart("weekday")],
    minuteOfDay: hour * 60 + minute,
    dateKey: `${getPart("year")}-${getPart("month")}-${getPart("day")}`,
  };
}

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
// PATCH: Update an appointment with role-based authorization
export async function PATCH(
  request: NextRequest,
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

    // Step 2: Validate request body
    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { message: "Invalid request body." },
        { status: 400 }
      );
    }

    const { startTime, status, reason } = body as {
      startTime?: unknown;
      status?: unknown;
      reason?: unknown;
    };

    // Step 3: Verify doctor profile
    if (user.role === UserRole.DOCTOR && !user.doctorProfile) {
      return NextResponse.json(
        { message: "Doctor profile not found." },
        { status: 403 }
      );
    }

    // Step 4: Retrieve appointment with ownership conditions
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

    // Step 5: Prevent updates to final appointments
    if (
      existingAppointment.status === AppointmentStatus.COMPLETED ||
      existingAppointment.status === AppointmentStatus.CANCELLED
    ) {
      return NextResponse.json(
        { message: "This appointment can no longer be updated." },
        { status: 400 }
      );
    }

    // Step 6: Validate requested status
    if (
      status !== undefined &&
      (typeof status !== "string" ||
        !Object.values(AppointmentStatus).includes(
          status as AppointmentStatus
        ))
    ) {
      return NextResponse.json(
        { message: "Invalid appointment status." },
        { status: 400 }
      );
    }

    const requestedStatus = status as AppointmentStatus | undefined;

    // Step 7: Validate reason
    if (
      reason !== undefined &&
      reason !== null &&
      typeof reason !== "string"
    ) {
      return NextResponse.json(
        { message: "Reason must be a string or null." },
        { status: 400 }
      );
    }

    if (typeof reason === "string" && reason.length > 1000) {
      return NextResponse.json(
        { message: "Reason cannot exceed 1000 characters." },
        { status: 400 }
      );
    }

    // Step 8: Enforce role-specific status permissions
    if (requestedStatus !== undefined) {
      const allowedStatuses: Record<string, string[]> = {
        PATIENT: ["CANCELLED"],
        DOCTOR: ["CONFIRMED", "CANCELLED", "COMPLETED"],
        ADMIN: ["CONFIRMED", "CANCELLED", "COMPLETED"],
      };

      if (!allowedStatuses[user.role].includes(requestedStatus)) {
        return NextResponse.json(
          { message: "You are not permitted to perform this status change." },
          { status: 403 }
        );
      }

      const validTransitions: Record<string, string[]> = {
        PENDING: ["CONFIRMED", "CANCELLED"],
        CONFIRMED: ["CANCELLED", "COMPLETED"],
      };

      if (
        !validTransitions[existingAppointment.status].includes(
          requestedStatus
        )
      ) {
        return NextResponse.json(
          { message: "This status transition is not allowed." },
          { status: 400 }
        );
      }
    }

    // Step 9: Determine new appointment start time
    let start = existingAppointment.startTime;

    if (startTime !== undefined) {
      if (typeof startTime !== "string" || startTime.trim() === "") {
        return NextResponse.json(
          { message: "startTime must be a valid date string." },
          { status: 400 }
        );
      }

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

    // Restrict rescheduling and reason updates to administrators
if (
  user.role !== UserRole.ADMIN &&
  (startTime !== undefined || reason !== undefined)
) {
  return NextResponse.json(
    {
      message: "Only administrators can reschedule appointments or edit their reason.",
    },
    { status: 403 }
  );
}

    // Step 10: Calculate appointment end time
    const end =
      startTime !== undefined
        ? new Date(
            start.getTime() +
              existingAppointment.doctor.consultationDurationMinutes *
                60 *
                1000
          )
        : existingAppointment.endTime;

    // Step 11: Check doctor availability when rescheduling
    if (startTime !== undefined) {
      const startParts = getNairobiTimeParts(start);
      const endParts = getNairobiTimeParts(end);

      if (startParts.dateKey !== endParts.dateKey) {
        return NextResponse.json(
          {
            message: "The appointment must fit within one availability period.",
          },
          { status: 400 }
        );
      }

      const availableSlot = await prisma.availability.findFirst({
        where: {
          doctorId: existingAppointment.doctorId,
          dayOfWeek: startParts.dayOfWeek,
          isActive: true,
          startMinute: {
            lte: startParts.minuteOfDay,
          },
          endMinute: {
            gte: endParts.minuteOfDay,
          },
        },
      });

      if (!availableSlot) {
        return NextResponse.json(
          {
            message: "The doctor is not available during the requested time.",
          },
          { status: 409 }
        );
      }
    }

    // Step 12: Check for overlapping appointments
    if (startTime !== undefined) {
      const conflict = await prisma.appointment.findFirst({
        where: {
          id: { not: id },
          doctorId: existingAppointment.doctorId,
          status: {
            not: AppointmentStatus.CANCELLED,
          },
          startTime: { lt: end },
          endTime: { gt: start },
        },
        select: {
          id: true,
        },
      });

      if (conflict) {
        return NextResponse.json(
          {
            message: "The doctor already has an appointment during that time.",
          },
          { status: 409 }
        );
      }
    }

    // Step 13: Update appointment
    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: {
        ...(startTime !== undefined && {
          startTime: start,
          endTime: end,
        }),
        ...(requestedStatus !== undefined && {
          status: requestedStatus,
        }),
        ...(reason !== undefined && {
          reason: reason as string | null,
        }),
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

