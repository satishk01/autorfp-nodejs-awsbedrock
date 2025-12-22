const geminiService = require('./geminiService');
const logger = require('../utils/logger');

class ProfessionalArchitectureDiagramService {
  constructor() {
    this.diagramCache = new Map();
    this.awsColors = {
      primary: '#FF9900',      // AWS Orange
      secondary: '#232F3E',    // AWS Dark Blue
      compute: '#FF9900',      // Orange for compute services
      storage: '#3F48CC',      // Blue for storage services
      database: '#3F48CC',     // Blue for database services
      networking: '#9D5AAE',   // Purple for networking
      security: '#DD344C',     // Red for security
      analytics: '#01A88D',    // Teal for analytics
      background: '#FFFFFF',   // White background
      vpc: '#FF9900',         // Orange for VPC boundaries
      subnet: '#E8F4FD'       // Light blue for subnets
    };
    this.awsServiceShapes = this.initializeAWSServiceShapes();
  }

  initializeAWSServiceShapes() {
    return {
      'EC2': {
        shape: 'server-rack',
        color: this.awsColors.compute,
        icon: 'M10,5 L90,5 L90,15 L10,15 Z M10,20 L90,20 L90,30 L10,30 Z M10,35 L90,35 L90,45 L10,45 Z',
        width: 80,
        height: 60
      },
      'S3': {
        shape: 'bucket',
        color: this.awsColors.storage,
        icon: 'M20,10 Q20,5 25,5 L75,5 Q80,5 80,10 L80,40 Q80,45 75,45 L25,45 Q20,45 20,40 Z',
        width: 70,
        height: 50
      },
      'RDS': {
        shape: 'cylinder',
        color: this.awsColors.database,
        icon: 'M50,10 A30,8 0 0,1 50,10 A30,8 0 0,1 50,10 M20,10 L20,40 A30,8 0 0,0 80,40 L80,10',
        width: 70,
        height: 50
      },
      'Lambda': {
        shape: 'function',
        color: this.awsColors.compute,
        icon: 'M25,15 L35,35 L45,15 L55,35 L65,15 L75,35 L45,45 L25,15 Z',
        width: 60,
        height: 50
      },
      'API Gateway': {
        shape: 'gateway',
        color: this.awsColors.networking,
        icon: 'M50,10 L70,25 L50,40 L30,25 Z M20,25 L30,25 M70,25 L80,25',
        width: 70,
        height: 40
      },
      'CloudFront': {
        shape: 'globe',
        color: this.awsColors.networking,
        icon: 'M50,10 A20,20 0 1,1 50,50 A20,20 0 1,1 50,10 M30,30 Q50,20 70,30 M30,30 Q50,40 70,30',
        width: 60,
        height: 60
      },
      'ALB': {
        shape: 'load-balancer',
        color: this.awsColors.networking,
        icon: 'M30,20 L70,20 M30,30 L70,30 M30,40 L70,40 M20,15 L20,45 M80,15 L80,45',
        width: 80,
        height: 50
      },
      'VPC': {
        shape: 'boundary',
        color: this.awsColors.vpc,
        strokeDasharray: '5,5',
        fill: 'none',
        stroke: this.awsColors.vpc,
        strokeWidth: 2
      }
    };
  }

  async generateProfessionalDiagram(architectureAnalysis, workflowId) {
    try {
      logger.info(`Generating professional architecture diagram for workflow: ${workflowId}`);

      // Extract comprehensive AWS services and components
      const awsServices = this.extractComprehensiveAWSServices(architectureAnalysis);
      const architecturalComponents = this.extractArchitecturalComponents(architectureAnalysis);
      const securityComponents = this.extractSecurityComponents(architectureAnalysis);
      const dataFlow = this.extractDataFlow(architectureAnalysis);

      // Generate professional diagram using enhanced Gemini prompt
      const diagramData = await this.generateEnhancedDiagramWithGemini(
        architectureAnalysis, 
        awsServices, 
        architecturalComponents,
        securityComponents,
        dataFlow
      );

      // Enhance with professional styling and AWS compliance
      const enhancedDiagram = await this.enhanceWithProfessionalStyling(diagramData);

      logger.info('Professional architecture diagram generated successfully');
      return enhancedDiagram;

    } catch (error) {
      logger.error('Error generating professional architecture diagram:', error);
      throw new Error('Failed to generate professional architecture diagram: ' + error.message);
    }
  }

  extractComprehensiveAWSServices(analysis) {
    const awsServicePatterns = {
      // Compute Services
      'EC2': /EC2|Elastic Compute|virtual machine|instance|server/gi,
      'Lambda': /Lambda|serverless|function|FaaS/gi,
      'ECS': /ECS|Elastic Container|container service/gi,
      'EKS': /EKS|Kubernetes|K8s/gi,
      'Fargate': /Fargate|serverless container/gi,
      
      // Storage Services
      'S3': /S3|Simple Storage|object storage|bucket/gi,
      'EBS': /EBS|Elastic Block Store|block storage/gi,
      'EFS': /EFS|Elastic File System|file storage/gi,
      
      // Database Services
      'RDS': /RDS|Relational Database|MySQL|PostgreSQL|Oracle|SQL Server/gi,
      'DynamoDB': /DynamoDB|NoSQL|document database/gi,
      'ElastiCache': /ElastiCache|Redis|Memcached|cache/gi,
      'DocumentDB': /DocumentDB|MongoDB/gi,
      
      // Networking Services
      'VPC': /VPC|Virtual Private Cloud|network/gi,
      'ALB': /ALB|Application Load Balancer|load balancer/gi,
      'NLB': /NLB|Network Load Balancer/gi,
      'CloudFront': /CloudFront|CDN|content delivery/gi,
      'Route 53': /Route 53|DNS|domain/gi,
      'API Gateway': /API Gateway|API management/gi,
      
      // Security Services
      'IAM': /IAM|Identity|Access Management|authentication/gi,
      'WAF': /WAF|Web Application Firewall|firewall/gi,
      'Shield': /Shield|DDoS protection/gi,
      'KMS': /KMS|Key Management|encryption/gi,
      'Secrets Manager': /Secrets Manager|secret|credential/gi,
      
      // Monitoring Services
      'CloudWatch': /CloudWatch|monitoring|metrics|logs/gi,
      'X-Ray': /X-Ray|tracing|distributed tracing/gi,
      'CloudTrail': /CloudTrail|audit|logging/gi,
      
      // DevOps Services
      'CodePipeline': /CodePipeline|CI\/CD|pipeline/gi,
      'CodeBuild': /CodeBuild|build service/gi,
      'CodeDeploy': /CodeDeploy|deployment/gi,
      
      // Analytics Services
      'Kinesis': /Kinesis|streaming|real-time/gi,
      'EMR': /EMR|Elastic MapReduce|big data/gi,
      'Redshift': /Redshift|data warehouse/gi,
      'QuickSight': /QuickSight|business intelligence|BI/gi
    };

    const detectedServices = [];
    Object.entries(awsServicePatterns).forEach(([service, pattern]) => {
      if (pattern.test(analysis)) {
        detectedServices.push(service);
      }
    });

    // Ensure minimum viable architecture
    if (detectedServices.length === 0) {
      detectedServices.push('EC2', 'RDS', 'S3', 'VPC', 'ALB');
    }

    return detectedServices;
  }

