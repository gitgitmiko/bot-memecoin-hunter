#!/bin/bash
# System optimization script for 8GB VPS

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${NC}[INFO]${NC} $1"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

log_info "=== System Optimization for 8GB VPS ==="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    log_warn "Some optimizations require root privileges"
    log_info "Run with sudo for full optimization"
fi

# 1. System Swappiness
log_info "Optimizing swappiness..."
if [ "$EUID" -eq 0 ]; then
    if ! grep -q "vm.swappiness=10" /etc/sysctl.conf; then
        echo "vm.swappiness=10" >> /etc/sysctl.conf
        sysctl -p > /dev/null 2>&1
        log_ok "Swappiness set to 10"
    else
        log_ok "Swappiness already optimized"
    fi
else
    log_warn "Skipping swappiness (requires sudo)"
fi

# 2. OOM Killer
log_info "Configuring OOM killer..."
if [ "$EUID" -eq 0 ]; then
    if ! grep -q "vm.oom_kill_allocating_task" /etc/sysctl.conf; then
        echo "vm.oom_kill_allocating_task = 0" >> /etc/sysctl.conf
        sysctl -p > /dev/null 2>&1
        log_ok "OOM killer configured"
    else
        log_ok "OOM killer already configured"
    fi
else
    log_warn "Skipping OOM killer config (requires sudo)"
fi

# 3. File Descriptors
log_info "Checking file descriptor limits..."
CURRENT_LIMIT=$(ulimit -n)
if [ "$CURRENT_LIMIT" -lt 64000 ]; then
    log_warn "File descriptor limit is $CURRENT_LIMIT (recommended: 64000)"
    if [ "$EUID" -eq 0 ]; then
        if ! grep -q "fs.file-max = 64000" /etc/sysctl.conf; then
            echo "fs.file-max = 64000" >> /etc/sysctl.conf
            sysctl -p > /dev/null 2>&1
            log_ok "File descriptor limit increased"
        fi
    else
        log_info "Add to ~/.bashrc: ulimit -n 64000"
    fi
else
    log_ok "File descriptor limit OK ($CURRENT_LIMIT)"
fi

# 4. Docker daemon optimization
log_info "Checking Docker daemon configuration..."
if [ "$EUID" -eq 0 ]; then
    DOCKER_DAEMON_JSON="/etc/docker/daemon.json"
    if [ ! -f "$DOCKER_DAEMON_JSON" ]; then
        mkdir -p /etc/docker
        cat > "$DOCKER_DAEMON_JSON" << 'DOCKERJSON'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 64000,
      "Soft": 64000
    }
  }
}
DOCKERJSON
        log_ok "Docker daemon.json created"
        log_info "Restart Docker: sudo systemctl restart docker"
    else
        log_ok "Docker daemon.json already exists"
    fi
else
    log_warn "Skipping Docker daemon config (requires sudo)"
fi

# 5. System limits for user
log_info "Checking user limits..."
if [ "$EUID" -eq 0 ]; then
    if [ ! -f /etc/security/limits.d/99-memecoin.conf ]; then
        cat > /etc/security/limits.d/99-memecoin.conf << 'LIMITS'
ubuntu soft nofile 64000
ubuntu hard nofile 64000
ubuntu soft nproc 32768
ubuntu hard nproc 32768
LIMITS
        log_ok "User limits configured"
        log_warn "User needs to logout and login for limits to take effect"
    else
        log_ok "User limits already configured"
    fi
else
    log_warn "Skipping user limits (requires sudo)"
fi

echo ""
log_ok "System optimization complete!"
echo ""
log_info "Summary:"
if [ "$EUID" -eq 0 ]; then
    log_info "  ✅ Swappiness optimized"
    log_info "  ✅ OOM killer configured"
    log_info "  ✅ File descriptor limits set"
    log_info "  ✅ Docker daemon optimized"
    log_info "  ✅ User limits configured"
else
    log_warn "  Run with sudo for full optimization"
fi
echo ""
log_info "Next steps:"
log_info "  1. If Docker daemon.json was created, restart Docker:"
log_info "     sudo systemctl restart docker"
log_info "  2. If user limits were configured, logout and login again"
log_info "  3. Verify optimizations:"
log_info "     sysctl vm.swappiness"
log_info "     ulimit -n"

