# Stage 1

## Campus Notification System — REST API Design

### Overview

This document defines the REST API contract for a campus notification platform. Students receive real-time updates for **Placements**, **Events**, and **Results**. The API is designed for a backend service consumed by a frontend client (web/mobile).

---

### Base URL

```
https://api.campus-notify.com/v1
```

---

### Authentication

All routes (except `/auth`) require a Bearer token in the `Authorization` header.

```
Authorization: Bearer <access_token>
```

---

### Common Headers

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `Authorization` | `Bearer <token>` |
| `X-Request-ID` | UUID (optional, for tracing) |

---

### Notification Types

| Type | Description |
|------|-------------|
| `Placement` | Company hiring drives and placement updates |
| `Event` | Campus events (fests, workshops, seminars) |
| `Result` | Exam results, project reviews, mid-sem, end-sem |

---

## Endpoints

---

### 1. Get All Notifications for a Student

Fetches all notifications for the authenticated student, with optional filters.

```
GET /notifications
```

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | No | Filter by type: `Placement`, `Event`, `Result` |
| `isRead` | boolean | No | Filter by read status |
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 20, max: 100) |

**Request Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "d146095a-0d86-4a34-9e69-3900a14576bc",
        "type": "Placement",
        "message": "Google hiring drive on 2026-05-15",
        "isRead": false,
        "createdAt": "2026-04-22T17:51:30Z"
      }
    ],
    "pagination": {
      "total": 120,
      "page": 1,
      "limit": 20,
      "totalPages": 6
    }
  }
}
```

---

### 2. Get Single Notification

```
GET /notifications/:id
```

**Path Params:**

| Param | Type | Description |
|-------|------|-------------|
| `id` | UUID | Notification ID |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "d146095a-0d86-4a34-9e69-3900a14576bc",
    "type": "Result",
    "message": "mid-sem results published",
    "isRead": true,
    "createdAt": "2026-04-22T17:51:30Z",
    "readAt": "2026-04-22T18:00:00Z"
  }
}
```

---

### 3. Mark Notification as Read

```
PATCH /notifications/:id/read
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "id": "d146095a-0d86-4a34-9e69-3900a14576bc",
    "isRead": true,
    "readAt": "2026-04-22T18:05:00Z"
  }
}
```

---

### 4. Mark All Notifications as Read

```
PATCH /notifications/read-all
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "All notifications marked as read",
  "data": {
    "updatedCount": 15
  }
}
```

---

### 5. Get Unread Notification Count

```
GET /notifications/unread-count
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "unreadCount": 8,
    "byType": {
      "Placement": 3,
      "Event": 2,
      "Result": 3
    }
  }
}
```

---

### 6. Send Notification (Admin only)

```
POST /notifications/send
```

**Request Body:**
```json
{
  "studentIds": ["1042", "1043"],
  "type": "Placement",
  "message": "Amazon hiring drive on 2026-05-20",
  "channels": ["in-app", "email"]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Notification queued for delivery",
  "data": {
    "jobId": "job-abc123",
    "recipientCount": 2
  }
}
```

---

### 7. Send Bulk Notification to All Students (Admin only)

```
POST /notifications/broadcast
```

**Request Body:**
```json
{
  "type": "Event",
  "message": "Annual Tech Fest on 2026-06-01",
  "channels": ["in-app", "email"]
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "message": "Broadcast job accepted",
  "data": {
    "jobId": "job-xyz789",
    "estimatedRecipients": 50000
  }
}
```

---

### 8. Delete a Notification

```
DELETE /notifications/:id
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Notification deleted"
}
```

---

### 9. Real-Time Notifications (WebSocket / SSE)

For real-time delivery, the platform supports **Server-Sent Events (SSE)**:

```
GET /notifications/stream
```

**Headers:**
```
Authorization: Bearer <token>
Accept: text/event-stream
```

**Stream Events:**
```
event: notification
data: {"id":"abc","type":"Placement","message":"TCS hiring open","createdAt":"2026-05-08T10:00:00Z"}

event: ping
data: {"timestamp":"2026-05-08T10:00:30Z"}
```

SSE is preferred over WebSockets for this use case because:
- Notifications are **server → client only** (unidirectional)
- SSE reconnects automatically
- Works over standard HTTP/2

---

### Error Responses

All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authorization token is missing or invalid"
  }
}
```

| HTTP Status | Code | Meaning |
|-------------|------|---------|
| 400 | `BAD_REQUEST` | Invalid input or missing fields |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server-side failure |

---

### JSON Schema — Notification Object

```json
{
  "$schema": "http://json-schema.org/draft-07/schema",
  "type": "object",
  "required": ["id", "type", "message", "isRead", "createdAt"],
  "properties": {
    "id":        { "type": "string", "format": "uuid" },
    "type":      { "type": "string", "enum": ["Placement", "Event", "Result"] },
    "message":   { "type": "string", "minLength": 1, "maxLength": 500 },
    "isRead":    { "type": "boolean" },
    "createdAt": { "type": "string", "format": "date-time" },
    "readAt":    { "type": ["string", "null"], "format": "date-time" }
  }
}
```

---

*End of Stage 1*