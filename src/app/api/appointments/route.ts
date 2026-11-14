
import { NextRequest, NextResponse } from "next/server";
import prisma  from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";
import { UserRole ,AppointmentStatus} from "@/generated/prisma/client";


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

  const weekday = getPart("weekday");
  const hour = Number(getPart("hour"));
  const minute = Number(getPart("minute"));

  return {
    dayOfWeek: weekdays[weekday],
    minuteOfDay: hour * 60 + minute,
    dateKey: `${getPart("year")}-${getPart("month")}-${getPart("day")}`,
  };
}


// GET: Retrieve appointments according to the user's role
export async function GET() {
  try {
    // Step 1: Authenticate the user and check their role
    const { user, response } = await requireRole([
      UserRole.PATIENT,
      UserRole.DOCTOR,
      UserRole.ADMIN,
    ]);

    if (response) {
      return response;
    }

    // Step 2: Ensure doctors have a doctor profile
    if (user.role === UserRole.DOCTOR && !user.doctorProfile) {
      return NextResponse.json(
        { message: "Doctor profile not found." },
        { status: 403 }
      );
    }

    // Step 3: Apply role-specific appointment filtering
    const where =
      user.role === UserRole.PATIENT
        ? { patientId: user.id }
        : user.role === UserRole.DOCTOR
          ? { doctorId: user.doctorProfile!.id }
          : {};

    // Step 4: Retrieve authorized appointments
    const appointments = await prisma.appointment.findMany({
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
      orderBy: {
        startTime: "asc",
      },
    });

    return NextResponse.json(appointments, { status: 200 });

  } catch (error) {
    console.error("Error fetching appointments:", error);

    return NextResponse.json(
      { message: "Failed to fetch appointments." },
      { status: 500 }
    );
  }
}


// POST: Create a new appointment
export async function POST(request: NextRequest) {
  try {
    // Step 1: Authenticate and authorize the requester
    const { user, response } = await requireRole([
      UserRole.PATIENT,
      UserRole.ADMIN,
    ]);

    if (response) {
      return response;
    }

    // Step 2: Read request body
    const body = await request.json();

    const { doctorId, startTime, reason } = body;

    // Step 3: Validate required fields
    if (!doctorId || !startTime) {
      return NextResponse.json(
        { message: "doctorId and startTime are required." },
        { status: 400 }
      );
    }

    // Step 4: Determine the patient
    // Patients use their own ID; admins can specify a patient ID.
    const patientId =
      user.role === UserRole.ADMIN ? body.patientId : user.id;

    if (!patientId) {
      return NextResponse.json(
        { message: "patientId is required for administrators." },
        { status: 400 }
      );
    }

    // Step 5: Validate appointment date
    const start = new Date(startTime);

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

    // Step 6: Verify patient exists and has the PATIENT role
    const patient = await prisma.user.findFirst({
      where: {
        id: patientId,
        role: UserRole.PATIENT,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!patient) {
      return NextResponse.json(
        { message: "A valid active patient account is required." },
        { status: 404 }
      );
    }

    // Step 7: Verify doctor exists
    const doctor = await prisma.doctor.findFirst({
      where: {
        id: doctorId,
        user: {
          isActive: true,
          role: UserRole.DOCTOR,
        },
      },
      select: {
        id: true,
        consultationDurationMinutes: true,
      },
    });

    if (!doctor) {
      return NextResponse.json(
        { message: "Active doctor not found." },
        { status: 404 }
      );
    }

    // Step 8: Calculate appointment end time
    const end = new Date(
      start.getTime() + doctor.consultationDurationMinutes * 60 * 1000
    );
    // Step 9: Check the doctor's availability schedule

const startParts = getNairobiTimeParts(start);
const endParts = getNairobiTimeParts(end);

// Ensure the appointment does not cross into another day
if (startParts.dateKey !== endParts.dateKey) {
  return NextResponse.json(
    {
      message: "The appointment must fit within one availability period.",
    },
    { status: 400 }
  );
}

// Find an active availability period that contains the appointment
const availableSlot = await prisma.availability.findFirst({
  where: {
    doctorId: doctor.id,
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

    // Step 9: Check for overlapping appointments
// Step 10: Check for overlapping active appointments
const conflictingAppointment = await prisma.appointment.findFirst({
  where: {
    doctorId: doctor.id,
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

if (conflictingAppointment) {
  return NextResponse.json(
    {
      message: "The doctor already has an appointment during that time.",
    },
    { status: 409 }
  );
}

    // Step 10: Create appointment
    const appointment = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        startTime: start,
        endTime: end,
        reason: reason || null,
      },
    });

    return NextResponse.json(appointment, { status: 201 });

  } catch (error) {
    console.error("Error creating appointment:", error);

    return NextResponse.json(
      { message: "Failed to create appointment." },
      { status: 500 }
    );
  }
}

