const bedrockService = require('./bedrock');
const mcpClient = require('./mcpClient');
const logger = require('../utils/logger');

class ArchitectureAnalysisService {
  constructor() {
    // Initialize MCP client connection on first use
    this.mcpInitialized = false;
  }

  /**
   * Initialize MCP client if not already done
   */
  async initializeMCP() {
    if (this.mcpInitialized) {
      return;
    }

    try {
      await mcpClient.connect();
      this.mcpInitialized = true;
      logger.info('MCP client initialized successfully');
    } catch (error) {
      logger.warn('Failed to initialize MCP client, will use fallback:', error.message);
      // Don't throw error, just use fallback
    }
  }

  /**
   * Query AWS Documentation using MCP server with fallback
   */
  async queryAWSDocumentation(query) {
    try {
      await this.initializeMCP();
      
      if (mcpClient.isServerConnected()) {
        logger.info('Querying AWS Documentation via MCP server:', query);
        
        // Try to search documentation using MCP server
        const mcpResult = await mcpClient.searchDocumentation(query, 5);
        
        if (mcpResult && mcpResult.content) {
          logger.info('Successfully retrieved documentation from MCP server');
          return this.formatMCPResponse(mcpResult);
        }
      }
      
      // Fallback to local documentation
      logger.info('Using fallback AWS documentation for:', query);
      return this.getFallbackAWSDocumentation(query);
      
    } catch (error) {
      logger.error('Error querying AWS Documentation via MCP:', error);
      // Always fallback to local documentation on error
      return this.getFallbackAWSDocumentation(query);
    }
  }

  /**
   * Format MCP server response to match expected structure
   */
  formatMCPResponse(mcpResult) {
    try {
      // Parse MCP response and format it
      const content = [];
      
      if (Array.isArray(mcpResult.content)) {
        mcpResult.content.forEach(item => {
          content.push({
            title: item.title || 'AWS Documentation',
            content: item.text || item.content || '',
            url: item.url || '',
            services: this.extractServicesFromContent(item.text || item.content || '')
          });
        });
      } else if (typeof mcpResult.content === 'string') {
        content.push({
          title: 'AWS Documentation',
          content: mcpResult.content,
          services: this.extractServicesFromContent(mcpResult.content)
        });
      }

      return { content };
    } catch (error) {
      logger.error('Error formatting MCP response:', error);
      return this.getFallbackAWSDocumentation('general');
    }
  }

