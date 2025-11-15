#!/bin/bash

# Raspberry Pi GPIO Controller Deployment Script
# This script deploys the application to a Raspberry Pi using rsync

# Configuration
PI_USER="${PI_USER:-pi}"
PI_HOST="${PI_HOST}"
PI_DIR="${PI_DIR:-/home/pi/powerSwitch}"
PI_PORT="${PI_PORT:-22}"
PI_PASSWORD="${PI_PASSWORD:-raspberry}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if PI_HOST is set
if [ -z "$PI_HOST" ]; then
    print_error "PI_HOST is not set!"
    echo ""
    echo "Usage:"
    echo "  PI_HOST=<raspberry-pi-ip> ./deploy.sh"
    echo ""
    echo "Optional environment variables:"
    echo "  PI_USER=<username>     (default: pi)"
    echo "  PI_DIR=<target-dir>    (default: /home/pi/powerSwitch)"
    echo "  PI_PORT=<ssh-port>     (default: 22)"
    echo ""
    echo "Example:"
    echo "  PI_HOST=192.168.1.100 ./deploy.sh"
    echo "  PI_HOST=raspberrypi.local PI_USER=paul PI_DIR=/opt/powerSwitch ./deploy.sh"
    exit 1
fi

print_info "Deploying to ${PI_USER}@${PI_HOST}:${PI_DIR}"

# Check if rsync is installed
if ! command -v rsync &> /dev/null; then
    print_error "rsync is not installed. Please install it first:"
    echo "  Ubuntu/Debian: sudo apt-get install rsync"
    echo "  macOS: brew install rsync"
    exit 1
fi

# Check if sshpass is installed
if ! command -v sshpass &> /dev/null; then
    print_error "sshpass is not installed. Please install it first:"
    echo "  Ubuntu/Debian: sudo apt-get install sshpass"
    echo "  macOS: brew install hudochenkov/sshpass/sshpass"
    exit 1
fi

# Test SSH connection
print_info "Testing SSH connection..."
if ! sshpass -p "$PI_PASSWORD" ssh -p "$PI_PORT" -o ConnectTimeout=5 -o StrictHostKeyChecking=no "${PI_USER}@${PI_HOST}" exit 2>/dev/null; then
    print_warning "Cannot connect via SSH. Please check your credentials and network."
fi

# Create target directory on Pi
print_info "Creating target directory on Raspberry Pi..."
sshpass -p "$PI_PASSWORD" ssh -p "$PI_PORT" -o StrictHostKeyChecking=no "${PI_USER}@${PI_HOST}" "mkdir -p ${PI_DIR}" || {
    print_error "Failed to create directory on Raspberry Pi"
    exit 1
}

# Sync files to Raspberry Pi
print_info "Syncing files to Raspberry Pi..."
sshpass -p "$PI_PASSWORD" rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.gitignore' \
    --exclude 'deploy.sh' \
    --exclude '*.log' \
    --exclude '.env' \
    --exclude '.DS_Store' \
    --exclude 'npm-debug.log*' \
    --exclude 'yarn-debug.log*' \
    --exclude 'yarn-error.log*' \
    -e "ssh -p ${PI_PORT} -o StrictHostKeyChecking=no" \
    ./ "${PI_USER}@${PI_HOST}:${PI_DIR}/" || {
    print_error "rsync failed"
    exit 1
}

print_info "Files synced successfully!"

# Install dependencies on Raspberry Pi
print_info "Installing dependencies on Raspberry Pi..."
sshpass -p "$PI_PASSWORD" ssh -p "$PI_PORT" -o StrictHostKeyChecking=no "${PI_USER}@${PI_HOST}" "cd ${PI_DIR} && npm install --production" || {
    print_error "Failed to install dependencies"
    exit 1
}

print_info "Dependencies installed successfully!"

# Setup systemd service
print_info "Setting up systemd service..."

# Create a temporary service file with the correct WorkingDirectory
print_info "Creating systemd service file..."
sshpass -p "$PI_PASSWORD" ssh -p "$PI_PORT" -o StrictHostKeyChecking=no "${PI_USER}@${PI_HOST}" "cat > /tmp/powerswitch.service << 'EOF'
[Unit]
Description=PowerSwitch GPIO Controller
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${PI_DIR}
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Environment variables
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
" || {
    print_error "Failed to create service file"
    exit 1
}

# Install the service
print_info "Installing systemd service..."
sshpass -p "$PI_PASSWORD" ssh -p "$PI_PORT" -o StrictHostKeyChecking=no "${PI_USER}@${PI_HOST}" "
    echo '${PI_PASSWORD}' | sudo -S mv /tmp/powerswitch.service /etc/systemd/system/powerswitch.service && \
    echo '${PI_PASSWORD}' | sudo -S chmod 644 /etc/systemd/system/powerswitch.service && \
    echo '${PI_PASSWORD}' | sudo -S systemctl daemon-reload && \
    echo '${PI_PASSWORD}' | sudo -S systemctl enable powerswitch.service
" || {
    print_error "Failed to install systemd service"
    exit 1
}

print_info "Systemd service installed and enabled!"

# Ask if user wants to start the service
echo ""
read -p "Do you want to start the service now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Starting powerswitch service..."
    sshpass -p "$PI_PASSWORD" ssh -p "$PI_PORT" -o StrictHostKeyChecking=no "${PI_USER}@${PI_HOST}" "echo '${PI_PASSWORD}' | sudo -S systemctl restart powerswitch.service"
    sleep 2

    # Check service status
    print_info "Checking service status..."
    sshpass -p "$PI_PASSWORD" ssh -p "$PI_PORT" -o StrictHostKeyChecking=no "${PI_USER}@${PI_HOST}" "echo '${PI_PASSWORD}' | sudo -S systemctl status powerswitch.service --no-pager"

    echo ""
    print_info "Service started!"
fi

echo ""
print_info "Deployment complete!"
echo ""
print_info "Access the web interface at: http://${PI_HOST}:3000"
print_info "Service commands:"
print_info "  Start:   sudo systemctl start powerswitch"
print_info "  Stop:    sudo systemctl stop powerswitch"
print_info "  Restart: sudo systemctl restart powerswitch"
print_info "  Status:  sudo systemctl status powerswitch"
print_info "  Logs:    sudo journalctl -u powerswitch -f"
