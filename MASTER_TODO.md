# WhatsApp CRM - Master TODO List & Implementation Plan

## 📋 System Analysis (Current State)

### ✅ What's Working:
1. **Database Schema** - Complete RBAC structure (super_admin, admin, team_member)
2. **Authentication** - Login, JWT tokens, refresh tokens
3. **Basic User Management** - Create users, deactivate, reset password
4. **Session Management** - Create sessions, connect via QR/pairing code
5. **Message Sync** - Initial sync (last N messages), Gap-fill sync (all missed messages)
6. **Chat Interface** - 3-column layout (sessions, chats, messages)
7. **Webhooks** - Evolution API webhook handling
8. **Media Support** - Download and display media files

### ❌ Critical Bugs Found:
1. **Evolution API v1.8.4 Bug** - Message filtering doesn't work (FIXED in commit 01cb7f8)
2. **pushName Contact Corruption** - Contact names overwritten by wrong names (FIXED in commit 01cb7f8)
3. **Session Reconnection** - Not working properly when session disconnects
4. **No Sender Info in Groups** - Group messages don't show who sent them (FIXED in commit 9918b3e)

### ❌ Missing Features (High Priority):
1. **Team Management System** - No UI/API to create/manage teams
2. **Session Assignment** - No UI to assign sessions to users/teams
3. **Role-Based Access** - Users see ALL sessions (should only see assigned ones)
4. **Email Field** - Users don't have email addresses
5. **Help/Tutorial System** - No onboarding or help for users
6. **Message Archiving** - No way to archive conversations
7. **Super Admin Dashboard** - No overview of all teams, sessions, users
8. **Password Management** - Users can't change passwords themselves
9. **Contact Management** - No tags, notes, importance levels working

---

## 🎯 Implementation Plan (10 Phases)

---

## **PHASE 1: Bug Fixes & Stabilization**
**Goal:** Fix all critical bugs and stabilize existing features

### Tasks:
- [x] Fix Evolution API message filtering bug (client-side workaround)
- [x] Remove ALL pushName usage from contact updates
- [x] Add sender info to group messages
- [ ] Fix session reconnection logic
- [ ] Test message sync with real data
- [ ] Fix media download issues (if any)
- [ ] Add proper error handling to all API calls

**Deliverables:**
- Stable message sync
- Reliable session connection/reconnection
- Correct contact names
- Group messages show sender info

---

## **PHASE 2: Team Management Backend**
**Goal:** Build complete team management API

### 2.1 Create Team Controller (`backend/src/controllers/teamController.js`)

**Endpoints:**
```javascript
POST   /api/teams                    // Create team (admin only)
GET    /api/teams                    // Get my teams
GET    /api/teams/:teamId            // Get team details
PUT    /api/teams/:teamId            // Update team
DELETE /api/teams/:teamId            // Delete team (admin only)

POST   /api/teams/:teamId/members    // Add member to team
DELETE /api/teams/:teamId/members/:userId  // Remove member
GET    /api/teams/:teamId/members    // Get team members
```

### 2.2 Create Team Service (`backend/src/services/teamService.js`)

**Functions:**
- `createTeam(adminId, { name, description })`
- `getTeamsByAdmin(adminId)` - Get teams created by admin
- `getTeamById(teamId, userId)` - Get team with permission check
- `updateTeam(teamId, updates, userId)`
- `deleteTeam(teamId, userId)` - Soft delete
- `addMemberToTeam(teamId, userId, adminId)`
- `removeMemberFromTeam(teamId, userId, adminId)`
- `getTeamMembers(teamId)`
- `getUserTeams(userId)` - Get all teams user belongs to

### 2.3 Validation Middleware
- Validate team creation (name length, etc.)
- Validate team member addition
- Check permissions (only admin can manage their teams)

### 2.4 Database Functions (if needed)
```sql
-- Get teams with member count
CREATE FUNCTION get_teams_with_stats(admin_uuid UUID)
...

-- Check if user can manage team
CREATE FUNCTION user_can_manage_team(team_uuid UUID, user_uuid UUID)
...
```

**Deliverables:**
- Complete team CRUD API
- Team member management API
- Proper permission checks
- Database functions for complex queries

---

## **PHASE 3: Team Management Frontend**
**Goal:** Build UI for team management

### 3.1 Create TeamManagementPage (`frontend/src/pages/TeamManagementPage.jsx`)

**Features:**
- List all teams created by admin
- Create new team button
- Edit team (name, description)
- Delete team
- View team members
- Add/remove members from team

### 3.2 Create Team Components
- `TeamList.jsx` - Display all teams
- `TeamCard.jsx` - Individual team card
- `CreateTeamModal.jsx` - Modal to create team
- `EditTeamModal.jsx` - Modal to edit team
- `TeamMembersModal.jsx` - View and manage team members
- `AddMemberModal.jsx` - Add users to team