  extractArchitecturalComponents(analysis) {
    const components = [];
    
    // Extract tiers
    if (/presentation|frontend|UI|web/gi.test(analysis)) {
      components.push('Presentation Tier');
    }
    if (/application|business logic|API|service/gi.test(analysis)) {
      components.push('Application Tier');
    }
    if (/database|data|storage|persistence/gi.test(analysis)) {
      components.push('Data Tier');
    }
    
    // Extract patterns
    if (/microservice|service-oriented/gi.test(analysis)) {
      components.push('Microservices Architecture');
    }
    if (/event-driven|messaging|queue/gi.test(analysis)) {
      components.push('Event-Driven Architecture');
    }
    
    return components;
  }

  extractSecurityComponents(analysis) {
    const security = [];
    
    if (/authentication|auth|login/gi.test(analysis)) {
      security.push('Authentication');
    }
    if (/authorization|permission|access control/gi.test(analysis)) {
      security.push('Authorization');
    }
    if (/encryption|SSL|TLS|HTTPS/gi.test(analysis)) {
      security.push('Encryption');
    }
    if (/firewall|WAF|security group/gi.test(analysis)) {
      security.push('Network Security');
    }
    
    return security;
  }

  extractDataFlow(analysis) {
    const flows = [];
    
    // Common data flow patterns
    flows.push('User Request');
    flows.push('Load Balancing');
    flows.push('Application Processing');
    flows.push('Database Query');
    flows.push('Response Delivery');
    
    return flows;
  }

  async generateEnhancedDiagramWithGemini(architectureAnalysis, awsServices, components, security, dataFlow) {
    const prompt = `You are a Senior AWS Solutions Architect creating enterprise-grade architecture diagrams for C-level presentations and technical documentation. Generate professional AWS architecture diagrams that match AWS Well-Architected Framework standards and can be used in Lucid Chart, Draw.io, and enterprise presentations.

ARCHITECTURE ANALYSIS:
${architectureAnalysis}

IDENTIFIED AWS SERVICES:
${awsServices.join(', ')}

ARCHITECTURAL COMPONENTS:
${components.join(', ')}

SECURITY COMPONENTS:
${security.join(', ')}

DATA FLOW:
${dataFlow.join(' → ')}

Generate comprehensive, professional AWS architecture diagrams with these specifications:

## 1. PROFESSIONAL SVG DIAGRAM (Primary Output)
Create an enterprise-grade SVG diagram with:

### Visual Standards:
- Clean white background with subtle grid lines
- AWS official colors: Orange (#FF9900), Dark Blue (#232F3E)
- Professional typography (Arial, 12-14px)
- Proper spacing and alignment for presentations

### AWS Service Shapes (CRITICAL - Use distinctive shapes, NOT rectangles):
- **EC2**: Server rack shape with horizontal segments
- **S3**: Bucket shape with curved top and bottom edges
- **RDS**: Database cylinder with elliptical top/bottom
- **Lambda**: Function symbol (λ) or hexagonal function icon
- **API Gateway**: Network gateway with connection nodes
- **CloudFront**: Globe with radiating distribution lines
- **ALB/NLB**: Load balancer with multiple connection points
- **VPC**: Dashed boundary rectangle with subnet divisions

### Architecture Layout:
- Multi-tier layout: Presentation → Application → Data
- VPC boundaries with Availability Zones (AZ-1, AZ-2)
- Public and Private subnets clearly marked
- Security groups and NACLs representation
- Numbered data flow (1→2→3→4→5) with arrows

### Professional Elements:
- Account boundaries and region labels
- Service names and descriptions
- Connection protocols and ports
- Security indicators (locks, shields)
- Monitoring and logging indicators
- Backup and DR components

## 2. DRAW.IO XML FORMAT
Generate complete Draw.io XML using AWS service library:
- Use mxgraph.aws4.* shapes for all AWS services
- Professional layout with proper grouping
- VPC and subnet containers
- Connection lines with labels
- AWS official styling and colors

## 3. ENHANCED MERMAID DIAGRAM
Create detailed architectural flowchart:
- Multi-level architecture representation
- AWS service nodes with proper icons
- Data flow with numbered steps
- Security and monitoring integration
- Backup and disaster recovery flows

## 4. TECHNICAL SPECIFICATIONS
For each connection, provide:
- Protocol and port information
- Security requirements
- Performance considerations
- Scalability notes
- Monitoring points

CRITICAL REQUIREMENTS:
- Diagrams must be presentation-ready for executives
- Use AWS official service shapes and colors
- Include comprehensive security boundaries
- Show proper data flow with numbered steps
- Make diagrams importable into Lucid Chart and Draw.io
- Focus on enterprise-grade visual quality

Return response in this exact JSON format:
{
  "svg": "<svg width='1200' height='800'><!-- Professional SVG with AWS shapes --></svg>",
  "drawio": "<?xml version='1.0'?><!-- Complete Draw.io XML -->",
  "mermaid": "flowchart TB\\n<!-- Enhanced Mermaid diagram -->",
  "technicalSpecs": [
    {
      "step": 1,
      "connection": "User → CloudFront",
      "protocol": "HTTPS",
      "port": "443",
      "security": "SSL/TLS encryption",
      "description": "Content delivery and caching"
    }
  ],
  "description": "Executive summary of the architecture"
}`;

    try {
      const response = await geminiService.generateContent(prompt, {
        temperature: 0.2,
        maxOutputTokens: 12000
      });

      return await this.parseProfessionalDiagramResponse(response);

    } catch (error) {
      logger.error('Enhanced Gemini diagram generation failed:', error);
      return this.generateProfessionalFallbackDiagram(awsServices, components);
    }
  }

