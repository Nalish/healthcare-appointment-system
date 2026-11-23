
"use client";

import { useEffect, useState } from "react";

interface Notification {
  id: string;
  userId: string;
  appointmentId: string | null;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface NotificationsProps {
  userId: string;
}

export default function Notifications({
  userId,
}: NotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchNotifications = async () => {
    try {
      setError("");

      const response = await fetch(
        `/api/notifications?userId=${encodeURIComponent(userId)}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch notifications.");
      }

      const data: Notification[] = await response.json();

      setNotifications(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [userId]);

  const markAsRead = async (id: string) => {
    try {
      setProcessingId(id);
      setError("");

      const response = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error("Failed to mark notification as read.");
      }

      const updatedNotification: Notification = await response.json();

      setNotifications((previous) =>
        previous.map((notification) =>
          notification.id === id
            ? { ...notification, readAt: updatedNotification.readAt }
            : notification
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setProcessingId(null);
    }
  };

  const deleteNotification = async (id: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this notification?"
    );

    if (!confirmed) return;

    try {
      setProcessingId(id);
      setError("");

      const response = await fetch(`/api/notifications/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete notification.");
      }

      setNotifications((previous) =>
        previous.filter((notification) => notification.id !== id)
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setProcessingId(null);
    }
  };

  const unreadCount = notifications.filter(
    (notification) => !notification.readAt
  ).length;

  if (loading) {
    return <p className="text-gray-500">Loading notifications...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Notifications
        </h1>

        <p className="text-gray-500 mt-1">
          Stay updated with your appointments and other activities.
        </p>
      </div>

      <div className="flex items-center justify-between border-b pb-4">
        <p className="text-sm text-gray-600">
          {unreadCount} unread notification(s)
        </p>

        <button
          onClick={fetchNotifications}
          className="text-sm text-blue-600 hover:underline"
        >
          Refresh
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {notifications.length === 0 ? (
        <div className="border rounded-lg p-10 text-center">
          <h2 className="font-medium text-lg">
            No notifications yet
          </h2>

          <p className="text-gray-500 text-sm mt-2">
            Your notifications will appear here when there are updates.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`border rounded-lg p-5 space-y-3 ${
                notification.readAt
                  ? "bg-white"
                  : "bg-blue-50 border-blue-200"
              }`}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold">
                      {notification.title}
                    </h2>

                    {!notification.readAt && (
                      <span className="text-xs text-blue-600 font-medium">
                        Unread
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-700">
                    {notification.message}
                  </p>
                </div>

                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {new Date(notification.createdAt).toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between items-center flex-wrap gap-3">
                <span className="text-xs text-gray-500">
                  {notification.type.replaceAll("_", " ")}
                </span>

                <div className="flex gap-4 text-sm">
                  {!notification.readAt && (
                    <button
                      onClick={() => markAsRead(notification.id)}
                      disabled={processingId === notification.id}
                      className="text-blue-600 hover:underline disabled:opacity-50"
                    >
                      Mark as read
                    </button>
                  )}

                  <button
                    onClick={() => deleteNotification(notification.id)}
                    disabled={processingId === notification.id}
                    className="text-red-600 hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