### 3.3 Update API Service (`frontend/src/services/api.js`)
```javascript
export const teamAPI = {
  getTeams: () => axios.get('/teams'),
  createTeam: (data) => axios.post('/teams', data),
  updateTeam: (teamId, data) => axios.put(`/teams/${teamId}`, data),
  deleteTeam: (teamId) => axios.delete(`/teams/${teamId}`),
  getTeamMembers: (teamId) => axios.get(`/teams/${teamId}/members`),
  addMember: (teamId, userId) => axios.post(`/teams/${teamId}/members`, { userId }),
  removeMember: (teamId, userId) => axios.delete(`/teams/${teamId}/members/${userId}`)
};
```

### 3.4 Add Navigation
- Add "Teams" link to sidebar/header
- Update AdminPage to include Teams tab

**Deliverables:**
- Functional team management UI
- Create, edit, delete teams
- Manage team members
- Responsive design matching existing UI

---

## **PHASE 4: Session Assignment System**
**Goal:** Allow admins to assign sessions to users/teams

### 4.1 Backend - Session Assignment API

**Update SessionController:**
```javascript
POST   /api/sessions/:sessionId/assign     // Assign to user OR team
DELETE /api/sessions/:sessionId/assign/:assignmentId  // Unassign
GET    /api/sessions/:sessionId/assignments  // Get all assignments
```

**Functions:**
- `assignSessionToUser(sessionId, userId, adminId)`
- `assignSessionToTeam(sessionId, teamId, adminId)`
- `unassignSession(assignmentId, adminId)`
- `getSessionAssignments(sessionId)`

### 4.2 Frontend - Session Assignment UI

**Create Components:**
- `SessionAssignmentModal.jsx` - Modal to assign session
  - Radio: Assign to User OR Team
  - Dropdown: Select user/team
  - Save button
- Update `SessionsList.jsx` to show assignment status
- Update `SessionModal.jsx` to include assignment UI

**Features:**
- Admin can assign session to:
  - Individual user
  - Entire team
- Show assignment status (Assigned to: Team A, User B)
- Unassign button

### 4.3 Update Session Queries

**Backend:** Filter sessions by assignment:
```sql
-- Get sessions accessible by user
CREATE FUNCTION get_user_sessions(user_uuid UUID)
RETURNS TABLE(...) AS $$
  -- Super admin: all sessions
  -- Admin: sessions they created
  -- Team member: only assigned sessions (direct or via team)
$$;
```

**Frontend:**
- Update `getSessions()` to only return accessible sessions
- Show "No sessions assigned" for team members with no assignments

**Deliverables:**
- Session assignment API
- Assignment UI in frontend
- Filtered session lists based on role

---

## **PHASE 5: Role-Based Access Control (RBAC)**
**Goal:** Enforce permissions - users only see their assigned sessions

### 5.1 Backend Permission Checks

**Update Middlewares:**
```javascript
// backend/src/middlewares/rbac.js
canAccessSession(sessionId, userId)
canManageTeam(teamId, userId)
canCreateUser(creatorRole)
canAssignSession(sessionId, userId)
```

**Apply to Routes:**
- GET /sessions - Filter by accessible sessions
- GET /sessions/:id - Check access before returning
- GET /sessions/:id/chats - Check access
- POST /sessions/:id/messages - Check access
- All team routes - Check if user owns/belongs to team

### 5.2 Frontend Permission Checks

**Create Permission Utilities:**
```javascript
// frontend/src/utils/permissions.js
export const can = {
  createTeam: (user) => ['super_admin', 'admin'].includes(user.role),
  createUser: (user) => ['super_admin', 'admin'].includes(user.role),
  assignSession: (user) => ['super_admin', 'admin'].includes(user.role),
  manageAllSessions: (user) => user.role === 'super_admin',
  deleteSession: (user, session) => user.role === 'super_admin' || session.created_by_admin_id === user.id
};
```

**Hide/Show UI Elements:**
- Show "Create Team" only to admins
- Show "Assign Session" only to admins
- Show "Delete User" only to creator admin
- Show all sessions only to super_admin

### 5.3 Database Row Level Security (Optional - Advanced)

**Enable RLS:**
```sql
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
-- etc...

-- Create policies
CREATE POLICY "Users can see assigned sessions"
ON sessions FOR SELECT
USING (user_can_access_session(id, auth.uid()));
```

**Deliverables:**
- Complete permission system
- Users only access their data
- Admins manage their teams
- Super admins see everything

---

## **PHASE 6: Super Admin Dashboard**
**Goal:** Overview page for super admins to monitor everything

### 6.1 Create SuperAdminDashboard (`frontend/src/pages/SuperAdminDashboardPage.jsx`)

**Sections:**

