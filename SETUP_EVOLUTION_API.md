# Evolution API Setup Guide

## Critical Configuration Issue Found

The `.env` file was configured with **incorrect** Evolution API URL and API key, causing all historical message sync to fail.

### Correct Configuration

Update `/home/user/wp-crm/backend/.env` with:

```env
# Evolution API Configuration
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=fynedtest-evolution-api-key-2024-secure

# WAHA Configuration (Legacy - points to Evolution API)
WAHA_BASE_URL=http://localhost:8080
WAHA_API_KEY=fynedtest-evolution-api-key-2024-secure
```

### Install Docker

```bash
# Install Docker on Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker
```

### Start Evolution API

```bash
cd /home/user/wp-crm/infrastructure/docker
docker-compose -f docker-compose.evolution.yml up -d
```

### Verify Evolution API is Running

```bash
# Check container status
docker ps | grep evolution

# Test API endpoint
curl http://localhost:8080

# Check logs
docker logs evolution-api
```

### Root Cause Analysis

1. **Problem**: `.env` had `EVOLUTION_API_URL=https://api.fynedtest.com`
   - This points to the CRM backend itself, not Evolution API
   - All `/chat/findMessages` requests returned 404

2. **Impact**:
   - Historical message sync completely failed
   - Only webhook messages (new real-time messages) worked
   - Hundreds of contacts showed "No messages yet"

3. **Solution**:
   - Update `.env` to point to `http://localhost:8080`
   - Use correct API key: `fynedtest-evolution-api-key-2024-secure`
   - Start Evolution API Docker container

### Next Steps After Evolution API is Running

1. Restart the CRM backend to use new configuration
2. Trigger initial message sync for existing sessions
3. Verify messages are being fetched and saved
