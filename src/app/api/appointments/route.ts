
import { NextRequest, NextResponse } from "next/server";
import prisma  from "@/lib/prisma";

// GET: Retrieve all appointments
export async function GET() {
  try {
    const appointments = await prisma.appointment.findMany({
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
    const body = await request.json();

    const { patientId, doctorId, startTime, reason } = body;

    // Validate required fields
    if (!patientId || !doctorId || !startTime) {
      return NextResponse.json(
        {
          message: "patientId, doctorId, and startTime are required.",
        },
        { status: 400 }
      );
    }

    // Validate the appointment date
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

    // Check that the patient exists and has the PATIENT role
    const patient = await prisma.user.findUnique({
      where: { id: patientId },
      select: { id: true, role: true },
    });

    if (!patient || patient.role !== "PATIENT") {
      return NextResponse.json(
        { message: "A valid patient account is required." },
        { status: 404 }
      );
    }

    // Check that the doctor exists
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: {
        id: true,
        departmentId: true,
        consultationDurationMinutes: true,
      },
    });

    if (!doctor) {
      return NextResponse.json(
        { message: "Doctor not found." },
        { status: 404 }
      );
    }

    // Calculate the appointment end time
    const end = new Date(
      start.getTime() + doctor.consultationDurationMinutes * 60 * 1000
    );

    // Check whether the doctor already has an overlapping appointment
    const conflictingAppointment = await prisma.appointment.findFirst({
      where: {
        doctorId: doctor.id,
        startTime: { lt: end },
        endTime: { gt: start },
      },
      select: { id: true },
    });

    if (conflictingAppointment) {
      return NextResponse.json(
        { message: "The doctor already has an appointment during that time." },
        { status: 409 }
      );
    }

    // Save the appointment
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
