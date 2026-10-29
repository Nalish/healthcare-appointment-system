
import { NextRequest, NextResponse } from "next/server";
import  prisma  from "@/lib/prisma";

// PATCH: Mark a notification as read
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existingNotification = await prisma.notification.findUnique({
      where: { id },
      select: { id: true, readAt: true },
    });

    if (!existingNotification) {
      return NextResponse.json(
        { message: "Notification not found." },
        { status: 404 }
      );
    }

    // If already read, return it without changing readAt
    if (existingNotification.readAt) {
      return NextResponse.json(existingNotification, { status: 200 });
    }

    const notification = await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });

    return NextResponse.json(notification, { status: 200 });
  } catch (error) {
    console.error("Error marking notification as read:", error);

    return NextResponse.json(
      { message: "Failed to mark notification as read." },
      { status: 500 }
    );
  }
}

// DELETE: Delete a notification
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existingNotification = await prisma.notification.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingNotification) {
      return NextResponse.json(
        { message: "Notification not found." },
        { status: 404 }
      );
    }

    await prisma.notification.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "Notification deleted successfully." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting notification:", error);

    return NextResponse.json(
      { message: "Failed to delete notification." },
      { status: 500 }
    );
  }
}
