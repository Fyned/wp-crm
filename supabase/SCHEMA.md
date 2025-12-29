# Database Schema Documentation

## Overview

This database implements a **hierarchical RBAC** (Role-Based Access Control) system with **Row Level Security** for a corporate WhatsApp CRM platform.

## Entity Relationship Diagram

```
┌─────────────┐
│ auth.users  │ (Supabase Auth)
└──────┬──────┘
       │
       ├──────────────────────────────────┐
       │                                  │
       ▼                                  ▼
┌─────────────┐                    ┌─────────────┐
│  profiles   │                    │  sessions   │
│ (users)     │                    │ (WhatsApp)  │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │ created_by_admin_id              │ created_by_admin_id
       │                                  │
       ├──────────┬──────────────┐        │
       │          │              │        │
       ▼          ▼              ▼        ▼
┌──────────┐ ┌─────────┐  ┌──────────────────┐
│  teams   │ │team_mem-│  │session_assign-   │
│          │ │bers     │  │ments             │
└────┬─────┘ └────┬────┘  └────┬─────────────┘
     │            │             │
     │            │             ├──> assigned_to_user_id
     │            │             └──> assigned_to_team_id
     │            │
     └────────────┼─────────────┐
                  │             │
                  ▼             ▼
            ┌──────────┐  ┌──────────┐
            │contacts  │  │ messages │
            │          │◄─┤          │
            └──────────┘  └────┬─────┘
                               │
                               ▼
                          ┌──────────┐
                          │media_    │
                          │files     │
                          └──────────┘
```

## Tables

### 1. profiles
User profiles with hierarchical ownership.

| Column               | Type      | Description                                    |
|---------------------|-----------|------------------------------------------------|
| id                  | UUID (PK) | References auth.users(id)                      |
| username            | TEXT      | Unique username                                |
| full_name           | TEXT      | Full name (optional)                           |
| role                | ENUM      | super_admin \| admin \| team_member            |
| created_by_admin_id | UUID (FK) | Who created this user (NULL for super admins)  |
| is_active           | BOOLEAN   | Account status                                 |
| last_login_at       | TIMESTAMP | Last login time                                |

**Hierarchy Rules:**
- Super Admin: `created_by_admin_id` = NULL
- Admin: Created by Super Admin
- Team Member: Created by Admin

### 2. teams
Organizational teams created by admins.

| Column               | Type      | Description                     |
|---------------------|-----------|---------------------------------|
| id                  | UUID (PK) | Unique identifier               |
| name                | TEXT      | Team name                       |
| description         | TEXT      | Team description                |
| created_by_admin_id | UUID (FK) | Admin who created this team     |
| is_active           | BOOLEAN   | Team status                     |

### 3. team_members
Many-to-many relationship between users and teams.

| Column   | Type      | Description           |
|----------|-----------|-----------------------|
| id       | UUID (PK) | Unique identifier     |
| team_id  | UUID (FK) | References teams(id)  |
| user_id  | UUID (FK) | References profiles(id)|

### 4. sessions
WhatsApp session instances (phone numbers).

| Column                   | Type      | Description                        |
|-------------------------|-----------|------------------------------------|
| id                      | UUID (PK) | Unique identifier                  |
| session_name            | TEXT      | WAHA session identifier (unique)   |
| phone_number            | TEXT      | WhatsApp phone number              |
| status                  | ENUM      | DISCONNECTED \| CONNECTING \| CONNECTED \| FAILED |
| last_connected_at       | TIMESTAMP | Last connection time               |
| last_message_timestamp  | TIMESTAMP | Last message received (for sync)   |
| created_by_admin_id     | UUID (FK) | Admin who created this session     |
| waha_metadata           | JSONB     | Additional WAHA data               |

### 5. session_assignments
Assigns sessions to users or teams.

| Column                | Type      | Description                          |
|----------------------|-----------|--------------------------------------|
| id                   | UUID (PK) | Unique identifier                    |
| session_id           | UUID (FK) | References sessions(id)              |
| assigned_to_user_id  | UUID (FK) | Direct user assignment (nullable)    |
| assigned_to_team_id  | UUID (FK) | Team assignment (nullable)           |
| assigned_by_admin_id | UUID (FK) | Admin who made the assignment        |

**Constraint:** Must assign to EITHER user OR team, not both.

### 6. contacts
Contact information per session.

| Column             | Type      | Description                     |
|-------------------|-----------|---------------------------------|
| id                | UUID (PK) | Unique identifier               |
| session_id        | UUID (FK) | References sessions(id)         |
| phone_number      | TEXT      | Contact's phone number          |
| name              | TEXT      | Contact name                    |
| is_group          | BOOLEAN   | Is this a group chat?           |
| profile_pic_url   | TEXT      | Profile picture URL             |
| whatsapp_metadata | JSONB     | Additional WhatsApp data        |

