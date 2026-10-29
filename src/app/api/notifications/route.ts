
import { NextRequest, NextResponse } from "next/server";
import  prisma  from "@/lib/prisma";
import { NotificationType } from "@/generated/prisma/enums";



// GET: List notifications for a user
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { message: "userId is required." },
        { status: 400 }
      );
    }

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(notifications, { status: 200 });
  } catch (error) {
    console.error("Error fetching notifications:", error);

    return NextResponse.json(
      { message: "Failed to fetch notifications." },
      { status: 500 }
    );
  }
}

// POST: Create a notification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    

    const { userId, appointmentId, type, title, message } = body;

    if (!userId || !type || !title || !message) {
      return NextResponse.json(
        {
          message: "userId, type, title, and message are required.",
        },
        { status: 400 }
      );
    }

if (
  typeof type !== "string" ||
  !Object.values(NotificationType).includes(
    type as NotificationType
  )
) {  {
      return NextResponse.json(
        { message: "Invalid notification type." },
        { status: 400 }
      );
    }

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof message !== "string" ||
      !message.trim()
    ) {
      return NextResponse.json(
        { message: "title and message must be non-empty strings." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { message: "User not found." },
        { status: 404 }
      );
    }

    if (appointmentId !== undefined && appointmentId !== null) {
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { id: true },
      });

      if (!appointment) {
        return NextResponse.json(
          { message: "Appointment not found." },
          { status: 404 }
        );
      }
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        appointmentId: appointmentId ?? null,
        type,
        title: title.trim(),
        message: message.trim(),
      },
    });

    return NextResponse.json(notification, { status: 201 });
    } }catch (error) {
    console.error("Error creating notification:", error);

    return NextResponse.json(
      { message: "Failed to create notification." },
      { status: 500 }
    );
  }
}