  async parseProfessionalDiagramResponse(response) {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const diagramData = JSON.parse(jsonMatch[0]);
        
        // Validate and enhance
        return {
          svg: this.enhanceSVGDiagram(diagramData.svg || ''),
          drawio: this.enhanceDrawioDiagram(diagramData.drawio || ''),
          mermaid: this.enhanceMermaidDiagram(diagramData.mermaid || ''),
          technicalSpecs: diagramData.technicalSpecs || [],
          description: diagramData.description || 'Professional AWS Architecture Diagram',
          formats: {
            svg: true,
            drawio: true,
            mermaid: true,
            png: true // Will be generated from SVG
          }
        };
      }
      
      throw new Error('No valid JSON found in response');
      
    } catch (error) {
      logger.error('Error parsing professional diagram response:', error);
      return this.generateProfessionalFallbackDiagram(['EC2', 'RDS', 'S3'], ['Multi-tier Architecture']);
    }
  }

  enhanceSVGDiagram(svg) {
    if (!svg || svg.length < 100) {
      return this.generateProfessionalSVGFallback();
    }
    
    // Enhance SVG with professional styling
    return svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
              .replace(/width='\d+'/, 'width="1200"')
              .replace(/height='\d+'/, 'height="800"');
  }

  enhanceDrawioDiagram(drawio) {
    if (!drawio || drawio.length < 100) {
      return this.generateProfessionalDrawioFallback();
    }
    return drawio;
  }

  enhanceMermaidDiagram(mermaid) {
    if (!mermaid || mermaid.length < 50) {
      return this.generateProfessionalMermaidFallback();
    }
    return mermaid;
  }

  generateProfessionalSVGFallback() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
      <!-- Professional AWS Architecture Diagram -->
      <defs>
        <style>
          .aws-service { font-family: Arial, sans-serif; font-size: 12px; }
          .aws-title { font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; }
          .vpc-boundary { fill: none; stroke: #FF9900; stroke-width: 2; stroke-dasharray: 5,5; }
          .data-flow { stroke: #232F3E; stroke-width: 2; marker-end: url(#arrowhead); }
        </style>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#232F3E" />
        </marker>
      </defs>
      
      <!-- Background -->
      <rect width="1200" height="800" fill="#FFFFFF"/>
      
      <!-- AWS Account Boundary -->
      <rect x="50" y="50" width="1100" height="700" fill="none" stroke="#232F3E" stroke-width="3"/>
      <text x="70" y="40" class="aws-title" fill="#232F3E">Customer's AWS Account</text>
      
      <!-- VPC Boundary -->
      <rect x="100" y="100" width="1000" height="600" class="vpc-boundary"/>
      <text x="120" y="90" class="aws-title" fill="#FF9900">VPC (10.0.0.0/16)</text>
      
      <!-- Public Subnet -->
      <rect x="150" y="150" width="400" height="200" fill="#E8F4FD" stroke="#3F48CC" stroke-width="1"/>
      <text x="170" y="140" class="aws-service" fill="#3F48CC">Public Subnet (10.0.1.0/24)</text>
      
      <!-- Private Subnet -->
      <rect x="600" y="150" width="400" height="200" fill="#FFF2E8" stroke="#FF9900" stroke-width="1"/>
      <text x="620" y="140" class="aws-service" fill="#FF9900">Private Subnet (10.0.2.0/24)</text>
      
      <!-- CloudFront (Globe shape) -->
      <g transform="translate(200,200)">
        <circle cx="0" cy="0" r="30" fill="#9D5AAE" stroke="#232F3E" stroke-width="2"/>
        <ellipse cx="0" cy="0" rx="30" ry="15" fill="none" stroke="#FFFFFF" stroke-width="2"/>
        <ellipse cx="0" cy="0" rx="15" ry="30" fill="none" stroke="#FFFFFF" stroke-width="2"/>
        <text x="-25" y="50" class="aws-service" fill="#232F3E">CloudFront</text>
      </g>
      
      <!-- ALB (Load Balancer shape) -->
      <g transform="translate(350,200)">
        <rect x="-40" y="-20" width="80" height="40" fill="#9D5AAE" stroke="#232F3E" stroke-width="2" rx="5"/>
        <line x1="-30" y1="-10" x2="30" y2="-10" stroke="#FFFFFF" stroke-width="2"/>
        <line x1="-30" y1="0" x2="30" y2="0" stroke="#FFFFFF" stroke-width="2"/>
        <line x1="-30" y1="10" x2="30" y2="10" stroke="#FFFFFF" stroke-width="2"/>
        <text x="-15" y="50" class="aws-service" fill="#232F3E">ALB</text>
      </g>
      
      <!-- EC2 (Server rack shape) -->
      <g transform="translate(750,200)">
        <rect x="-35" y="-25" width="70" height="50" fill="#FF9900" stroke="#232F3E" stroke-width="2" rx="3"/>
        <rect x="-30" y="-20" width="60" height="8" fill="#232F3E"/>
        <rect x="-30" y="-8" width="60" height="8" fill="#232F3E"/>
        <rect x="-30" y="4" width="60" height="8" fill="#232F3E"/>
        <text x="-15" y="45" class="aws-service" fill="#232F3E">EC2</text>
      </g>
      
      <!-- RDS (Cylinder shape) -->
      <g transform="translate(750,450)">
        <ellipse cx="0" cy="-20" rx="35" ry="8" fill="#3F48CC" stroke="#232F3E" stroke-width="2"/>
        <rect x="-35" y="-20" width="70" height="40" fill="#3F48CC" stroke="none"/>
        <ellipse cx="0" cy="20" rx="35" ry="8" fill="#3F48CC" stroke="#232F3E" stroke-width="2"/>
        <line x1="-35" y1="-20" x2="-35" y2="20" stroke="#232F3E" stroke-width="2"/>
        <line x1="35" y1="-20" x2="35" y2="20" stroke="#232F3E" stroke-width="2"/>
        <text x="-15" y="50" class="aws-service" fill="#232F3E">RDS</text>
      </g>
      
      <!-- S3 (Bucket shape) -->
      <g transform="translate(200,450)">
        <path d="M-30,-20 Q-30,-25 -25,-25 L25,-25 Q30,-25 30,-20 L30,15 Q30,20 25,20 L-25,20 Q-30,20 -30,15 Z" 
              fill="#3F48CC" stroke="#232F3E" stroke-width="2"/>
        <ellipse cx="0" cy="-20" rx="25" ry="5" fill="#4A90E2" stroke="#232F3E" stroke-width="1"/>
        <text x="-10" y="45" class="aws-service" fill="#232F3E">S3</text>
      </g>
      
      <!-- Data Flow Arrows -->
      <line x1="230" y1="200" x2="320" y2="200" class="data-flow"/>
      <text x="270" y="190" class="aws-service" fill="#232F3E">1</text>
      
      <line x1="380" y1="200" x2="720" y2="200" class="data-flow"/>
      <text x="550" y="190" class="aws-service" fill="#232F3E">2</text>
      
      <line x1="750" y1="225" x2="750" y2="425" class="data-flow"/>
      <text x="760" y="325" class="aws-service" fill="#232F3E">3</text>
      
      <line x1="720" y1="450" x2="230" y2="450" class="data-flow"/>
      <text x="475" y="440" class="aws-service" fill="#232F3E">4</text>
      
      <!-- Legend -->
      <rect x="50" y="750" width="300" height="40" fill="#F5F5F5" stroke="#232F3E" stroke-width="1"/>
      <text x="60" y="765" class="aws-service" fill="#232F3E">Data Flow: 1→CDN 2→Load Balancer 3→Database 4→Storage</text>
    </svg>`;
  }

  generateProfessionalDrawioFallback() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="2024-01-01T00:00:00.000Z" agent="Professional AWS Architecture" version="22.1.0">
  <diagram name="AWS Architecture" id="aws-arch">
    <mxGraphModel dx="1422" dy="794" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1200" pageHeight="800" background="#ffffff">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <!-- AWS Account -->
        <mxCell id="aws-account" value="Customer's AWS Account" style="rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#232F3E;strokeWidth=3;fontSize=14;fontStyle=1;" vertex="1" parent="1">
          <mxGeometry x="50" y="50" width="1100" height="700" as="geometry"/>
        </mxCell>
        <!-- VPC -->
        <mxCell id="vpc" value="VPC (10.0.0.0/16)" style="rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#FF9900;strokeWidth=2;dashed=1;fontSize=12;fontStyle=1;" vertex="1" parent="1">
          <mxGeometry x="100" y="100" width="1000" height="600" as="geometry"/>
        </mxCell>
        <!-- CloudFront -->
        <mxCell id="cloudfront" value="" style="sketch=0;points=[[0,0,0],[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0,0],[0,1,0],[0.25,1,0],[0.5,1,0],[0.75,1,0],[1,1,0],[0,0.25,0],[0,0.5,0],[0,0.75,0],[1,0.25,0],[1,0.5,0],[1,0.75,0]];outlineConnect=0;fontColor=#232F3E;gradientColor=#945DF2;gradientDirection=north;fillColor=#5A30B5;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.cloudfront;" vertex="1" parent="1">
          <mxGeometry x="170" y="170" width="60" height="60" as="geometry"/>
        </mxCell>
        <!-- Application Load Balancer -->
        <mxCell id="alb" value="" style="sketch=0;points=[[0,0,0],[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0,0],[0,1,0],[0.25,1,0],[0.5,1,0],[0.75,1,0],[1,1,0],[0,0.25,0],[0,0.5,0],[0,0.75,0],[1,0.25,0],[1,0.5,0],[1,0.75,0]];outlineConnect=0;fontColor=#232F3E;gradientColor=#945DF2;gradientDirection=north;fillColor=#5A30B5;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.application_load_balancer;" vertex="1" parent="1">
          <mxGeometry x="320" y="170" width="60" height="60" as="geometry"/>
        </mxCell>
        <!-- EC2 -->
        <mxCell id="ec2" value="" style="sketch=0;points=[[0,0,0],[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0,0],[0,1,0],[0.25,1,0],[0.5,1,0],[0.75,1,0],[1,1,0],[0,0.25,0],[0,0.5,0],[0,0.75,0],[1,0.25,0],[1,0.5,0],[1,0.75,0]];outlineConnect=0;fontColor=#232F3E;gradientColor=#F78E04;gradientDirection=north;fillColor=#D05C17;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.ec2;" vertex="1" parent="1">
          <mxGeometry x="720" y="170" width="60" height="60" as="geometry"/>
        </mxCell>
        <!-- RDS -->
        <mxCell id="rds" value="" style="sketch=0;points=[[0,0,0],[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0,0],[0,1,0],[0.25,1,0],[0.5,1,0],[0.75,1,0],[1,1,0],[0,0.25,0],[0,0.5,0],[0,0.75,0],[1,0.25,0],[1,0.5,0],[1,0.75,0]];outlineConnect=0;fontColor=#232F3E;gradientColor=#4AB29A;gradientDirection=north;fillColor=#116D5B;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.rds;" vertex="1" parent="1">
          <mxGeometry x="720" y="420" width="60" height="60" as="geometry"/>
        </mxCell>
        <!-- S3 -->
        <mxCell id="s3" value="" style="sketch=0;points=[[0,0,0],[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0,0],[0,1,0],[0.25,1,0],[0.5,1,0],[0.75,1,0],[1,1,0],[0,0.25,0],[0,0.5,0],[0,0.75,0],[1,0.25,0],[1,0.5,0],[1,0.75,0]];outlineConnect=0;fontColor=#232F3E;gradientColor=#60A337;gradientDirection=north;fillColor=#277116;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.s3;" vertex="1" parent="1">
          <mxGeometry x="170" y="420" width="60" height="60" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
  }

  generateProfessionalMermaidFallback() {
    return `flowchart TB
    subgraph AWS["🏢 Customer's AWS Account"]
        subgraph VPC["🌐 VPC (10.0.0.0/16)"]
            subgraph PublicSubnet["📡 Public Subnet"]
                CF[🌍 CloudFront<br/>CDN]
                ALB[⚖️ Application<br/>Load Balancer]
            end
            
            subgraph PrivateSubnet["🔒 Private Subnet"]
                EC2[🖥️ EC2 Instances<br/>Application Servers]
                RDS[🗄️ RDS<br/>Database]
            end
            
            S3[🪣 S3<br/>Object Storage]
        end
    end
    
    User[👤 Users] --> CF
    CF --> ALB
    ALB --> EC2
    EC2 --> RDS
    EC2 --> S3
    
    classDef aws fill:#FF9900,stroke:#232F3E,stroke-width:2px,color:#fff
    classDef compute fill:#FF9900,stroke:#232F3E,stroke-width:2px,color:#fff
    classDef storage fill:#3F48CC,stroke:#232F3E,stroke-width:2px,color:#fff
    classDef network fill:#9D5AAE,stroke:#232F3E,stroke-width:2px,color:#fff
    
    class CF,ALB network
    class EC2 compute
    class RDS,S3 storage`;
  }

  generateProfessionalFallbackDiagram(awsServices, components) {
    return {
      svg: this.generateProfessionalSVGFallback(),
      drawio: this.generateProfessionalDrawioFallback(),
      mermaid: this.generateProfessionalMermaidFallback(),
      technicalSpecs: [
        {
          step: 1,
          connection: "User → CloudFront",
          protocol: "HTTPS",
          port: "443",
          security: "SSL/TLS encryption",
          description: "Content delivery and caching"
        },
        {
          step: 2,
          connection: "CloudFront → ALB",
          protocol: "HTTPS",
          port: "443",
          security: "AWS WAF protection",
          description: "Load balancing and SSL termination"
        },
        {
          step: 3,
          connection: "ALB → EC2",
          protocol: "HTTP",
          port: "80",
          security: "Security groups",
          description: "Application processing"
        },
        {
          step: 4,
          connection: "EC2 → RDS",
          protocol: "MySQL",
          port: "3306",
          security: "VPC security groups",
          description: "Database operations"
        }
      ],
      description: "Professional AWS multi-tier architecture with CloudFront CDN, Application Load Balancer, EC2 compute instances, and RDS database in a secure VPC environment.",
      formats: {
        svg: true,
        drawio: true,
        mermaid: true,
        png: true
      }
    };
  }

  async enhanceWithProfessionalStyling(diagramData) {
    // Add professional enhancements and technical writeups
    let technicalWriteups = null;
    try {
      const awsServices = this.extractComprehensiveAWSServices(diagramData.description || '');
      technicalWriteups = await this.generateTechnicalWriteups(awsServices, diagramData.description || '');
      logger.info('Technical writeups generated successfully for professional diagram');
    } catch (error) {
      logger.error('Error generating technical writeups for professional diagram:', error);
      technicalWriteups = { connections: [], summary: null, totalConnections: 0 };
    }

    return {
      ...diagramData,
      technicalWriteups: technicalWriteups,
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '2.0',
        standard: 'AWS Well-Architected Framework',
        quality: 'Enterprise Grade',
        exportFormats: ['SVG', 'PNG', 'Draw.io', 'Mermaid'],
        compatibility: ['Lucid Chart', 'Draw.io', 'Visio', 'PowerPoint']
      }
    };
  }

  /**
   * Generate technical writeups for professional diagrams using AWS Bedrock Claude Haiku 3
   */
  async generateTechnicalWriteups(awsServices, architectureAnalysis) {
    try {
      const bedrock = require('./bedrock');
      
      // Analyze the services and create technical explanations for each connection
      const serviceConnections = this.analyzeServiceConnections(awsServices);
      
      // Generate technical writeups using Claude Haiku 3
      const writeups = await this.generateConnectionWriteupsWithClaude(serviceConnections, architectureAnalysis, awsServices);
      
      // Generate overall architecture summary using Claude Haiku 3
      const architectureSummary = await this.generateArchitectureSummaryWithClaude(awsServices, architectureAnalysis);
      
      return {
        connections: writeups,
        summary: architectureSummary,
        totalConnections: writeups.length
      };
    } catch (error) {
      logger.error('Error generating technical writeups with Claude:', error);
      // Fallback to basic writeups if Claude fails
      return this.generateFallbackTechnicalWriteups(awsServices, architectureAnalysis);
    }
  }

  /**
   * Generate connection writeups using AWS Bedrock Claude Haiku 3
   */
  async generateConnectionWriteupsWithClaude(serviceConnections, architectureAnalysis, awsServices) {
    const bedrock = require('./bedrock');
    
    const prompt = `You are a Senior AWS Solutions Architect providing detailed technical analysis for an architecture diagram. 

ARCHITECTURE CONTEXT:
${architectureAnalysis}

AWS SERVICES IDENTIFIED:
${awsServices.join(', ')}

SERVICE CONNECTIONS:
${serviceConnections.map((conn, idx) => `${idx + 1}. ${conn.from} → ${conn.to} (${conn.type})`).join('\n')}

For each numbered connection in the architecture diagram, provide comprehensive technical writeups that a technical architect would give. For each connection, provide:

1. **Technical Details**: Specific implementation details, protocols, data flow patterns
2. **Security Considerations**: Security best practices, encryption, access controls
3. **Performance Optimizations**: Performance tuning, caching strategies, scaling approaches
4. **Monitoring Metrics**: Key metrics to monitor, alerting thresholds, observability

Format your response as a JSON array where each object represents a connection:

[
  {
    "stepNumber": 1,
    "title": "Service A → Service B",
    "protocol": "HTTPS/REST",
    "type": "api_invocation",
    "description": "Brief description of the connection",
    "technicalDetails": [
      "• Detailed technical implementation point 1",
      "• Detailed technical implementation point 2",
      "• Detailed technical implementation point 3",
      "• Detailed technical implementation point 4"
    ],
    "securityConsiderations": [
      "• Security best practice 1",
      "• Security best practice 2", 
      "• Security best practice 3",
      "• Security best practice 4"
    ],
    "performanceOptimizations": [
      "• Performance optimization 1",
      "• Performance optimization 2",
      "• Performance optimization 3", 
      "• Performance optimization 4"
    ],
    "monitoringMetrics": [
      "• Key metric to monitor 1",
      "• Key metric to monitor 2",
      "• Key metric to monitor 3",
      "• Key metric to monitor 4"
    ]
  }
]

Provide detailed, actionable technical guidance that would be valuable for implementation and operations teams. Focus on AWS-specific best practices and real-world implementation considerations.`;

    try {
      const response = await bedrock.generateContent(prompt, 'anthropic.claude-3-haiku-20240307-v1:0');
      
      // Parse the JSON response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const writeups = JSON.parse(jsonMatch[0]);
        return writeups;
      } else {
        logger.warn('No valid JSON found in Claude response for connection writeups');
        return this.generateFallbackConnectionWriteups(serviceConnections, architectureAnalysis);
      }
    } catch (error) {
      logger.error('Error generating connection writeups with Claude:', error);
      return this.generateFallbackConnectionWriteups(serviceConnections, architectureAnalysis);
    }
  }

  /**
   * Generate architecture summary using AWS Bedrock Claude Haiku 3
   */
  async generateArchitectureSummaryWithClaude(awsServices, architectureAnalysis) {
    const bedrock = require('./bedrock');
    
    const prompt = `You are a Senior AWS Solutions Architect providing an executive-level architecture summary.

ARCHITECTURE CONTEXT:
${architectureAnalysis}

AWS SERVICES:
${awsServices.join(', ')}

Provide a comprehensive architecture summary that includes:

1. **Key Components**: Purpose and tier classification for each service
2. **Architecture Patterns**: Design patterns and architectural approaches used
3. **Scalability Considerations**: How the architecture scales and handles growth
4. **Cost Optimization**: Cost-effective strategies and recommendations

Format your response as JSON:

{
  "title": "AWS Architecture Overview",
  "description": "Executive summary of the architecture",
  "keyComponents": [
    {
      "service": "Service Name",
      "purpose": "What this service does in the architecture",
      "tier": "Presentation Tier | Application Tier | Data Tier | Supporting Services"
    }
  ],
  "architecturePatterns": [
    "Pattern 1 description",
    "Pattern 2 description",
    "Pattern 3 description"
  ],
  "scalabilityConsiderations": [
    "Scalability consideration 1",
    "Scalability consideration 2", 
    "Scalability consideration 3"
  ],
  "costOptimization": [
    "Cost optimization strategy 1",
    "Cost optimization strategy 2",
    "Cost optimization strategy 3"
  ]
}

Provide detailed, actionable insights that would be valuable for technical leadership and architecture decision-making.`;

    try {
      const response = await bedrock.generateContent(prompt, 'anthropic.claude-3-haiku-20240307-v1:0');
      
      // Parse the JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const summary = JSON.parse(jsonMatch[0]);
        return summary;
      } else {
        logger.warn('No valid JSON found in Claude response for architecture summary');
        return this.generateFallbackArchitectureSummary(awsServices, architectureAnalysis);
      }
    } catch (error) {
      logger.error('Error generating architecture summary with Claude:', error);
      return this.generateFallbackArchitectureSummary(awsServices, architectureAnalysis);
    }
  }

  /**
   * Analyze service connections to understand data flow
   */
  analyzeServiceConnections(awsServices) {
    const connections = [];
    
    // Define common AWS service connection patterns
    const connectionPatterns = [
      {
        from: 'User/Client',
        to: this.findServiceByType(awsServices, ['cloudfront', 'api gateway', 'load balancer']) || awsServices[0],
        type: 'entry_point',
        protocol: 'HTTPS',
        description: 'Initial user request entry point'
      },
      {
        from: this.findServiceByType(awsServices, ['cloudfront', 'api gateway']) || awsServices[0],
        to: this.findServiceByType(awsServices, ['lambda', 'ec2', 'ecs']) || awsServices[1],
        type: 'compute_invocation',
        protocol: 'HTTP/HTTPS',
        description: 'Request routing to compute layer'
      },
      {
        from: this.findServiceByType(awsServices, ['lambda', 'ec2']) || awsServices[1],
        to: this.findServiceByType(awsServices, ['rds', 'dynamodb']) || awsServices[2],
        type: 'database_access',
        protocol: 'TCP/SQL',
        description: 'Database query and data retrieval'
      },
      {
        from: this.findServiceByType(awsServices, ['lambda', 'ec2']) || awsServices[1],
        to: this.findServiceByType(awsServices, ['s3']) || awsServices[3],
        type: 'storage_access',
        protocol: 'HTTPS/REST',
        description: 'File storage and retrieval operations'
      },
      {
        from: this.findServiceByType(awsServices, ['rds', 'dynamodb']) || awsServices[2],
        to: this.findServiceByType(awsServices, ['elasticache']) || awsServices[4],
        type: 'caching_layer',
        protocol: 'TCP/Redis',
        description: 'Database result caching for performance'
      }
    ];

    // Filter and create actual connections based on available services
    connectionPatterns.forEach(pattern => {
      if (pattern.from && pattern.to && pattern.from !== pattern.to) {
        connections.push(pattern);
      }
    });

    return connections.slice(0, Math.min(8, awsServices.length)); // Limit to reasonable number
  }

  /**
   * Find service by type keywords
   */
  findServiceByType(services, keywords) {
    return services.find(service => {
      const serviceLower = service.toLowerCase();
      return keywords.some(keyword => serviceLower.includes(keyword));
    });
  }

  /**
   * Generate fallback technical writeups when Claude fails
   */
  generateFallbackTechnicalWriteups(awsServices, architectureAnalysis) {
    const serviceConnections = this.analyzeServiceConnections(awsServices);
    const writeups = this.generateFallbackConnectionWriteups(serviceConnections, architectureAnalysis);
    const summary = this.generateFallbackArchitectureSummary(awsServices, architectureAnalysis);
    
    return {
      connections: writeups,
      summary: summary,
      totalConnections: writeups.length
    };
  }

  /**
   * Generate fallback connection writeups
   */
  generateFallbackConnectionWriteups(serviceConnections, architectureAnalysis) {
    return serviceConnections.map((connection, index) => {
      const stepNumber = index + 1;
      return this.generateConnectionWriteup(connection, stepNumber, architectureAnalysis);
    });
  }

  /**
   * Generate detailed technical writeup for a specific connection
   */
  generateConnectionWriteup(connection, stepNumber, architectureAnalysis) {
    const fromService = typeof connection.from === 'string' ? connection.from : connection.from.replace('Amazon ', '').replace('AWS ', '');
    const toService = typeof connection.to === 'string' ? connection.to : connection.to.replace('Amazon ', '').replace('AWS ', '');
    
    const writeup = {
      stepNumber: stepNumber,
      title: `${fromService} → ${toService}`,
      protocol: connection.protocol,
      type: connection.type,
      description: connection.description,
      technicalDetails: this.generateTechnicalDetails(connection, architectureAnalysis),
      securityConsiderations: this.generateSecurityConsiderations(connection),
      performanceOptimizations: this.generatePerformanceOptimizations(connection),
      monitoringMetrics: this.generateMonitoringMetrics(connection)
    };

    return writeup;
  }

  /**
   * Generate technical details for a connection
   */
  generateTechnicalDetails(connection, architectureAnalysis) {
    const details = [];
    
    switch (connection.type) {
      case 'entry_point':
        details.push('• Client initiates HTTPS request through DNS resolution');
        details.push('• SSL/TLS termination at edge location or load balancer');
        details.push('• Request routing based on path, headers, or geographic location');
        details.push('• Connection pooling and keep-alive optimization');
        break;
        
      case 'compute_invocation':
        details.push('• Synchronous or asynchronous function invocation');
        details.push('• Request payload validation and transformation');
        details.push('• Auto-scaling based on concurrent execution metrics');
        details.push('• Cold start optimization and provisioned concurrency');
        break;
        
      case 'database_access':
        details.push('• Connection pooling to optimize database connections');
        details.push('• Prepared statements for SQL injection prevention');
        details.push('• Read/write splitting for performance optimization');
        details.push('• Transaction management and ACID compliance');
        break;
        
      case 'storage_access':
        details.push('• RESTful API calls with proper authentication');
        details.push('• Multipart upload for large files (>5MB)');
        details.push('• Server-side encryption at rest and in transit');
        details.push('• Lifecycle policies for cost optimization');
        break;
        
      case 'caching_layer':
        details.push('• In-memory caching with TTL-based expiration');
        details.push('• Cache-aside pattern for data consistency');
        details.push('• Cluster mode for high availability and scaling');
        details.push('• Cache warming strategies for optimal performance');
        break;
        
      default:
        details.push('• Service-to-service communication via AWS SDK');
        details.push('• IAM role-based authentication and authorization');
        details.push('• Retry logic with exponential backoff');
        details.push('• Circuit breaker pattern for fault tolerance');
    }
    
    return details;
  }

  /**
   * Generate security considerations for a connection
   */
  generateSecurityConsiderations(connection) {
    const security = [];
    
    switch (connection.type) {
      case 'entry_point':
        security.push('• WAF rules for DDoS and injection attack protection');
        security.push('• Rate limiting and throttling policies');
        security.push('• SSL/TLS 1.2+ enforcement with strong cipher suites');
        security.push('• CORS configuration for cross-origin requests');
        break;
        
      case 'compute_invocation':
        security.push('• IAM execution roles with least privilege principle');
        security.push('• VPC configuration for network isolation');
        security.push('• Environment variable encryption for secrets');
        security.push('• Resource-based policies for fine-grained access');
        break;
        
      case 'database_access':
        security.push('• VPC security groups restricting database access');
        security.push('• Database encryption at rest using AWS KMS');
        security.push('• SSL/TLS encryption for data in transit');
        security.push('• Database activity monitoring and audit logging');
        break;
        
      case 'storage_access':
        security.push('• Bucket policies and ACLs for access control');
        security.push('• Server-side encryption with customer-managed keys');
        security.push('• MFA delete for critical data protection');
        security.push('• Access logging and CloudTrail integration');
        break;
        
      default:
        security.push('• Service-to-service authentication via IAM roles');
        security.push('• Network ACLs and security group configurations');
        security.push('• Encryption in transit and at rest');
        security.push('• Audit logging and compliance monitoring');
    }
    
    return security;
  }

  /**
   * Generate performance optimizations for a connection
   */
  generatePerformanceOptimizations(connection) {
    const optimizations = [];
    
    switch (connection.type) {
      case 'entry_point':
        optimizations.push('• CDN caching with appropriate TTL settings');
        optimizations.push('• Gzip compression for text-based responses');
        optimizations.push('• HTTP/2 support for multiplexed connections');
        optimizations.push('• Edge location optimization for global users');
        break;
        
      case 'compute_invocation':
        optimizations.push('• Provisioned concurrency for consistent performance');
        optimizations.push('• Memory allocation optimization based on workload');
        optimizations.push('• Connection reuse and pooling strategies');
        optimizations.push('• Asynchronous processing for non-blocking operations');
        break;
        
      case 'database_access':
        optimizations.push('• Read replicas for read-heavy workloads');
        optimizations.push('• Connection pooling with optimal pool sizing');
        optimizations.push('• Query optimization and index strategies');
        optimizations.push('• Database parameter tuning for workload');
        break;
        
      case 'storage_access':
        optimizations.push('• Transfer acceleration for global file uploads');
        optimizations.push('• Intelligent tiering for cost-effective storage');
        optimizations.push('• Multipart upload for large file handling');
        optimizations.push('• CloudFront integration for content delivery');
        break;
        
      default:
        optimizations.push('• Asynchronous processing where applicable');
        optimizations.push('• Batch operations for efficiency');
        optimizations.push('• Caching strategies at appropriate layers');
        optimizations.push('• Resource right-sizing based on metrics');
    }
    
    return optimizations;
  }

  /**
   * Generate monitoring metrics for a connection
   */
  generateMonitoringMetrics(connection) {
    const metrics = [];
    
    switch (connection.type) {
      case 'entry_point':
        metrics.push('• Request count and error rates (4xx, 5xx)');
        metrics.push('• Response time and latency percentiles');
        metrics.push('• Cache hit/miss ratios');
        metrics.push('• Geographic distribution of requests');
        break;
        
      case 'compute_invocation':
        metrics.push('• Function duration and memory utilization');
        metrics.push('• Cold start frequency and duration');
        metrics.push('• Concurrent execution count');
        metrics.push('• Error rate and retry metrics');
        break;
        
      case 'database_access':
        metrics.push('• Connection count and pool utilization');
        metrics.push('• Query execution time and throughput');
        metrics.push('• CPU and memory utilization');
        metrics.push('• Read/write IOPS and latency');
        break;
        
      case 'storage_access':
        metrics.push('• Request count by operation type (GET, PUT, DELETE)');
        metrics.push('• Data transfer metrics (bytes in/out)');
        metrics.push('• Error rates and retry attempts');
        metrics.push('• Storage utilization and cost metrics');
        break;
        
      default:
        metrics.push('• Service availability and uptime');
        metrics.push('• Request/response latency');
        metrics.push('• Error rates and success metrics');
        metrics.push('• Resource utilization (CPU, memory, network)');
    }
    
    return metrics;
  }

  /**
   * Generate fallback architecture summary
   */
  generateFallbackArchitectureSummary(awsServices, architectureAnalysis) {
    return {
      title: 'AWS Architecture Overview',
      description: 'Comprehensive technical analysis of the proposed AWS architecture',
      keyComponents: awsServices.map(service => ({
        service: service,
        purpose: this.getServicePurpose(service),
        tier: this.getServiceTier(service)
      })),
      architecturePatterns: [
        'Microservices architecture with serverless compute',
        'Event-driven processing with asynchronous messaging',
        'Multi-tier application with clear separation of concerns',
        'High availability with cross-AZ deployment',
        'Security-first design with defense in depth'
      ],
      scalabilityConsiderations: [
        'Auto-scaling groups for compute resources',
        'Database read replicas for read scalability',
        'CDN for global content distribution',
        'Caching layers for performance optimization',
        'Load balancing for traffic distribution'
      ],
      costOptimization: [
        'Reserved instances for predictable workloads',
        'Spot instances for fault-tolerant processing',
        'S3 intelligent tiering for storage optimization',
        'Lambda for pay-per-execution pricing',
        'CloudWatch for resource monitoring and optimization'
      ]
    };
  }

  /**
   * Get service purpose description
   */
  getServicePurpose(service) {
    const serviceLower = service.toLowerCase();
    
    if (serviceLower.includes('s3')) return 'Object storage for static assets and data';
    if (serviceLower.includes('lambda')) return 'Serverless compute for business logic';
    if (serviceLower.includes('rds')) return 'Managed relational database service';
    if (serviceLower.includes('dynamodb')) return 'NoSQL database for high-performance applications';
    if (serviceLower.includes('api gateway')) return 'API management and routing service';
    if (serviceLower.includes('cloudfront')) return 'Content delivery network for global distribution';
    if (serviceLower.includes('cognito')) return 'User authentication and authorization';
    if (serviceLower.includes('elasticache')) return 'In-memory caching for performance';
    if (serviceLower.includes('ec2')) return 'Virtual compute instances';
    if (serviceLower.includes('load balancer')) return 'Traffic distribution and high availability';
    
    return 'AWS managed service for application functionality';
  }

  /**
   * Get service tier classification
   */
  getServiceTier(service) {
    const serviceLower = service.toLowerCase();
    
    if (serviceLower.includes('cloudfront') || serviceLower.includes('api gateway') || serviceLower.includes('load balancer')) {
      return 'Presentation Tier';
    }
    if (serviceLower.includes('lambda') || serviceLower.includes('ec2') || serviceLower.includes('ecs')) {
      return 'Application Tier';
    }
    if (serviceLower.includes('rds') || serviceLower.includes('dynamodb') || serviceLower.includes('s3') || serviceLower.includes('elasticache')) {
      return 'Data Tier';
    }
    
    return 'Supporting Services';
  }
}

module.exports = new ProfessionalArchitectureDiagramService();