  /**
   * Extract AWS service names from content text
   */
  extractServicesFromContent(text) {
    const services = new Set();
    const servicePatterns = [
      /Amazon\s+([A-Z][A-Za-z\s]+)/g,
      /AWS\s+([A-Z][A-Za-z\s]+)/g,
      /Amazon\s+([A-Z][A-Za-z]+)/g,
      /AWS\s+([A-Z][A-Za-z]+)/g
    ];

    servicePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const serviceName = match[0].trim();
        if (serviceName.length > 3 && serviceName.length < 50) {
          services.add(serviceName);
        }
      }
    });

    return Array.from(services).slice(0, 10); // Limit to 10 services
  }

  /**
   * Comprehensive AWS documentation fallback (enhanced with detailed service information)
   */
  getFallbackAWSDocumentation(query) {
    const fallbackDocs = {
      'microservices': {
        services: ['Amazon ECS', 'AWS Lambda', 'Amazon API Gateway', 'Amazon EKS', 'AWS Fargate', 'Amazon ECR'],
        documentation: 'AWS provides comprehensive microservices architecture support through containerized services (ECS/EKS), serverless functions (Lambda), API management (API Gateway), and container registry (ECR). Best practices include using service mesh, implementing circuit breakers, and proper monitoring.',
        bestPractices: ['Use container orchestration', 'Implement service discovery', 'Apply circuit breaker patterns', 'Monitor service health']
      },
      'database': {
        services: ['Amazon RDS', 'Amazon DynamoDB', 'Amazon Aurora', 'Amazon ElastiCache', 'Amazon DocumentDB', 'Amazon Neptune'],
        documentation: 'AWS offers managed database services including relational databases (RDS, Aurora), NoSQL (DynamoDB, DocumentDB), graph databases (Neptune), and in-memory caching (ElastiCache). Choose based on data structure, consistency requirements, and performance needs.',
        bestPractices: ['Use read replicas for scaling', 'Implement proper backup strategies', 'Enable encryption at rest and in transit', 'Monitor database performance']
      },
      'storage': {
        services: ['Amazon S3', 'Amazon EFS', 'Amazon EBS', 'Amazon FSx', 'AWS Storage Gateway'],
        documentation: 'AWS provides object storage (S3), file storage (EFS, FSx), block storage (EBS), and hybrid storage solutions (Storage Gateway). S3 offers multiple storage classes for cost optimization.',
        bestPractices: ['Use appropriate storage classes', 'Enable versioning and lifecycle policies', 'Implement proper access controls', 'Use CloudFront for content delivery']
      },
      'authentication': {
        services: ['Amazon Cognito', 'AWS IAM', 'AWS SSO', 'AWS Directory Service'],
        documentation: 'AWS Cognito provides user authentication and authorization for web and mobile applications. IAM manages access to AWS services, while SSO enables centralized access management.',
        bestPractices: ['Use multi-factor authentication', 'Implement least privilege access', 'Use temporary credentials', 'Enable CloudTrail for audit logging']
      },
      'monitoring': {
        services: ['Amazon CloudWatch', 'AWS X-Ray', 'AWS CloudTrail', 'Amazon OpenSearch'],
        documentation: 'AWS CloudWatch provides monitoring and observability for AWS resources. X-Ray enables distributed tracing, CloudTrail provides audit logging, and OpenSearch offers log analytics.',
        bestPractices: ['Set up comprehensive dashboards', 'Configure alerting thresholds', 'Use distributed tracing', 'Implement centralized logging']
      },
      'web application': {
        services: ['Amazon EC2', 'AWS Elastic Beanstalk', 'Amazon CloudFront', 'Application Load Balancer', 'AWS WAF'],
        documentation: 'AWS supports web applications through compute services (EC2, Elastic Beanstalk), content delivery (CloudFront), load balancing (ALB), and security (WAF).',
        bestPractices: ['Use auto scaling groups', 'Implement CDN for static content', 'Configure SSL/TLS certificates', 'Enable DDoS protection']
      },
      'serverless': {
        services: ['AWS Lambda', 'Amazon API Gateway', 'Amazon DynamoDB', 'Amazon S3', 'Amazon EventBridge'],
        documentation: 'AWS serverless architecture uses Lambda for compute, API Gateway for APIs, DynamoDB for databases, S3 for storage, and EventBridge for event routing.',
        bestPractices: ['Design for stateless functions', 'Use appropriate memory allocation', 'Implement proper error handling', 'Monitor cold starts']
      },
      'container': {
        services: ['Amazon ECS', 'Amazon EKS', 'AWS Fargate', 'Amazon ECR', 'AWS App Runner'],
        documentation: 'AWS container services include ECS for Docker containers, EKS for Kubernetes, Fargate for serverless containers, ECR for container registry, and App Runner for simplified deployment.',
        bestPractices: ['Use multi-stage Docker builds', 'Implement health checks', 'Use secrets management', 'Configure resource limits']
      },
      'real-time': {
        services: ['Amazon Kinesis', 'Amazon MSK', 'AWS IoT Core', 'Amazon ElastiCache'],
        documentation: 'AWS real-time processing services include Kinesis for streaming data, MSK for Apache Kafka, IoT Core for IoT devices, and ElastiCache for real-time caching.',
        bestPractices: ['Design for high throughput', 'Implement proper partitioning', 'Use appropriate shard counts', 'Monitor stream metrics']
      },
      'security': {
        services: ['AWS IAM', 'AWS KMS', 'AWS Secrets Manager', 'AWS WAF', 'Amazon GuardDuty'],
        documentation: 'AWS security services include IAM for access management, KMS for encryption, Secrets Manager for credential storage, WAF for web application protection, and GuardDuty for threat detection.',
        bestPractices: ['Implement defense in depth', 'Use encryption everywhere', 'Enable security monitoring', 'Regular security assessments']
      },
      'default': {
        services: ['Amazon EC2', 'Amazon S3', 'Amazon RDS', 'AWS Lambda', 'Amazon CloudWatch'],
        documentation: 'AWS provides a comprehensive set of cloud services for building scalable, reliable, and secure applications. Core services include compute (EC2, Lambda), storage (S3), databases (RDS), and monitoring (CloudWatch).',
        bestPractices: ['Follow AWS Well-Architected Framework', 'Implement proper tagging', 'Use Infrastructure as Code', 'Enable cost optimization']
      }
    };

    // Find relevant documentation based on query keywords
    const queryLower = query.toLowerCase();
    for (const [key, value] of Object.entries(fallbackDocs)) {
      if (queryLower.includes(key)) {
        return {
          content: [{
            title: `AWS ${key.charAt(0).toUpperCase() + key.slice(1)} Documentation`,
            content: value.documentation,
            services: value.services
          }]
        };
      }
    }

    return {
      content: [{
        title: 'AWS General Documentation',
        content: fallbackDocs.default.documentation,
        services: fallbackDocs.default.services
      }]
    };
  }

  /**
   * Extract AWS services from architecture description
   */
  extractAWSServices(architectureDescription, awsDocumentation) {
    const services = new Set();
    
    // Extract from AWS documentation
    if (awsDocumentation && awsDocumentation.content) {
      awsDocumentation.content.forEach(doc => {
        if (doc.services) {
          doc.services.forEach(service => services.add(service));
        }
      });
    }

    // Common service mappings based on keywords
    const serviceKeywords = {
      'web application': ['Amazon EC2', 'AWS Elastic Beanstalk', 'Amazon CloudFront'],
      'database': ['Amazon RDS', 'Amazon DynamoDB'],
      'storage': ['Amazon S3'],
      'authentication': ['Amazon Cognito'],
      'microservices': ['Amazon ECS', 'AWS Lambda', 'Amazon API Gateway'],
      'load balancer': ['Application Load Balancer', 'Network Load Balancer'],
      'cdn': ['Amazon CloudFront'],
      'monitoring': ['Amazon CloudWatch'],
      'serverless': ['AWS Lambda', 'Amazon API Gateway'],
      'container': ['Amazon ECS', 'Amazon EKS'],
      'cache': ['Amazon ElastiCache'],
      'queue': ['Amazon SQS', 'Amazon SNS'],
      'real-time': ['Amazon Kinesis', 'AWS IoT Core']
    };

    const description = architectureDescription.toLowerCase();
    Object.entries(serviceKeywords).forEach(([keyword, serviceList]) => {
      if (description.includes(keyword)) {
        serviceList.forEach(service => services.add(service));
      }
    });

    return Array.from(services);
  }

  /**
   * Analyze architecture using AWS Documentation MCP server and Bedrock Haiku 3
   */
  async analyzeArchitecture(architectureDescription, workflowId) {
    try {
      logger.info(`Starting architecture analysis for workflow: ${workflowId}`);

      // Initialize MCP client
      await this.initializeMCP();

      // Query AWS Documentation MCP server with multiple targeted queries
      const documentationQueries = this.generateDocumentationQueries(architectureDescription);
      const awsDocumentation = await this.queryMultipleTopics(documentationQueries);
      
      // Extract recommended AWS services
      const awsServices = this.extractAWSServices(architectureDescription, awsDocumentation);

      // Get additional service-specific information via MCP
      const serviceDetails = await this.getServiceDetails(awsServices);

      // Create comprehensive prompt for Bedrock Haiku 3
      const prompt = this.createAnalysisPrompt(architectureDescription, awsDocumentation, awsServices, serviceDetails);

      // Use Bedrock Haiku 3 for analysis
      const analysis = await bedrockService.generateContent(prompt, {
        modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
        maxTokens: 4000,
        temperature: 0.3
      });

      logger.info('Architecture analysis completed successfully');

      return {
        analysis: analysis,
        awsServices: awsServices,
        recommendations: this.extractRecommendations(analysis),
        documentation: awsDocumentation,
        serviceDetails: serviceDetails
      };

    } catch (error) {
      logger.error('Error in architecture analysis:', error);
      throw new Error('Failed to analyze architecture: ' + error.message);
    }
  }

  /**
   * Generate targeted documentation queries based on architecture description
   */
  generateDocumentationQueries(architectureDescription) {
    const queries = [];
    const description = architectureDescription.toLowerCase();

    // Base query
    queries.push(architectureDescription);

    // Add specific queries based on keywords
    if (description.includes('microservices') || description.includes('api')) {
      queries.push('microservices architecture AWS ECS Lambda API Gateway');
    }
    if (description.includes('database') || description.includes('data')) {
      queries.push('AWS database services RDS DynamoDB Aurora');
    }
    if (description.includes('storage') || description.includes('file')) {
      queries.push('AWS storage services S3 EFS EBS');
    }
    if (description.includes('auth') || description.includes('user')) {
      queries.push('AWS authentication Cognito IAM user management');
    }
    if (description.includes('real-time') || description.includes('streaming')) {
      queries.push('AWS real-time processing Kinesis streaming data');
    }
    if (description.includes('serverless') || description.includes('lambda')) {
      queries.push('AWS serverless architecture Lambda API Gateway');
    }
    if (description.includes('container') || description.includes('docker')) {
      queries.push('AWS container services ECS EKS Fargate');
    }
    if (description.includes('monitoring') || description.includes('logging')) {
      queries.push('AWS monitoring CloudWatch X-Ray logging');
    }
    if (description.includes('security') || description.includes('encryption')) {
      queries.push('AWS security best practices IAM KMS WAF');
    }

    return queries.slice(0, 5); // Limit to 5 queries to avoid overwhelming the MCP server
  }

  /**
   * Query multiple topics and combine results
   */
  async queryMultipleTopics(queries) {
    const allDocumentation = { content: [] };

    for (const query of queries) {
      try {
        const result = await this.queryAWSDocumentation(query);
        if (result && result.content) {
          allDocumentation.content.push(...result.content);
        }
      } catch (error) {
        logger.warn(`Failed to query documentation for: ${query}`, error);
      }
    }

    // Remove duplicates based on title
    const uniqueContent = [];
    const seenTitles = new Set();
    
    allDocumentation.content.forEach(doc => {
      if (!seenTitles.has(doc.title)) {
        seenTitles.add(doc.title);
        uniqueContent.push(doc);
      }
    });

    allDocumentation.content = uniqueContent.slice(0, 10); // Limit to 10 documents
    return allDocumentation;
  }

  /**
   * Get detailed information for specific AWS services via MCP
   */
  async getServiceDetails(awsServices) {
    const serviceDetails = {};

    if (!mcpClient.isServerConnected()) {
      return serviceDetails;
    }

    // Get details for top 5 services to avoid overwhelming the system
    const topServices = awsServices.slice(0, 5);

    for (const service of topServices) {
      try {
        const details = await mcpClient.getServiceInfo(service);
        if (details && details.content) {
          serviceDetails[service] = details.content;
        }
      } catch (error) {
        logger.warn(`Failed to get details for service: ${service}`, error);
      }
    }

    return serviceDetails;
  }

  /**
   * Create comprehensive analysis prompt for Bedrock Haiku 3
   */
  createAnalysisPrompt(architectureDescription, awsDocumentation, awsServices) {
    const docContent = awsDocumentation?.content?.map(doc => 
      `${doc.title}: ${doc.content}`
    ).join('\n\n') || 'No specific AWS documentation available.';

    return `You are an AWS Solutions Architect expert. Analyze the following architecture requirements and provide comprehensive recommendations using AWS services and best practices.

ARCHITECTURE REQUIREMENTS:
${architectureDescription}

RELEVANT AWS DOCUMENTATION:
${docContent}

RECOMMENDED AWS SERVICES:
${awsServices.join(', ')}

Please provide a detailed analysis covering:

1. **ARCHITECTURE OVERVIEW**
   - High-level architecture design
   - Key components and their relationships
   - Data flow and integration patterns

2. **AWS SERVICES RECOMMENDATIONS**
   - Specific AWS services for each component
   - Justification for service selection
   - Service configuration recommendations

3. **SCALABILITY & PERFORMANCE**
   - Auto-scaling strategies
   - Performance optimization techniques
   - Load balancing and distribution

4. **SECURITY BEST PRACTICES**
   - Security architecture recommendations
   - Identity and access management
   - Data encryption and protection

5. **COST OPTIMIZATION**
   - Cost-effective service selections
   - Reserved instances and savings plans
   - Monitoring and cost management

6. **OPERATIONAL EXCELLENCE**
   - Monitoring and logging strategy
   - Backup and disaster recovery
   - DevOps and CI/CD integration

7. **IMPLEMENTATION ROADMAP**
   - Phase-wise implementation plan
   - Migration strategies (if applicable)
   - Timeline and milestones

Format the response in clear, structured markdown with specific AWS service names, configuration details, and actionable recommendations.`;
  }

  /**
   * Extract key recommendations from analysis
   */
  extractRecommendations(analysis) {
    const recommendations = [];
    
    // Simple extraction of key points (could be enhanced with NLP)
    const lines = analysis.split('\n');
    lines.forEach(line => {
      if (line.includes('recommend') || line.includes('should') || line.includes('consider')) {
        const cleaned = line.replace(/[#*-]/g, '').trim();
        if (cleaned.length > 20) {
          recommendations.push(cleaned);
        }
      }
    });

    return recommendations.slice(0, 10); // Return top 10 recommendations
  }

  /**
   * Cleanup resources including MCP client
   */
  cleanup() {
    logger.info('Cleaning up architecture analysis service...');
    try {
      mcpClient.cleanup();
      this.mcpInitialized = false;
    } catch (error) {
      logger.warn('Error during cleanup:', error);
    }
  }
}

module.exports = new ArchitectureAnalysisService();