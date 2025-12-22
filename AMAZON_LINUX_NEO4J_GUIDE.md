# Neo4j Installation Guide for Amazon Linux 2023

## Quick Fix for "java: command not found"

If you're getting the error `bash: java: command not found`, run this first:

```bash
# Quick one-liner fix
sudo dnf update -y && sudo dnf install -y java-17-openjdk java-17-openjdk-devel && export JAVA_HOME=/usr/lib/jvm/java-17-openjdk && export PATH=$PATH:$JAVA_HOME/bin && echo "export JAVA_HOME=/usr/lib/jvm/java-17-openjdk" >> ~/.bashrc && echo "export PATH=\$PATH:\$JAVA_HOME/bin" >> ~/.bashrc && java -version
```

Or use the dedicated script:

```bash
chmod +x scripts/quick-java-fix.sh
./scripts/quick-java-fix.sh
```

## Complete Installation Process

### Step 1: Launch Amazon Linux 2023 EC2 Instance

**Instance Configuration:**
- **AMI**: Amazon Linux 2023 AMI
- **Instance Type**: t3.medium (minimum 4GB RAM)
- **Storage**: 20GB GP3
- **Security Group**: Allow ports 22, 7474, 7687 from your IP

### Step 2: Connect to Your Instance

```bash
# Using SSH
ssh -i "your-key.pem" ec2-user@YOUR_EC2_PUBLIC_IP
```

### Step 3: Install Java (Required)

Amazon Linux 2023 doesn't come with Java pre-installed. Install it first:

```bash
# Update system
sudo dnf update -y

# Install Java 17
sudo dnf install -y java-17-openjdk java-17-openjdk-devel

# Set JAVA_HOME
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk
export PATH=$PATH:$JAVA_HOME/bin

# Make it permanent
echo "export JAVA_HOME=/usr/lib/jvm/java-17-openjdk" >> ~/.bashrc
echo "export PATH=\$PATH:\$JAVA_HOME/bin" >> ~/.bashrc
source ~/.bashrc

# Verify installation
java -version
```

### Step 4: Install Neo4j

Once Java is installed, run the Neo4j installation script:

```bash
# Download the script
curl -o install-neo4j-amazon-linux.sh https://raw.githubusercontent.com/your-repo/scripts/install-neo4j-amazon-linux.sh

# Make it executable
chmod +x install-neo4j-amazon-linux.sh

# Run the installation
./install-neo4j-amazon-linux.sh
```

### Step 5: Verify Installation

```bash
# Check Neo4j service status
sudo systemctl status neo4j

# Test HTTP endpoint
curl http://localhost:7474

# Check if ports are listening
sudo ss -tlnp | grep -E ':(7474|7687)'
```

### Step 6: Test from Browser

Open your browser and go to:
```
http://YOUR_EC2_PUBLIC_IP:7474
```

Login with:
- **Username**: neo4j
- **Password**: rfpgraph123

## Troubleshooting

### Issue 1: Java Not Found

**Error**: `bash: java: command not found`

**Solution**:
```bash
# Install Java
sudo dnf install -y java-17-openjdk java-17-openjdk-devel

# Set environment
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk
export PATH=$PATH:$JAVA_HOME/bin
source ~/.bashrc

# Verify
java -version
```

### Issue 2: Cannot Connect from Browser

**Error**: Connection refused or timeout

**Solutions**:

1. **Check Security Group**:
   - Go to EC2 Console → Security Groups
   - Ensure inbound rules allow:
     - Port 7474 (HTTP) from your IP
     - Port 7687 (Bolt) from your IP

2. **Check Firewall on Instance**:
```bash
# Check firewall status
sudo firewall-cmd --list-ports

# If ports not listed, add them
sudo firewall-cmd --permanent --add-port=7474/tcp
sudo firewall-cmd --permanent --add-port=7687/tcp
sudo firewall-cmd --reload
```

3. **Check Neo4j Service**:
```bash
# Check if running
sudo systemctl status neo4j

# If not running, start it
sudo systemctl start neo4j

# Check logs
sudo journalctl -u neo4j -f
```

### Issue 3: Neo4j Won't Start

**Error**: Service fails to start

**Solutions**:

1. **Check Logs**:
```bash
sudo journalctl -u neo4j -n 50 --no-pager
```

2. **Check Configuration**:
```bash
sudo cat /etc/neo4j/neo4j.conf | grep -v "^#" | grep -v "^$"
```

3. **Check Permissions**:
```bash
sudo chown -R neo4j:neo4j /var/lib/neo4j
sudo chown -R neo4j:neo4j /var/log/neo4j
sudo chown -R neo4j:neo4j /opt/neo4j
```

4. **Check Memory**:
```bash
free -h
# If low memory, reduce heap size in /etc/neo4j/neo4j.conf
```

### Issue 4: Port Already in Use

**Error**: Address already in use

**Solution**:
```bash
# Find what's using the port
sudo ss -tlnp | grep 7474

# Kill the process if needed
sudo kill -9 <PID>

# Restart Neo4j
sudo systemctl restart neo4j
```

### Issue 5: Permission Denied

**Error**: Permission denied errors in logs

**Solution**:
```bash
# Fix all permissions
sudo chown -R neo4j:neo4j /var/lib/neo4j
sudo chown -R neo4j:neo4j /var/log/neo4j
sudo chown -R neo4j:neo4j /etc/neo4j
sudo chown -R neo4j:neo4j /opt/neo4j

# Restart service
sudo systemctl restart neo4j
```

## Management Commands