**1. Statistics Cards:**
- Total Users (admins, team members)
- Total Teams
- Total Sessions (active, disconnected)
- Total Messages Today

**2. Recent Activity:**
- Last logins
- Recent sessions created
- Recent messages sent
- Failed connection attempts

**3. Admin Management:**
- List all admins
- View each admin's teams
- View each admin's created users
- View sessions per admin

**4. System Health:**
- Evolution API status
- Database connection status
- Webhook status
- Sync queue status

**5. All Sessions Overview:**
- List ALL sessions across all admins
- Filter by status, admin, team
- Quick actions: reconnect, delete, view chats

### 6.2 Backend - Super Admin APIs

**Endpoints:**
```javascript
GET /api/admin/stats              // System statistics
GET /api/admin/activity           // Recent activity
GET /api/admin/admins             // List all admins with their hierarchy
GET /api/admin/sessions           // All sessions across all admins
GET /api/admin/health             // System health checks
```

**Deliverables:**
- Super admin dashboard
- System-wide statistics
- Admin hierarchy view
- System health monitoring

---

## **PHASE 7: Help/Tutorial System**
**Goal:** Interactive help system for users

### 7.1 Create Help Components

**Components:**
- `HelpButton.jsx` - Floating help button
- `HelpPanel.jsx` - Slide-in help panel
- `TutorialModal.jsx` - Step-by-step tutorials
- `TooltipGuide.jsx` - Contextual tooltips

### 7.2 Help Content

**Create Help Content File:**
```javascript
// frontend/src/data/helpContent.js
export const helpTopics = {
  gettingStarted: { ... },
  sessions: {
    title: "Managing Sessions",
    sections: [
      {
        title: "Creating a Session",
        content: "...",
        steps: ["Step 1", "Step 2", ...],
        video: "/help/videos/create-session.mp4"
      },
      // ...
    ]
  },
  teams: { ... },
  messaging: { ... },
  // ...
};
```

**Topics to Cover:**
1. **Getting Started**
   - What is WhatsApp CRM?
   - How to log in
   - Dashboard overview

2. **Sessions**
   - Creating a session
   - Connecting via QR code
   - Connecting via pairing code
   - What to do if disconnected

3. **Teams (for Admins)**
   - Creating a team
   - Adding members
   - Assigning sessions to teams

4. **Messaging**
   - Viewing chats
   - Sending messages
   - Viewing media
   - Searching messages

5. **User Management (for Admins)**
   - Creating users
   - Resetting passwords
   - Deactivating users

### 7.3 Interactive Tutorial

**First Login Tutorial:**
- Detect first login
- Show interactive tour:
  1. "Welcome! This is your dashboard..."
  2. "Here are your sessions..." (highlight sessions panel)
  3. "Click here to start chatting..." (highlight chat)
  4. "Need help? Click here!" (highlight help button)

**Use library:** react-joyride or intro.js

### 7.4 Contextual Help

**Add "?" icons next to:**
- "Create Session" button → Explains what a session is
- "Sync" button → Explains sync options
- "Assign" button → Explains session assignment

**Deliverables:**
- Help button on all pages
- Comprehensive help content
- Interactive tutorials
- Contextual tooltips

---

## **PHASE 8: Message Archiving**
**Goal:** Archive conversations

### 8.1 Database Schema Update

```sql
-- Add archived field to contacts
ALTER TABLE contacts ADD COLUMN archived BOOLEAN DEFAULT FALSE;
ALTER TABLE contacts ADD COLUMN archived_at TIMESTAMPTZ;
CREATE INDEX idx_contacts_archived ON contacts(archived) WHERE archived = TRUE;
```

### 8.2 Backend API

**Endpoints:**
```javascript
POST   /api/sessions/:sessionId/contacts/:contactId/archive
POST   /api/sessions/:sessionId/contacts/:contactId/unarchive
GET    /api/sessions/:sessionId/contacts/archived  // Get archived chats
```

### 8.3 Frontend UI

**ChatsList.jsx Updates:**
- Add "Archive" button to chat context menu
- Add "Archived" tab to view archived chats
- Show archive icon on archived chats
- Quick unarchive button

**Features:**
- Archive chat → hides from main list
- View archived chats in separate tab
- Unarchive to restore
- Search includes archived chats

**Deliverables:**
- Archive/unarchive functionality
- Archived chats view
- Seamless UI integration

---

## **PHASE 9: Additional Improvements**

### 9.1 Email Field for Users

**Database:**
```sql
ALTER TABLE profiles ADD COLUMN email TEXT UNIQUE;
ALTER TABLE profiles ADD CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
```

**Backend:**
- Add email to user creation
- Add email to user updates
- Validate email format

**Frontend:**
- Add email field to CreateUserModal
- Show email in user list
- Allow email updates

### 9.2 Password Management

