# 🚀 Corporate WhatsApp CRM System

Enterprise-grade WhatsApp CRM with hierarchical RBAC, built on WAHA + Supabase + AWS.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AWS Cloud Infrastructure                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌──────────────┐                     │
│  │   EC2        │      │   EC2        │                     │
│  │   WAHA       │◄────►│   Backend    │                     │
│  │   (Docker)   │      │   (Node.js)  │                     │
│  └──────────────┘      └──────────────┘                     │
│         │                      │                             │
│         │                      ▼                             │
│         │              ┌──────────────┐                     │
│         └─────────────►│   Supabase   │                     │
│                        │  PostgreSQL  │                     │
│                        │   + Storage  │                     │
│                        └──────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Key Features

- **Hierarchical RBAC**: Super Admin → Admin → Team Member
- **Smart Sync**: Automatic message gap filling after disconnections
- **Full Archive**: Permanent message storage with media
- **Hybrid Auth**: QR Code + Pairing Code support
- **Zero Data Loss**: Resilient architecture for critical business communications

## 📁 Project Structure

```
wp-crm/
├── infrastructure/       # DevOps & deployment configs
│   ├── docker/          # Docker Compose files
│   ├── nginx/           # Reverse proxy configs
│   └── ssl/             # SSL certificates
├── backend/             # Node.js/Express API
│   └── src/
│       ├── controllers/ # Request handlers
│       ├── middlewares/ # Auth, validation, etc.
│       ├── routes/      # API routes
│       ├── services/    # Business logic
│       └── config/      # Configuration
├── frontend/            # React + Vite application
│   └── src/
│       ├── components/  # Reusable UI components
│       ├── pages/       # Page components
│       └── services/    # API client
└── supabase/            # Database migrations & seed
    ├── migrations/      # SQL migration files
    └── seed/            # Initial data
```

## 🚦 Quick Start

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed setup instructions.

## 🔐 Security Features

- Row Level Security (RLS) on all tables
- IP whitelisting for WAHA access
- SSL/TLS encryption
- Secure session management
- Admin-only user creation

## 📚 Documentation

- [Deployment Guide](./DEPLOYMENT.md)
- [API Documentation](./backend/API.md)
- [Database Schema](./supabase/SCHEMA.md)

---

**Built with ❤️ for enterprise-grade WhatsApp communications**
