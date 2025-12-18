const { spawn } = require('child_process');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const logger = require('../utils/logger');

class MCPClient {
  constructor() {
    this.client = null;
    this.transport = null;
    this.serverProcess = null;
    this.isConnected = false;
    this.connectionPromise = null;
  }

  /**
   * Connect to AWS Documentation MCP server
   */
  async connect() {
    if (this.isConnected) {
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this._establishConnection();
    return this.connectionPromise;
  }

  async _establishConnection() {
    try {
      logger.info('Starting AWS Documentation MCP server...');

      // Start the AWS Documentation MCP server with proper Windows support
      const isWindows = process.platform === 'win32';
      let command = 'uvx';
      
      // On Windows, try to find the full path to uvx
      if (isWindows) {
        try {
          const { execSync } = require('child_process');
          const uvxPath = execSync('where uvx', { encoding: 'utf8' }).trim();
          if (uvxPath) {
            command = uvxPath.split('\n')[0]; // Take first result
          }
        } catch (error) {
          logger.warn('Could not find uvx path, using default:', error.message);
          command = 'uvx';
        }
      }
      
      const args = ['awslabs.aws-documentation-mcp-server@latest'];
      
      this.serverProcess = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: isWindows, // Use shell on Windows to resolve PATH
        env: {
          ...process.env,
          FASTMCP_LOG_LEVEL: 'ERROR'
        }
      });

      // Handle server errors
      this.serverProcess.on('error', (error) => {
        logger.error('Failed to start MCP server:', error);
        this.cleanup();
        throw new Error(`Failed to start MCP server: ${error.message}`);
      });

      this.serverProcess.on('exit', (code, signal) => {
        if (code !== 0) {
          logger.warn(`MCP server exited with code ${code}, signal ${signal}`);
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        const output = data.toString();
        logger.debug('MCP Server stderr:', output);
        
        // Check for common error patterns
        if (output.includes('command not found') || output.includes('not recognized')) {
          logger.error('uvx command not found. Please ensure uv/uvx is installed and in PATH');
        }
      });

      // Wait a moment for the server to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Create transport using stdio
      this.transport = new StdioClientTransport({
        stdin: this.serverProcess.stdin,
        stdout: this.serverProcess.stdout
      });

      // Create MCP client
      this.client = new Client({
        name: 'rfp-automation-client',
        version: '1.0.0'
      }, {
        capabilities: {
          tools: {}
        }
      });

      // Connect to the server with timeout
      const connectPromise = this.client.connect(this.transport);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('MCP connection timeout')), 10000)
      );
      
      await Promise.race([connectPromise, timeoutPromise]);
      
      logger.info('Successfully connected to AWS Documentation MCP server');
      this.isConnected = true;

      // Handle connection close
      this.transport.onclose = () => {
        logger.info('MCP connection closed');
        this.isConnected = false;
        this.client = null;
        this.transport = null;
      };

      // List available tools
      const tools = await this.client.listTools();
      logger.info('Available MCP tools:', tools.tools.map(t => t.name));

    } catch (error) {
      logger.error('Failed to connect to MCP server:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Search AWS documentation using MCP server
   */
  async searchDocumentation(query, maxResults = 5) {
    try {
      await this.connect();

      if (!this.client) {
        throw new Error('MCP client not connected');
      }

      logger.info('Searching AWS documentation:', query);

      const result = await this.client.callTool({
        name: 'search_aws_documentation',
        arguments: {
          query: query,
          max_results: maxResults
        }
      });

      logger.info('AWS documentation search completed');
      return result;

    } catch (error) {
      logger.error('Error searching AWS documentation:', error);
      throw error;
    }
  }

  /**
   * Get AWS service information using MCP server
   */
  async getServiceInfo(serviceName) {
    try {
      await this.connect();

      if (!this.client) {
        throw new Error('MCP client not connected');
      }

      logger.info('Getting AWS service info:', serviceName);

      const result = await this.client.callTool({
        name: 'get_aws_service_info',
        arguments: {
          service_name: serviceName
        }
      });

      logger.info('AWS service info retrieved');
      return result;

    } catch (error) {
      logger.error('Error getting AWS service info:', error);
      throw error;
    }
  }

  /**
   * Get AWS best practices using MCP server
   */
  async getBestPractices(topic) {
    try {
      await this.connect();

      if (!this.client) {
        throw new Error('MCP client not connected');
      }

      logger.info('Getting AWS best practices for:', topic);

      const result = await this.client.callTool({
        name: 'get_aws_best_practices',
        arguments: {
          topic: topic
        }
      });

      logger.info('AWS best practices retrieved');
      return result;

    } catch (error) {
      logger.error('Error getting AWS best practices:', error);
      throw error;
    }
  }

  /**
   * List available tools from MCP server
   */
  async listTools() {
    try {
      await this.connect();

      if (!this.client) {
        throw new Error('MCP client not connected');
      }

      const tools = await this.client.listTools();
      return tools.tools;

    } catch (error) {
      logger.error('Error listing MCP tools:', error);
      throw error;
    }
  }

  /**
   * Check if MCP server is connected
   */
  isServerConnected() {
    return this.isConnected && this.client !== null;
  }

  /**
   * Cleanup MCP connection and server process
   */
  cleanup() {
    logger.info('Cleaning up MCP client...');

    if (this.client) {
      try {
        this.client.close();
      } catch (error) {
        logger.warn('Error closing MCP client:', error);
      }
      this.client = null;
    }

    if (this.transport) {
      try {
        this.transport.close();
      } catch (error) {
        logger.warn('Error closing MCP transport:', error);
      }
      this.transport = null;
    }

    if (this.serverProcess) {
      try {
        this.serverProcess.kill('SIGTERM');
        
        // Force kill after 5 seconds if not terminated
        setTimeout(() => {
          if (this.serverProcess && !this.serverProcess.killed) {
            this.serverProcess.kill('SIGKILL');
          }
        }, 5000);
      } catch (error) {
        logger.warn('Error killing MCP server process:', error);
      }
      this.serverProcess = null;
    }

    this.isConnected = false;
    this.connectionPromise = null;
  }

  /**
   * Reconnect to MCP server
   */
  async reconnect() {
    logger.info('Reconnecting to MCP server...');
    this.cleanup();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    return this.connect();
  }
}

module.exports = new MCPClient();