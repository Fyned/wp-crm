# Backend API Documentation

Base URL: `https://api.yourdomain.com/api`

---

## 🔐 Authentication

All protected endpoints require Bearer token authentication:

```http
Authorization: Bearer <access_token>
```

---

## Auth Endpoints

### POST /auth/login

Login with username and password.

**Request:**
```json
{
  "username": "admin",
  "password": "SecurePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "admin",
      "role": "super_admin"
    },
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "expires_at": 1234567890
  }
}
```

---

### GET /auth/me

Get current user profile.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "admin",
    "full_name": "Admin User",
    "role": "super_admin",
    "is_active": true,
    "last_login_at": "2025-01-01T12:00:00Z",
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

---

## User Management (Admin Only)

### POST /users

Create a new user.

**Request:**
```json
{
  "username": "john_doe",
  "password": "SecurePass123",
  "full_name": "John Doe",
  "role": "team_member"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "john_doe",
    "full_name": "John Doe",
    "role": "team_member",
    "created_at": "2025-01-01T12:00:00Z"
  }
}
```

---

### GET /users

List all users (filtered by admin hierarchy).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "username": "john_doe",
      "full_name": "John Doe",
      "role": "team_member",
      "is_active": true,
      "last_login_at": "2025-01-01T12:00:00Z",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

### POST /users/:userId/reset-password

Reset user password.

**Request:**
```json
{
  "new_password": "NewSecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

---

## Session Management

### POST /sessions

Create a new WhatsApp session.

**Request:**
```json
{
  "session_name": "sales-team-01"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "session_name": "sales-team-01",
    "status": "DISCONNECTED",
    "created_at": "2025-01-01T12:00:00Z"
  }
}
```

---

### GET /sessions

List all accessible sessions.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "session_name": "sales-team-01",
      "phone_number": "+1234567890",
      "status": "CONNECTED",
      "last_connected_at": "2025-01-01T12:00:00Z",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

### GET /sessions/:sessionId/qr

Get QR code for session authentication.

**Response:** PNG image (binary)

---

### POST /sessions/:sessionId/pairing-code

Request pairing code for phone number linking.

**Request:**
```json
{
  "phone_number": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "code": "ABC123",
    "phone_number": "+1234567890"
  }
}
```

---

### POST /sessions/:sessionId/assign

Assign session to user or team.

**Request (Assign to user):**
```json
{
  "assigned_to_user_id": "user-uuid"
}
```

**Request (Assign to team):**
```json
{
  "assigned_to_team_id": "team-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "session_id": "session-uuid",
    "assigned_to_user_id": "user-uuid",
    "assigned_at": "2025-01-01T12:00:00Z"
  }
}
```

---

## Messaging

### GET /sessions/:sessionId/chats

Get all chats for a session.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "contact_id": "uuid",
      "phone_number": "+1234567890",
      "name": "John Customer",
      "last_message_body": "Hello!",
      "last_message_timestamp": "2025-01-01T12:00:00Z",
      "last_message_from_me": false,
      "unread_count": 3
    }
  ]
}
```

---

### GET /sessions/:sessionId/contacts/:contactId/messages

Get messages for a specific chat.

**Query Parameters:**
- `limit` (default: 50)
- `offset` (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "waha_message_id": "msg-123",
      "message_type": "text",
      "body": "Hello!",
      "from_me": false,
      "ack": "READ",
      "timestamp": "2025-01-01T12:00:00Z"
    }
  ]
}
```

---

### POST /sessions/:sessionId/messages

Send a message.

**Request:**
```json
{
  "phone_number": "+1234567890",
  "message": "Hello, how can I help you?"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message_id": "msg-123",
    "timestamp": 1234567890
  }
}
```

---

### POST /sessions/:sessionId/contacts/:contactId/read

Mark messages as read.

**Response:**
```json
{
  "success": true,
  "data": {
    "marked_count": 5
  }
}
```

---

### GET /sessions/:sessionId/search

Search messages.

**Query Parameters:**
- `q` (required): Search query

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "contact_id": "uuid",
      "contact_name": "John",
      "body": "Message containing search term",
      "timestamp": "2025-01-01T12:00:00Z",
      "from_me": false
    }
  ]
}
```

---

## Webhooks

### POST /webhooks/waha

WAHA webhook endpoint (internal use only).

**Webhook Events:**
- `message` - New message received
- `message.ack` - Message acknowledgment updated
- `session.status` - Session status changed

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error Type",
  "message": "Detailed error message"
}
```

**Common Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error