**Unique:** (session_id, phone_number)

### 7. messages
Full message archive.

| Column             | Type      | Description                        |
|-------------------|-----------|------------------------------------|
| id                | UUID (PK) | Unique identifier                  |
| session_id        | UUID (FK) | References sessions(id)            |
| contact_id        | UUID (FK) | References contacts(id)            |
| waha_message_id   | TEXT      | Message ID from WAHA               |
| message_type      | ENUM      | text \| image \| video \| audio \| document... |
| body              | TEXT      | Message text content               |
| from_me           | BOOLEAN   | Sent by us?                        |
| ack               | ENUM      | PENDING \| SERVER \| DEVICE \| READ \| PLAYED |
| has_media         | BOOLEAN   | Contains media?                    |
| media_url         | TEXT      | Media file URL                     |
| media_mimetype    | TEXT      | Media MIME type                    |
| media_size        | BIGINT    | Media file size (bytes)            |
| quoted_message_id | UUID (FK) | Reply to message                   |
| timestamp         | TIMESTAMP | Message timestamp                  |
| raw_payload       | JSONB     | Original WAHA payload              |

**Unique:** (session_id, waha_message_id)

### 8. media_files
Tracks media files uploaded to Supabase Storage.

| Column         | Type      | Description                        |
|---------------|-----------|------------------------------------|
| id            | UUID (PK) | Unique identifier                  |
| message_id    | UUID (FK) | References messages(id)            |
| storage_bucket| TEXT      | Supabase Storage bucket name       |
| storage_path  | TEXT      | Path in bucket                     |
| filename      | TEXT      | Original filename                  |
| mimetype      | TEXT      | MIME type                          |
| size_bytes    | BIGINT    | File size                          |
| uploaded      | BOOLEAN   | Upload successful?                 |
| upload_error  | TEXT      | Error message (if failed)          |

### 9. sync_logs
Tracks message synchronization operations.

| Column            | Type      | Description                    |
|-------------------|-----------|--------------------------------|
| id                | UUID (PK) | Unique identifier              |
| session_id        | UUID (FK) | References sessions(id)        |
| sync_type         | TEXT      | initial \| gap_fill \| manual  |
| messages_synced   | INTEGER   | Number of messages synced      |
| from_timestamp    | TIMESTAMP | Sync start time                |
| to_timestamp      | TIMESTAMP | Sync end time                  |
| status            | TEXT      | started \| completed \| failed |
| error_message     | TEXT      | Error (if failed)              |
| started_at        | TIMESTAMP | When sync started              |
| completed_at      | TIMESTAMP | When sync completed            |

## Row Level Security (RLS)

All tables have RLS enabled with the following policies:

### Super Admin
- **Can see and modify EVERYTHING**

### Admin
- Can only see users they created (`created_by_admin_id = auth.uid()`)
- Can only see teams they created
- Can only see sessions they created
- Can create Team Members (not other Admins)

### Team Member
- Can only see their own profile
- Can only see sessions assigned to them or their teams
- Can view/send messages only in assigned sessions
- **Cannot create users or teams**

## Helper Functions

### `user_can_access_session(session_id, user_id)`
Returns TRUE if the user can access the session (via direct assignment or team membership).

### `get_admin_hierarchy(user_id)`
Returns all users in the admin's hierarchy (recursive).

### `ensure_contact_exists(session_id, phone_number, name, is_group)`
Creates or updates a contact, returns contact_id.

### `get_chat_list(session_id)`
Returns all chats for a session with last message and unread count.

### `get_chat_messages(session_id, contact_id, limit, offset)`
Returns paginated messages for a specific chat.

### `mark_messages_read(session_id, contact_id)`
Marks all unread messages as read, returns count.

### `search_messages(session_id, search_query, limit)`
Full-text search across messages.

### `get_session_stats(session_id)`
Returns statistics (total messages, contacts, unread, etc.).

## Triggers

### `on_auth_user_created`
Automatically creates a profile when a user is added to auth.users.

### `on_message_insert_update_session`
Updates `sessions.last_message_timestamp` when a new message arrives.

## Indexes

All foreign keys and frequently queried columns are indexed for optimal performance:

- `profiles.role`, `profiles.created_by_admin_id`, `profiles.username`
- `sessions.status`, `sessions.session_name`, `sessions.last_message_timestamp`
- `messages.timestamp`, `messages.session_id`, `messages.contact_id`, `messages.from_me`
- And many more...

## Storage Bucket

### `whatsapp-media`
- **Private bucket** for storing message media
- RLS policies ensure users can only access media from their assigned sessions

---

**Last Updated:** 2025-12-29
**Schema Version:** 1.0.0