### Service Management
```bash
# Start Neo4j
sudo systemctl start neo4j

# Stop Neo4j
sudo systemctl stop neo4j

# Restart Neo4j
sudo systemctl restart neo4j

# Check status
sudo systemctl status neo4j

# Enable auto-start on boot
sudo systemctl enable neo4j

# Disable auto-start
sudo systemctl disable neo4j
```

### View Logs
```bash
# Real-time logs
sudo journalctl -u neo4j -f

# Last 50 lines
sudo journalctl -u neo4j -n 50

# Logs from last hour
sudo journalctl -u neo4j --since "1 hour ago"

# Neo4j application logs
sudo tail -f /var/lib/neo4j/logs/neo4j.log
```

### Check Resources
```bash
# Memory usage
free -h

# Disk usage
df -h /var/lib/neo4j

# Neo4j process
ps aux | grep neo4j

# Network connections
sudo ss -tlnp | grep -E ':(7474|7687)'
```

### Backup and Restore
```bash
# Create backup
sudo systemctl stop neo4j
sudo -u neo4j /opt/neo4j/bin/neo4j-admin database dump --to-path=/home/ec2-user/backups neo4j
sudo systemctl start neo4j

# Restore backup
sudo systemctl stop neo4j
sudo -u neo4j /opt/neo4j/bin/neo4j-admin database load --from-path=/home/ec2-user/backups neo4j --overwrite-destination=true
sudo systemctl start neo4j
```

## Performance Tuning

### Memory Configuration

Edit `/etc/neo4j/neo4j.conf`:

```properties
# For t3.medium (4GB RAM)
server.memory.heap.initial_size=1G
server.memory.heap.max_size=2G
server.memory.pagecache.size=1G

# For t3.large (8GB RAM)
server.memory.heap.initial_size=2G
server.memory.heap.max_size=4G
server.memory.pagecache.size=2G
```

After changes:
```bash
sudo systemctl restart neo4j
```

### Monitoring Performance

```bash
# CPU and Memory
top -p $(pgrep -f neo4j)

# Disk I/O
iostat -x 1

# Network
sudo ss -s
```

## Security Hardening

### Change Default Password

Connect to Neo4j Browser and run:
```cypher
ALTER CURRENT USER SET PASSWORD FROM 'rfpgraph123' TO 'your-new-strong-password'
```

### Restrict Firewall

```bash
# Remove open access
sudo firewall-cmd --permanent --remove-port=7474/tcp
sudo firewall-cmd --permanent --remove-port=7687/tcp

# Add specific IP only
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="YOUR_IP_ADDRESS" port protocol="tcp" port="7474" accept'
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="YOUR_IP_ADDRESS" port protocol="tcp" port="7687" accept'

sudo firewall-cmd --reload
```

### Enable HTTPS (Optional)

```bash
# Generate self-signed certificate
sudo mkdir -p /var/lib/neo4j/certificates
sudo openssl req -new -newkey rsa:2048 -days 365 -nodes -x509 \
    -keyout /var/lib/neo4j/certificates/neo4j.key \
    -out /var/lib/neo4j/certificates/neo4j.cert

sudo chown neo4j:neo4j /var/lib/neo4j/certificates/*

# Update configuration
sudo tee -a /etc/neo4j/neo4j.conf > /dev/null <<EOF
# HTTPS Configuration
server.https.enabled=true
dbms.ssl.policy.https.enabled=true
dbms.ssl.policy.https.base_directory=/var/lib/neo4j/certificates
dbms.ssl.policy.https.private_key=neo4j.key
dbms.ssl.policy.https.public_certificate=neo4j.cert
EOF

sudo systemctl restart neo4j
```

## Automated Scripts

The installation creates these helper scripts in your home directory:

- `start-neo4j.sh` - Start Neo4j service
- `stop-neo4j.sh` - Stop Neo4j service
- `neo4j-status.sh` - Check status and resources
- `backup-neo4j.sh` - Create database backup
- `view-neo4j-logs.sh` - View real-time logs
- `monitor-neo4j.sh` - Performance monitoring
- `tune-neo4j-performance.sh` - Auto-tune memory settings

## Cost Optimization

### Instance Sizing
- **Development**: t3.small (2GB) - $15-20/month
- **Testing**: t3.medium (4GB) - $30-40/month
- **Production**: t3.large (8GB) - $60-80/month

### Save Costs
```bash
# Stop instance when not in use
aws ec2 stop-instances --instance-ids i-xxxxx

# Start when needed
aws ec2 start-instances --instance-ids i-xxxxx
```

### Use Spot Instances
For non-production workloads, consider Spot Instances for 70-90% cost savings.

## Integration with RFP Application

### Update Local .env File

```env
NEO4J_ENABLED=true
NEO4J_URI=bolt://YOUR_EC2_PUBLIC_IP:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=rfpgraph123
NEO4J_DATABASE=neo4j
```

### Test Connection

```bash
# From your local machine
node -e "const neo4j = require('neo4j-driver'); const driver = neo4j.driver('bolt://YOUR_EC2_IP:7687', neo4j.auth.basic('neo4j', 'rfpgraph123')); driver.verifyConnectivity().then(() => console.log('✅ Connected')).catch(e => console.log('❌ Failed:', e.message)).finally(() => driver.close());"
```

## Success Checklist

✅ Java 17 installed and working
✅ Neo4j service running
✅ Ports 7474 and 7687 accessible
✅ Can login to Neo4j Browser
✅ Firewall configured correctly
✅ Security group allows your IP
✅ Local .env file updated
✅ Connection test passes

## Additional Resources

- Neo4j Documentation: https://neo4j.com/docs/
- Amazon Linux 2023 Guide: https://docs.aws.amazon.com/linux/
- Neo4j Operations Manual: https://neo4j.com/docs/operations-manual/

Your Neo4j GraphRAG system is now ready on Amazon Linux 2023!