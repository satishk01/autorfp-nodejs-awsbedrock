# Quick Start: Neo4j on EC2 for RFP GraphRAG

## Overview
This is a simplified guide to get Neo4j running on AWS EC2 for your RFP Automation System.

## Prerequisites
- AWS Account
- EC2 Key Pair (create one if you don't have it)
- Your public IP address

## Step 1: Launch EC2 Instance

### Option A: Using AWS Console (Recommended for beginners)

1. **Go to AWS EC2 Console**
   - Open https://console.aws.amazon.com/ec2/
   - Click "Launch Instance"

2. **Configure Instance**
   - **Name**: `Neo4j-RFP-GraphRAG`
   - **AMI**: Ubuntu Server 22.04 LTS (Free tier eligible)
   - **Instance Type**: `t3.medium` (minimum for Neo4j)
   - **Key Pair**: Select your existing key pair
   - **Storage**: 20 GB gp3 (default is fine)

3. **Configure Security Group**
   - Create new security group: `neo4j-rfp-sg`
   - Add these inbound rules:
   
   | Type | Port | Source | Description |
   |------|------|---------|-------------|
   | SSH | 22 | My IP | SSH access |
   | Custom TCP | 7474 | My IP | Neo4j Browser |
   | Custom TCP | 7687 | My IP | Neo4j Bolt |

4. **Launch Instance**
   - Review and click "Launch Instance"
   - Wait for instance to be "Running"
   - Note the **Public IPv4 address**

### Option B: Using PowerShell Script
```powershell
# Run the automated setup script
.\scripts\setup-ec2-neo4j.ps1
```

## Step 2: Connect to EC2 Instance

### Using Windows SSH
```powershell
# Replace with your details
ssh -i "your-key.pem" ubuntu@YOUR_EC2_PUBLIC_IP
```

### Using PuTTY
1. Convert `.pem` to `.ppk` using PuTTYgen
2. Connect with PuTTY using the `.ppk` file

## Step 3: Install Neo4j

### Automated Installation (Recommended)
```bash
# Download and run the installation script
curl -o install-neo4j-ec2.sh https://raw.githubusercontent.com/your-repo/scripts/install-neo4j-ec2.sh
chmod +x install-neo4j-ec2.sh
./install-neo4j-ec2.sh
```

### Manual Installation (Alternative)
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Java 17
sudo apt install -y openjdk-17-jdk

# Add Neo4j repository
wget -O - https://debian.neo4j.com/neotechnology.gpg.key | sudo apt-key add -
echo 'deb https://debian.neo4j.com stable latest' | sudo tee -a /etc/apt/sources.list.d/neo4j.list
sudo apt update

# Install Neo4j
sudo apt install -y neo4j

# Set password
sudo neo4j-admin dbms set-initial-password rfpgraph123

# Configure for remote access
sudo sed -i 's/#server.default_listen_address=0.0.0.0/server.default_listen_address=0.0.0.0/' /etc/neo4j/neo4j.conf

# Start Neo4j
sudo systemctl enable neo4j
sudo systemctl start neo4j

# Check status
sudo systemctl status neo4j
```

## Step 4: Verify Installation

### Test from EC2 Instance
```bash
# Check if Neo4j is running
curl http://localhost:7474

# Should return HTML content with "neo4j" in it
```

### Test from Your Local Machine
1. Open browser: `http://YOUR_EC2_PUBLIC_IP:7474`
2. Login with:
   - **Username**: `neo4j`
   - **Password**: `rfpgraph123`
3. Run test query: `RETURN "Hello GraphRAG!" as message`

## Step 5: Configure Local Application

### Update .env File
```env
# Neo4j Configuration (EC2 Instance)
NEO4J_ENABLED=true
NEO4J_URI=bolt://YOUR_EC2_PUBLIC_IP:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=rfpgraph123
NEO4J_DATABASE=neo4j
```

### Test Connection
```powershell
# Run the connection test script
.\scripts\test-ec2-neo4j-connection.ps1
```

## Step 6: Start Your RFP Application

```bash
# Start backend server
node src/server.js

# Look for this message in logs:
# "GraphRAG service initialized successfully"
```

## Quick Commands

### EC2 Management
```bash
# Check Neo4j status
sudo systemctl status neo4j

# Start/Stop Neo4j
sudo systemctl start neo4j
sudo systemctl stop neo4j

# View logs
sudo journalctl -u neo4j -f

# Check connections
sudo netstat -tlnp | grep -E ':(7474|7687)'
```

### Backup Neo4j
```bash
# Create backup
sudo neo4j-admin database dump --to-path=/home/ubuntu/backups neo4j
```

## Troubleshooting

### Common Issues

#### 1. Can't Connect from Browser
- Check EC2 Security Group allows port 7474 from your IP
- Verify Neo4j is running: `sudo systemctl status neo4j`
- Check if your IP address changed

#### 2. RFP Application Can't Connect
- Check port 7687 in Security Group
- Verify .env file has correct EC2 IP address
- Test with: `telnet YOUR_EC2_IP 7687`

#### 3. Neo4j Won't Start
```bash
# Check logs for errors
sudo journalctl -u neo4j -f

# Check configuration
sudo neo4j-admin server console

# Fix permissions if needed
sudo chown -R neo4j:neo4j /var/lib/neo4j
```

#### 4. Memory Issues
```bash
# Check memory usage
free -h

# Reduce Neo4j memory in /etc/neo4j/neo4j.conf:
server.memory.heap.max_size=1G
server.memory.pagecache.size=512m
```

## Cost Management

### Estimated Costs (US East)
- **t3.medium**: ~$30-40/month
- **Storage (20GB)**: ~$2/month
- **Data transfer**: Minimal for development

### Save Money
```bash
# Stop instance when not in use
aws ec2 stop-instances --instance-ids i-1234567890abcdef0

# Start when needed
aws ec2 start-instances --instance-ids i-1234567890abcdef0
```

## Security Best Practices

1. **Restrict Security Group**
   - Only allow your IP address
   - Update when your IP changes

2. **Change Default Password**
   ```bash
   # Connect to Neo4j Browser and run:
   ALTER CURRENT USER SET PASSWORD FROM 'rfpgraph123' TO 'your-new-password'
   ```

3. **Enable HTTPS** (for production)
   ```bash
   # Generate SSL certificate
   sudo openssl req -new -newkey rsa:2048 -days 365 -nodes -x509 \
       -keyout /var/lib/neo4j/certificates/neo4j.key \
       -out /var/lib/neo4j/certificates/neo4j.cert
   ```

## Success Indicators

✅ **You're ready when:**
- Neo4j Browser loads at `http://YOUR_EC2_IP:7474`
- You can login with neo4j/rfpgraph123
- RFP application logs show "GraphRAG service initialized successfully"
- Knowledge Graph tab appears in your RFP application

## Next Steps

1. **Upload Documents**: Test document processing with GraphRAG
2. **View Knowledge Graph**: Check the new "Knowledge Graph" tab
3. **Monitor Performance**: Watch EC2 metrics in AWS Console
4. **Create Backups**: Set up regular database backups

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review EC2 instance logs: `sudo journalctl -u neo4j -f`
3. Verify Security Group settings in AWS Console
4. Test connection with the provided scripts

Your Neo4j GraphRAG setup is now ready to enhance your RFP Automation System with advanced entity relationship analysis!