**Features:**
- Users CANNOT change their own password
- Only admin can reset passwords (already implemented)
- "Forgot password?" flow (admin contact info shown)

**UI:**
- Remove "Change Password" from user settings
- Show message: "Contact your admin to reset password"

### 9.3 Contact Management Enhancements

**Database (already exists in schema):**
```sql
-- Add to contacts table (if not present)
ALTER TABLE contacts ADD COLUMN custom_name TEXT;
ALTER TABLE contacts ADD COLUMN notes TEXT;
ALTER TABLE contacts ADD COLUMN tags TEXT[];
ALTER TABLE contacts ADD COLUMN importance TEXT DEFAULT 'normal'; -- 'low', 'normal', 'high'
```

**Backend API:**
```javascript
PUT /api/sessions/:sessionId/contacts/:contactId
{
  custom_name: "...",
  notes: "...",
  tags: [...],
  importance: "high"
}
```

**Frontend:**
- Edit contact modal
- Custom name override
- Notes field
- Tags (autocomplete)
- Importance level (color coded)

### 9.4 Session Reconnection Fix

**Problem:** Sessions disconnect and don't reconnect automatically

**Investigation:**
- Check Evolution API reconnection logic
- Check webhook handling for disconnect events
- Test manual reconnection endpoint

**Fix:**
- Auto-retry connection on disconnect
- Webhook to update session status in real-time
- UI notification when session disconnects
- "Reconnect" button in UI

**Test:**
- Force disconnect session
- Verify auto-reconnect
- Test manual reconnect button

---

## **PHASE 10: Testing & Deployment**

### 10.1 Testing Checklist

**Unit Tests:**
- [ ] Team service functions
- [ ] Session assignment functions
- [ ] Permission checks

**Integration Tests:**
- [ ] Super admin can see all sessions
- [ ] Admin can only see their sessions/teams
- [ ] Team member can only see assigned sessions
- [ ] Session assignment works (user & team)
- [ ] Team member management works
- [ ] Message sync works correctly

**User Flow Tests:**
1. Super Admin:
   - Create admin
   - View all sessions
   - View all teams
   - Access super admin dashboard

2. Admin:
   - Create team
   - Add members to team
   - Create session
   - Assign session to team
   - View team member's access

3. Team Member:
   - Log in
   - See only assigned sessions
   - Send/receive messages
   - Cannot create users/teams
   - Cannot change password

**Bug Testing:**
- [ ] Session reconnection works
- [ ] Message filtering works (no wrong messages)
- [ ] Contact names correct (no pushName corruption)
- [ ] Group messages show sender
- [ ] Media downloads work

### 10.2 Deployment

**Steps:**
1. Pull latest code from GitHub
2. Run database migrations:
   ```bash
   cd /home/ubuntu/whatsapp-crm
   npx supabase db push
   ```
3. Clean corrupted data (if needed)
4. Restart backend: `pm2 restart whatsapp-backend`
5. Deploy frontend: `vercel --prod`
6. Test all features in production

### 10.3 Documentation

**Update README.md:**
- System architecture
- Role hierarchy
- Setup instructions
- API documentation
- User guide

**Create Admin Guide:**
- How to create teams
- How to assign sessions
- How to manage users
- Best practices

**Create User Guide:**
- How to log in
- How to use chat interface
- How to view media
- How to get help

---

## 📅 Timeline Estimate

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1 | Bug Fixes | 2-3 days |
| Phase 2 | Team Backend | 2-3 days |
| Phase 3 | Team Frontend | 3-4 days |
| Phase 4 | Session Assignment | 2-3 days |
| Phase 5 | RBAC | 2-3 days |
| Phase 6 | Super Admin Dashboard | 2-3 days |
| Phase 7 | Help System | 3-4 days |
| Phase 8 | Message Archiving | 1-2 days |
| Phase 9 | Additional Features | 2-3 days |
| Phase 10 | Testing & Deployment | 3-4 days |

**Total: ~25-35 days** (assuming focused, full-time development)

---

## 🚀 Getting Started

### Immediate Next Steps:

1. **Finish Phase 1:**
   - ✅ Fix message filtering
   - ✅ Fix contact names
   - ✅ Add group sender info
   - ⏳ Deploy fixes to production
   - ⏳ Test with real data
   - ⏳ Fix session reconnection

2. **Start Phase 2:**
   - Create team controller
   - Create team service
   - Build team CRUD API
   - Test endpoints

---

## 📝 Notes

- This is a living document - update as we progress
- Mark tasks as complete with ✅
- Add new tasks as discovered
- Track bugs in separate section
- Keep deployment notes

---

**Last Updated:** 2026-01-04
**Status:** In Progress - Phase 1 (Bug Fixes)
**Next Milestone:** Complete Phase 1 and deploy to production
