const geminiService = require('./geminiService');
const logger = require('../utils/logger');

class ArchitectureDiagramService {
  constructor() {
    this.diagramCache = new Map();
  }

  /**
   * Generate architecture diagram from analysis using Gemini
   */
  async generateDiagram(architectureAnalysis, workflowId) {
    try {
      logger.info(`Generating architecture diagram for workflow: ${workflowId}`);

      // Check cache first
      const cacheKey = this.generateCacheKey(architectureAnalysis);
      if (this.diagramCache.has(cacheKey)) {
        logger.info('Returning cached diagram');
        return this.diagramCache.get(cacheKey);
      }

      // Extract AWS services and components from analysis
      const awsServices = this.extractAWSServices(architectureAnalysis);
      const components = this.extractComponents(architectureAnalysis);

      // Generate diagram using Gemini
      const diagramData = await this.generateDiagramWithGemini(architectureAnalysis, awsServices, components);

      // Cache the result
      this.diagramCache.set(cacheKey, diagramData);

      logger.info('Architecture diagram generated successfully');
      return diagramData;

    } catch (error) {
      logger.error('Error generating architecture diagram:', error);
      throw new Error('Failed to generate architecture diagram: ' + error.message);
    }
  }

  /**
   * Generate diagram using Gemini AI
   */
  async generateDiagramWithGemini(architectureAnalysis, awsServices, components) {
    const prompt = this.createDiagramPrompt(architectureAnalysis, awsServices, components);

    try {
      const response = await geminiService.generateContent(prompt, {
        temperature: 0.3,
        maxOutputTokens: 8000
      });

      // Parse the response to extract different diagram formats
      return await this.parseDiagramResponse(response, architectureAnalysis);

    } catch (error) {
      logger.error('Gemini diagram generation failed:', error);
      // Return fallback diagram
      return this.generateFallbackDiagram(awsServices, components);
    }
  }

  /**
   * Create comprehensive prompt for Gemini to generate AWS official architecture diagrams
   */
  createDiagramPrompt(architectureAnalysis, awsServices, components) {
    return `You are an AWS Solutions Architect creating official AWS architecture diagrams that match AWS documentation standards. Generate diagrams that look exactly like AWS official architecture diagrams with proper service icons, clean layouts, and professional presentation quality.

ARCHITECTURE ANALYSIS:
${architectureAnalysis}

IDENTIFIED AWS SERVICES:
${awsServices.join(', ')}

IDENTIFIED COMPONENTS:
${components.join(', ')}

Create AWS official-style diagrams matching these exact specifications:

1. **DRAW.IO XML FORMAT**: Generate AWS official architecture diagram XML:
   - Use AWS service icon library (mxgraph.aws4.*)
   - Clean white background with minimal borders
   - AWS services as rounded rectangles with official icons
   - Service names below icons in clean typography
   - Numbered connection flows (1, 2, 3, etc.)
   - Minimal VPC boundaries (thin orange dashed lines)
   - Clean, uncluttered layout with proper spacing

2. **MERMAID DIAGRAM**: Create clean AWS architecture flow:
   - Simple flowchart with AWS service boxes
   - Clear data flow arrows with step numbers
   - AWS service abbreviations (EC2, RDS, S3, etc.)
   - Minimal styling, focus on clarity

3. **PROFESSIONAL SVG DIAGRAM**: Generate AWS official-style SVG with distinctive service shapes:
   - Clean white background
   - AWS services with distinctive shapes: S3 as bucket shape, RDS as cylinder, Lambda as function symbol, EC2 as server rack, API Gateway as network nodes
   - Use proper AWS service shapes NOT generic rectangles
   - S3: Bucket-like shape with curved top and bottom
   - RDS/DynamoDB: Database cylinder with elliptical top/bottom
   - Lambda: Function symbol or lambda (λ) shape
   - EC2: Server/compute icon with multiple horizontal lines
   - API Gateway: Network/gateway icon with connected nodes
   - CloudFront: Globe or distribution icon
   - Service names below shapes in clean Arial font
   - Numbered flow arrows (1→2→3→4)
   - Minimal VPC boundary (thin dashed orange rectangle)
   - Professional spacing and alignment
   - AWS orange (#FF9900) for VPC boundaries
   - Service-specific colors: EC2 (orange), RDS (blue), S3 (green), Lambda (orange)
   - Clean, presentation-ready layout
   - Add connection lines with arrowheads showing data flow
   - Use professional typography and spacing
   - Include legend and labels for clarity
   - CRITICAL: Use distinctive AWS service shapes, not generic rectangles

4. **DESCRIPTION**: Provide a detailed description of the diagram components and their relationships.

CRITICAL REQUIREMENTS FOR PROFESSIONAL AWS DIAGRAMS:
- Use AWS official service icons and colors (Orange #FF9900, Blue #232F3E)
- Implement proper AWS Well-Architected Framework patterns
- Show VPC with public/private subnets across multiple Availability Zones
- Include security groups, NACLs, and proper network boundaries
- Represent data flow with labeled arrows and connection types
- Use AWS service abbreviations and proper naming conventions
- Include load balancers, auto-scaling groups, and monitoring services
- Show proper tier separation (presentation, application, data layers)
- Use professional typography and enterprise-grade styling
- Make diagrams suitable for C-level presentations and technical documentation

MANDATORY SVG SHAPE REQUIREMENTS:
- S3: Create bucket-like shape using <path> with curved edges, NOT rectangles
- RDS/DynamoDB: Create cylinder shape using <ellipse> and <rect> combination
- Lambda: Create function symbol using <path> for lambda (λ) or function icon
- EC2: Create server shape with multiple <rect> elements for server rack appearance
- API Gateway: Create network nodes using <circle> and <line> elements
- CloudFront: Create globe shape using <circle> and <ellipse> for distribution
- Load Balancer: Create balance/distribution icon with connected nodes
- DO NOT use generic <rect> shapes for AWS services
- Each service must have a distinctive, recognizable shape
- Use <path>, <circle>, <ellipse>, and <polygon> elements to create proper shapes

STYLING REQUIREMENTS:
- Draw.io: Use AWS official shapes library (mxgraph.aws4.*)
- SVG: Implement AWS brand colors and professional gradients
- Mermaid: Use proper node shapes and AWS service icons
- All formats: Include legends, labels, and clear data flow indicators

FORMAT YOUR RESPONSE AS JSON:
{
  "drawio": "<!-- Complete professional draw.io XML with AWS shapes -->",
  "mermaid": "flowchart TB\\n    %% Professional AWS Architecture",
  "svg": "<svg><!-- Enterprise-grade SVG with AWS styling --></svg>",
  "description": "Executive summary of the architecture with AWS best practices"
}

CRITICAL SUCCESS FACTORS:
- Diagrams must be presentation-ready for executive audiences
- Use AWS official colors and styling throughout
- Ensure proper architectural layering and security boundaries
- Include comprehensive labeling and legends
- Make all formats importable/usable in their respective tools
- Focus on clarity, professionalism, and AWS compliance`;
  }

  /**
   * Parse Gemini response and extract diagram formats
   */
  async parseDiagramResponse(response, architectureAnalysis) {
    try {
      // Try to parse as JSON first
      let diagramData;
      
      // Look for JSON in the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          diagramData = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          logger.warn('Failed to parse JSON from Gemini response, trying repair');
          diagramData = this.repairAndParseJSON(jsonMatch[0]);
        }
      }

      if (!diagramData) {
        logger.warn('No valid JSON found in response, extracting manually');
        diagramData = this.extractDiagramsManually(response);
      }

      // Validate and enhance the diagram data
      return await this.validateAndEnhanceDiagram(diagramData, architectureAnalysis);

    } catch (error) {
      logger.error('Error parsing diagram response:', error);
      return await this.generateFallbackDiagram([], []);
    }
  }

  /**
   * Repair malformed JSON from Gemini response
   */
  repairAndParseJSON(jsonString) {
    try {
      // Common JSON repair strategies
      let repaired = jsonString
        .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
        .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Quote unquoted keys
        .replace(/:\s*([^",{\[\]}\s][^",}\]]*[^",{\[\]}\s])\s*([,}])/g, ':"$1"$2') // Quote unquoted string values
        .replace(/\n/g, '\\n') // Escape newlines
        .replace(/\t/g, '\\t') // Escape tabs
        .replace(/\r/g, '\\r'); // Escape carriage returns

      return JSON.parse(repaired);
    } catch (error) {
      logger.error('JSON repair failed:', error);
      throw error;
    }
  }

  /**
   * Extract diagrams manually from response text
   */
  extractDiagramsManually(response) {
    const diagramData = {
      drawio: '',
      mermaid: '',
      svg: '',
      description: ''
    };

    // Extract draw.io XML - look for various patterns
    let drawioMatch = response.match(/<mxGraphModel[\s\S]*?<\/mxGraphModel>/i);
    if (!drawioMatch) {
      drawioMatch = response.match(/<!--[\s\S]*?mxGraphModel[\s\S]*?-->/gi);
    }
    if (!drawioMatch) {
      // Look for any XML-like structure that might be draw.io
      drawioMatch = response.match(/<\?xml[\s\S]*?mxGraphModel[\s\S]*?>/gi);
    }
    if (drawioMatch) {
      diagramData.drawio = drawioMatch[0];
    }

    // Extract Mermaid
    const mermaidMatch = response.match(/flowchart[\s\S]*?(?=\n\n|\n[A-Z]|$)/i);
    if (mermaidMatch) {
      diagramData.mermaid = mermaidMatch[0].trim();
    }

    // Extract SVG
    const svgMatch = response.match(/<svg[\s\S]*?<\/svg>/i);
    if (svgMatch) {
      diagramData.svg = svgMatch[0];
    }

    // Extract description
    const descMatch = response.match(/description['":][\s\S]*?(?=\n\n|$)/i);
    if (descMatch) {
      diagramData.description = descMatch[0].replace(/^description['":]?\s*/i, '').trim();
    }

    return diagramData;
  }

  /**
   * Validate and enhance diagram data
   */
  async validateAndEnhanceDiagram(diagramData, architectureAnalysis) {
    // Extract services from analysis for fallback
    const awsServices = this.extractAWSServices(architectureAnalysis);
    
    let technicalWriteups = null;
    try {
      technicalWriteups = await this.generateTechnicalWriteups(awsServices, architectureAnalysis);
      logger.info('Technical writeups generated successfully');
    } catch (error) {
      logger.error('Error generating technical writeups:', error);
      technicalWriteups = { connections: [], summary: null, totalConnections: 0 };
    }

    const enhanced = {
      drawio: diagramData.drawio || this.generateFallbackDrawIO(awsServices),
      mermaid: diagramData.mermaid || this.generateFallbackMermaid(awsServices),
      // Always use fallback SVG to ensure proper AWS component shapes
      svg: this.generateFallbackSVG(awsServices),
      description: diagramData.description || 'Professional AWS architecture diagram generated from analysis',
      // Add technical writeups for each numbered connection
      technicalWriteups: technicalWriteups
    };

    // Ensure draw.io XML is complete
    if (!enhanced.drawio.includes('<mxGraphModel')) {
      enhanced.drawio = this.wrapInDrawIOStructure(enhanced.drawio);
    }

    // Ensure Mermaid has proper syntax
    if (!enhanced.mermaid.startsWith('flowchart') && !enhanced.mermaid.startsWith('graph')) {
      enhanced.mermaid = 'flowchart TD\n' + enhanced.mermaid;
    }

    // Ensure SVG has proper structure
    if (!enhanced.svg.startsWith('<svg')) {
      enhanced.svg = this.wrapInSVGStructure(enhanced.svg);
    }

    return enhanced;
  }

  /**
   * Generate fallback diagram when Gemini fails
   */
  async generateFallbackDiagram(awsServices, components) {
    const fallbackData = {
      drawio: this.generateFallbackDrawIO(awsServices),
      mermaid: this.generateFallbackMermaid(awsServices),
      svg: this.generateFallbackSVG(awsServices),
      description: 'Fallback architecture diagram with identified AWS services'
    };
    
    // Add technical writeups to fallback as well
    return await this.validateAndEnhanceDiagram(fallbackData, 'Fallback architecture analysis');
  }

  /**
   * Generate AWS official-style draw.io XML with proper AWS4 shapes
   */
  generateFallbackDrawIO(awsServices = []) {
    const services = awsServices.length > 0 ? awsServices : ['Amazon EC2', 'Amazon RDS', 'Amazon S3'];
    
    // AWS official draw.io styles with proper AWS4 shape library
    const awsDrawioStyles = {
      'Amazon EC2': 'shape=mxgraph.aws4.ec2_instance;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;strokeColor=none;fillColor=#F58534;fontColor=#232F3E;fontSize=12;',
      'Amazon RDS': 'shape=mxgraph.aws4.rds_db_instance;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;strokeColor=none;fillColor=#3F48CC;fontColor=#232F3E;fontSize=12;',
      'Amazon S3': 'shape=mxgraph.aws4.s3_bucket;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;strokeColor=none;fillColor=#569A31;fontColor=#232F3E;fontSize=12;',
      'Amazon API Gateway': 'shape=mxgraph.aws4.api_gateway;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;strokeColor=none;fillColor=#FF4B4B;fontColor=#232F3E;fontSize=12;',
      'Amazon Lambda': 'shape=mxgraph.aws4.lambda_function;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;strokeColor=none;fillColor=#F58534;fontColor=#232F3E;fontSize=12;',
      'Amazon CloudFront': 'shape=mxgraph.aws4.cloudfront_distribution;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;strokeColor=none;fillColor=#9D5AAE;fontColor=#232F3E;fontSize=12;',
      'Amazon DynamoDB': 'shape=mxgraph.aws4.dynamodb_table;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;strokeColor=none;fillColor=#3F48CC;fontColor=#232F3E;fontSize=12;',
      'Amazon ElastiCache': 'shape=mxgraph.aws4.elasticache_cache_node;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;strokeColor=none;fillColor=#3F48CC;fontColor=#232F3E;fontSize=12;',
      'Amazon Cognito': 'shape=mxgraph.aws4.cognito;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;strokeColor=none;fillColor=#FF4B4B;fontColor=#232F3E;fontSize=12;',
      'Application Load Balancer': 'shape=mxgraph.aws4.application_load_balancer;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;strokeColor=none;fillColor=#F58534;fontColor=#232F3E;fontSize=12;',
      'Elastic Load Balancer': 'shape=mxgraph.aws4.elastic_load_balancing;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;strokeColor=none;fillColor=#F58534;fontColor=#232F3E;fontSize=12;',
      'Amazon Route 53': 'shape=mxgraph.aws4.route_53;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;strokeColor=none;fillColor=#9D5AAE;fontColor=#232F3E;fontSize=12;',
      'Amazon CloudWatch': 'shape=mxgraph.aws4.cloudwatch;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;strokeColor=none;fillColor=#FF4B4B;fontColor=#232F3E;fontSize=12;',
      'AWS IAM': 'shape=mxgraph.aws4.iam;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;strokeColor=none;fillColor=#FF4B4B;fontColor=#232F3E;fontSize=12;',
      'Amazon ECS': 'shape=mxgraph.aws4.ecs;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;strokeColor=none;fillColor=#F58534;fontColor=#232F3E;fontSize=12;',
      'Amazon EKS': 'shape=mxgraph.aws4.eks;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;strokeColor=none;fillColor=#F58534;fontColor=#232F3E;fontSize=12;',
      'Amazon SQS': 'shape=mxgraph.aws4.sqs;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;strokeColor=none;fillColor=#FF4B4B;fontColor=#232F3E;fontSize=12;',
      'Amazon SNS': 'shape=mxgraph.aws4.sns;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;strokeColor=none;fillColor=#FF4B4B;fontColor=#232F3E;fontSize=12;',
      'AWS Step Functions': 'shape=mxgraph.aws4.step_functions;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;strokeColor=none;fillColor=#FF4B4B;fontColor=#232F3E;fontSize=12;',
      'AWS CloudFormation': 'shape=mxgraph.aws4.cloudformation;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;strokeColor=none;fillColor=#FF4B4B;fontColor=#232F3E;fontSize=12;',
      'AWS Fargate': 'shape=mxgraph.aws4.fargate;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;strokeColor=none;fillColor=#F58534;fontColor=#232F3E;fontSize=12;',
      'Amazon ECR': 'shape=mxgraph.aws4.ecr;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;strokeColor=none;fillColor=#F58534;fontColor=#232F3E;fontSize=12;',
      'default': 'shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.traditional_server;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;strokeColor=none;fillColor=#FF9900;fontColor=#232F3E;fontSize=12;'
    };

    let cells = '';
    let cellId = 2;

    // AWS Cloud container
    cells += `
      <mxCell id="${cellId++}" value="AWS Cloud" style="fillColor=#232F3E;strokeColor=none;dashed=0;verticalAlign=top;fontStyle=0;fontColor=#FFFFFF;whiteSpace=wrap;html=1;fontSize=16;fontStyle=1;spacing=3;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_aws_cloud;" vertex="1" parent="1">
        <mxGeometry x="20" y="20" width="760" height="480" as="geometry"/>
      </mxCell>`;

    // Customer AWS Account container
    cells += `
      <mxCell id="${cellId++}" value="Customer's AWS Account" style="fillColor=none;strokeColor=#FF9900;dashed=1;verticalAlign=top;fontStyle=0;fontColor=#FF9900;whiteSpace=wrap;html=1;fontSize=12;fontStyle=1;spacing=3;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_account;" vertex="1" parent="1">
        <mxGeometry x="40" y="60" width="500" height="380" as="geometry"/>
      </mxCell>`;

    // VPC container (clean, minimal)
    cells += `
      <mxCell id="${cellId++}" value="VPC" style="fillColor=none;strokeColor=#FF9900;strokeWidth=2;dashed=1;verticalAlign=top;align=left;spacingLeft=10;fontColor=#FF9900;fontSize=12;fontStyle=1;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_vpc;" vertex="1" parent="1">
        <mxGeometry x="60" y="100" width="460" height="320" as="geometry"/>
      </mxCell>`;

    // Availability Zone
    cells += `
      <mxCell id="${cellId++}" value="Availability Zone" style="fillColor=none;strokeColor=#147EBA;strokeWidth=1;dashed=1;verticalAlign=top;align=left;spacingLeft=10;fontColor=#147EBA;fontSize=11;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_availability_zone;" vertex="1" parent="1">
        <mxGeometry x="80" y="130" width="420" height="270" as="geometry"/>
      </mxCell>`;

    // Generate AWS services in clean grid layout within VPC
    services.forEach((service, index) => {
      const serviceKey = service.replace(/AWS\s+/, 'Amazon ');
      const style = awsDrawioStyles[serviceKey] || awsDrawioStyles.default;
      
      // Clean grid layout within VPC boundaries
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = 120 + (col * 120);
      const y = 170 + (row * 80);
      
      // Service name (clean, short)
      const serviceName = service.replace('Amazon ', '').replace('AWS ', '');
      
      cells += `
        <mxCell id="${cellId++}" value="${serviceName}" style="${style}" vertex="1" parent="1">
          <mxGeometry x="${x}" y="${y}" width="78" height="78" as="geometry"/>
        </mxCell>`;
    });

    // Add numbered flow connections between services
    const serviceStartId = cellId - services.length;
    for (let i = 1; i < services.length; i++) {
      const sourceId = serviceStartId + i - 1;
      const targetId = serviceStartId + i;
      
      cells += `
        <mxCell id="${cellId++}" value="${i}" style="endArrow=classic;html=1;rounded=0;strokeColor=#232F3E;strokeWidth=2;labelBackgroundColor=#ffffff;fontSize=10;fontStyle=1;fontColor=#232F3E;" edge="1" parent="1" source="${sourceId}" target="${targetId}">
          <mxGeometry width="50" height="50" relative="1" as="geometry">
            <mxPoint x="400" y="300" as="sourcePoint"/>
            <mxPoint x="450" y="250" as="targetPoint"/>
          </mxGeometry>
        </mxCell>`;
    }

    // Add user icon outside the cloud
    cells += `
      <mxCell id="${cellId++}" value="User" style="shape=mxgraph.aws4.user;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;strokeColor=none;fillColor=#232F3E;fontColor=#232F3E;fontSize=12;" vertex="1" parent="1">
        <mxGeometry x="290" y="520" width="78" height="78" as="geometry"/>
      </mxCell>`;

    // Connect user to first service
    if (services.length > 0) {
      cells += `
        <mxCell id="${cellId++}" value="1" style="endArrow=classic;html=1;rounded=0;strokeColor=#232F3E;strokeWidth=2;labelBackgroundColor=#ffffff;fontSize=10;fontStyle=1;fontColor=#232F3E;" edge="1" parent="1" source="${cellId-1}" target="${serviceStartId}">
          <mxGeometry width="50" height="50" relative="1" as="geometry">
            <mxPoint x="329" y="520" as="sourcePoint"/>
            <mxPoint x="159" y="248" as="targetPoint"/>
          </mxGeometry>
        </mxCell>`;
    }

    return `<mxGraphModel dx="1422" dy="794" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        ${cells}
      </root>
    </mxGraphModel>`;
  }

  /**
   * Generate professional AWS Mermaid diagram with proper architecture layers
   */
  generateFallbackMermaid(awsServices = []) {
    const services = awsServices.length > 0 ? awsServices : ['EC2', 'RDS', 'S3'];
    
    // Categorize services by layer
    const layers = {
      edge: [],
      presentation: [],
      application: [],
      data: [],
      other: []
    };

    services.forEach(service => {
      const serviceLower = service.toLowerCase();
      if (serviceLower.includes('cloudfront') || serviceLower.includes('route 53') || serviceLower.includes('waf')) {
        layers.edge.push(service);
      } else if (serviceLower.includes('api gateway') || serviceLower.includes('load balancer') || serviceLower.includes('alb') || serviceLower.includes('elb')) {
        layers.presentation.push(service);
      } else if (serviceLower.includes('ec2') || serviceLower.includes('lambda') || serviceLower.includes('ecs') || serviceLower.includes('eks') || serviceLower.includes('fargate')) {
        layers.application.push(service);
      } else if (serviceLower.includes('rds') || serviceLower.includes('dynamodb') || serviceLower.includes('s3') || serviceLower.includes('elasticache') || serviceLower.includes('aurora')) {
        layers.data.push(service);
      } else {
        layers.other.push(service);
      }
    });

    let mermaid = 'flowchart TB\n';
    mermaid += '    %% AWS Architecture Diagram\n';
    mermaid += '    \n';
    
    // Add subgraphs for VPC and AZs
    mermaid += '    subgraph VPC["AWS VPC"]\n';
    mermaid += '        subgraph AZ1["Availability Zone A"]\n';
    mermaid += '            subgraph PublicSubnet1["Public Subnet"]\n';
    
    // Edge layer
    if (layers.edge.length > 0) {
      layers.edge.forEach(service => {
        const nodeId = service.replace(/[^a-zA-Z0-9]/g, '');
        mermaid += `                ${nodeId}["🌐 ${service.replace('Amazon ', '').replace('AWS ', '')}"]\n`;
      });
    }
    
    // Presentation layer
    if (layers.presentation.length > 0) {
      layers.presentation.forEach(service => {
        const nodeId = service.replace(/[^a-zA-Z0-9]/g, '');
        mermaid += `                ${nodeId}["⚖️ ${service.replace('Amazon ', '').replace('AWS ', '')}"]\n`;
      });
    }
    
    mermaid += '            end\n';
    mermaid += '            subgraph PrivateSubnet1["Private Subnet"]\n';
    
    // Application layer
    if (layers.application.length > 0) {
      layers.application.forEach(service => {
        const nodeId = service.replace(/[^a-zA-Z0-9]/g, '');
        const icon = service.toLowerCase().includes('lambda') ? '⚡' : '🖥️';
        mermaid += `                ${nodeId}["${icon} ${service.replace('Amazon ', '').replace('AWS ', '')}"]\n`;
      });
    }
    
    mermaid += '            end\n';
    mermaid += '        end\n';
    mermaid += '        subgraph DataLayer["Data Layer"]\n';
    
    // Data layer
    if (layers.data.length > 0) {
      layers.data.forEach(service => {
        const nodeId = service.replace(/[^a-zA-Z0-9]/g, '');
        const icon = service.toLowerCase().includes('s3') ? '📦' : '🗄️';
        mermaid += `            ${nodeId}["${icon} ${service.replace('Amazon ', '').replace('AWS ', '')}"]\n`;
      });
    }
    
    mermaid += '        end\n';
    mermaid += '    end\n';
    mermaid += '    \n';
    
    // Add connections with proper flow
    const allServices = [...layers.edge, ...layers.presentation, ...layers.application, ...layers.data, ...layers.other];
    allServices.forEach((service, index) => {
      if (index > 0) {
        const prevNodeId = allServices[index - 1].replace(/[^a-zA-Z0-9]/g, '');
        const nodeId = service.replace(/[^a-zA-Z0-9]/g, '');
        mermaid += `    ${prevNodeId} -->|Data Flow| ${nodeId}\n`;
      }
    });
    
    // Add styling
    mermaid += '    \n';
    mermaid += '    classDef awsOrange fill:#FF9900,stroke:#E47911,stroke-width:2px,color:#232F3E\n';
    mermaid += '    classDef awsBlue fill:#3F48CC,stroke:#2E3A8C,stroke-width:2px,color:#fff\n';
    mermaid += '    classDef awsGreen fill:#569A31,stroke:#3F7B1C,stroke-width:2px,color:#fff\n';
    
    return mermaid;
  }

  /**
   * Generate AWS official architecture diagram matching the reference format
   */
  generateFallbackSVG(awsServices = []) {
    const services = awsServices.length > 0 ? awsServices : ['Amazon EC2', 'Amazon RDS', 'Amazon S3'];
    
    // AWS official service configuration with proper colors and icons
    const awsServiceConfig = {
      'Amazon EC2': { color: '#FF9900', bgColor: '#FF9900', textColor: 'white', name: 'Amazon EC2', icon: '⚡' },
      'Amazon RDS': { color: '#3F48CC', bgColor: '#3F48CC', textColor: 'white', name: 'Amazon RDS', icon: '🗄️' },
      'Amazon S3': { color: '#569A31', bgColor: '#569A31', textColor: 'white', name: 'Amazon S3', icon: '📦' },
      'Amazon API Gateway': { color: '#FF4B4B', bgColor: '#FF4B4B', textColor: 'white', name: 'Amazon API Gateway', icon: '🌐' },
      'Amazon Lambda': { color: '#FF9900', bgColor: '#FF9900', textColor: 'white', name: 'AWS Lambda', icon: '⚡' },
      'Amazon CloudFront': { color: '#9D5AAE', bgColor: '#9D5AAE', textColor: 'white', name: 'Amazon CloudFront', icon: '🌍' },
      'Amazon DynamoDB': { color: '#3F48CC', bgColor: '#3F48CC', textColor: 'white', name: 'Amazon DynamoDB', icon: '📊' },
      'Amazon Cognito': { color: '#FF4B4B', bgColor: '#FF4B4B', textColor: 'white', name: 'Amazon Cognito', icon: '👤' },
      'Amazon CloudWatch': { color: '#FF4B4B', bgColor: '#FF4B4B', textColor: 'white', name: 'Amazon CloudWatch', icon: '📊' },
      'AWS IAM': { color: '#FF4B4B', bgColor: '#FF4B4B', textColor: 'white', name: 'AWS IAM', icon: '🔐' },
      'Amazon ElastiCache': { color: '#3F48CC', bgColor: '#3F48CC', textColor: 'white', name: 'Amazon ElastiCache', icon: '⚡' },
      'Amazon ECS': { color: '#FF9900', bgColor: '#FF9900', textColor: 'white', name: 'Amazon ECS', icon: '🐳' },
      'Amazon EKS': { color: '#FF9900', bgColor: '#FF9900', textColor: 'white', name: 'Amazon EKS', icon: '☸️' },
      'Amazon SQS': { color: '#FF4B4B', bgColor: '#FF4B4B', textColor: 'white', name: 'Amazon SQS', icon: '📬' },
      'Amazon SNS': { color: '#FF4B4B', bgColor: '#FF4B4B', textColor: 'white', name: 'Amazon SNS', icon: '📢' },
      'Amazon Route 53': { color: '#9D5AAE', bgColor: '#9D5AAE', textColor: 'white', name: 'Amazon Route 53', icon: '🌐' },
      'Application Load Balancer': { color: '#FF9900', bgColor: '#FF9900', textColor: 'white', name: 'Application Load Balancer', icon: '⚖️' },
      'Elastic Load Balancer': { color: '#FF9900', bgColor: '#FF9900', textColor: 'white', name: 'Elastic Load Balancer', icon: '⚖️' },
      'AWS Step Functions': { color: '#FF4B4B', bgColor: '#FF4B4B', textColor: 'white', name: 'AWS Step Functions', icon: '🔄' },
      'AWS CloudFormation': { color: '#FF4B4B', bgColor: '#FF4B4B', textColor: 'white', name: 'AWS CloudFormation', icon: '📋' },
      'AWS Fargate': { color: '#FF9900', bgColor: '#FF9900', textColor: 'white', name: 'AWS Fargate', icon: '🐳' },
      'Amazon ECR': { color: '#FF9900', bgColor: '#FF9900', textColor: 'white', name: 'Amazon ECR', icon: '📦' },
      'default': { color: '#232F3E', bgColor: '#232F3E', textColor: 'white', name: 'AWS Service', icon: '⚙️' }
    };

    let serviceElements = '';
    let connections = '';
    let stepNumbers = '';
    
    // Calculate layout - clean grid with proper spacing
    const startX = 100;
    const startY = 150;
    const serviceWidth = 140;
    const serviceHeight = 100;
    const horizontalSpacing = 200;
    const verticalSpacing = 150;
    
    // AWS Official Architecture Layout with Account Boundaries
    const servicePositions = [
      // Customer Account Services (left side)
      { x: 120, y: 160, account: 'customer' },  // Authentication/Cognito
      { x: 280, y: 160, account: 'customer' },  // API Gateway
      { x: 440, y: 160, account: 'customer' },  // Lambda
      { x: 120, y: 280, account: 'customer' },  // Database/RDS
      { x: 280, y: 280, account: 'customer' },  // Storage/S3
      { x: 440, y: 280, account: 'customer' },  // Compute/EC2
      { x: 120, y: 400, account: 'customer' },  // CDN/CloudFront
      { x: 280, y: 400, account: 'customer' },  // Additional services
      
      // AWS Managed Account Services (right side)
      { x: 650, y: 180, account: 'managed' },   // Managed service 1
      { x: 650, y: 300, account: 'managed' },   // Managed service 2
      { x: 650, y: 420, account: 'managed' },   // Managed service 3
    ];

    // Generate AWS services with official AWS architecture styling
    services.forEach((service, index) => {
      if (index >= servicePositions.length) return;
      
      const serviceKey = service.replace(/AWS\s+/, 'Amazon ');
      const config = awsServiceConfig[serviceKey] || awsServiceConfig.default;
      const pos = servicePositions[index];
      
      const serviceWidth = 100;
      const serviceHeight = 70;
      
      // AWS Official Component Shape (matching reference image)
      serviceElements += `
        <g class="aws-service" data-service="${config.name}">
          ${this.generateAWSComponentShape(service, pos.x, pos.y, serviceWidth, serviceHeight, config)}
        </g>
      `;
    });

    // Generate numbered connections (AWS official style with circles)
    const connectionPaths = [
      { from: 0, to: 1, number: 1 },  // Auth to API Gateway
      { from: 1, to: 2, number: 2 },  // API Gateway to Lambda
      { from: 2, to: 3, number: 3 },  // Lambda to Database
      { from: 3, to: 4, number: 4 },  // Database to Storage
      { from: 4, to: 5, number: 5 },  // Storage to Compute
      { from: 2, to: 8, number: 6 },  // Lambda to Managed Account
      { from: 5, to: 9, number: 7 },  // Compute to Managed Account
      { from: 6, to: 7, number: 8 }   // CDN to Additional
    ];

    connectionPaths.forEach(conn => {
      if (conn.from < servicePositions.length && conn.to < servicePositions.length && 
          conn.from < services.length && conn.to < services.length) {
        const fromPos = servicePositions[conn.from];
        const toPos = servicePositions[conn.to];
        
        const fromX = fromPos.x + 50;
        const fromY = fromPos.y + 35;
        const toX = toPos.x + 50;
        const toY = toPos.y + 35;
        
        // Connection line (AWS style)
        connections += `
          <line x1="${fromX}" y1="${fromY}" x2="${toX}" y2="${toY}" 
                stroke="#232F3E" stroke-width="2" marker-end="url(#arrowhead)"/>
        `;
        
        // Numbered circle (AWS official style)
        const midX = (fromX + toX) / 2;
        const midY = (fromY + toY) / 2;
        stepNumbers += `
          <circle cx="${midX}" cy="${midY}" r="12" fill="#232F3E" stroke="white" stroke-width="2"/>
          <text x="${midX}" y="${midY + 4}" text-anchor="middle" 
                font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="white">${conn.number}</text>
        `;
      }
    });

    // VPC boundary (minimal, clean)
    const vpcX = 50;
    const vpcY = 100;
    const vpcWidth = Math.max(600, (Math.ceil(services.length / 3) * horizontalSpacing) + 200);
    const vpcHeight = Math.max(400, (Math.ceil(services.length / 3) * verticalSpacing) + 200);

    // Account boundaries (AWS official style)
    const accountBoundaries = `
      <!-- Customer's AWS Account -->
      <rect x="80" y="120" width="500" height="380" fill="none" stroke="#232F3E" stroke-width="2" rx="8"/>
      <rect x="80" y="120" width="500" height="25" fill="#232F3E" rx="8"/>
      <text x="90" y="137" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="white">Customer's AWS Account</text>
      
      <!-- AWS Managed Account -->
      <rect x="620" y="120" width="180" height="380" fill="none" stroke="#232F3E" stroke-width="2" rx="8"/>
      <rect x="620" y="120" width="180" height="25" fill="#232F3E" rx="8"/>
      <text x="630" y="137" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="white">AWS Managed Account</text>
    `;

    // User icon (AWS official style)
    const userIcon = `
      <g transform="translate(30, 450)">
        <circle cx="20" cy="20" r="16" fill="#666" stroke="white" stroke-width="2"/>
        <text x="20" y="25" text-anchor="middle" font-size="14" fill="white">👤</text>
        <text x="20" y="45" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" fill="#666">User</text>
      </g>
    `;

    return `<svg width="850" height="550" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .aws-title { font-family: 'Arial', sans-serif; font-size: 16px; font-weight: bold; fill: #232F3E; }
          .aws-service { cursor: pointer; }
          .aws-service:hover rect { opacity: 0.8; }
        </style>
        
        <!-- Arrow marker -->
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#232F3E"/>
        </marker>
        
        <!-- Service shadow -->
        <filter id="serviceShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="1" dy="1" stdDeviation="1" flood-color="rgba(0,0,0,0.2)"/>
        </filter>
      </defs>
      
      <!-- Clean white background -->
      <rect width="100%" height="100%" fill="white"/>
      
      <!-- AWS Cloud header -->
      <rect x="0" y="0" width="850" height="40" fill="#232F3E"/>
      <text x="20" y="25" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="white">AWS Cloud</text>
      
      <!-- Title -->
      <text x="425" y="70" text-anchor="middle" class="aws-title">
        AWS Architecture Diagram
      </text>
      
      <!-- Account boundaries -->
      ${accountBoundaries}
      
      <!-- User icon -->
      ${userIcon}
      
      <!-- AWS Services -->
      ${serviceElements}
      
      <!-- Flow connections -->
      ${connections}
      
      <!-- Step numbers -->
      ${stepNumbers}
      
      <!-- AWS branding -->
      <text x="20" y="530" font-family="Arial, sans-serif" font-size="9" fill="#666">
        AWS Architecture • Generated by RFP Automation System
      </text>
    </svg>`;
  }

  /**
   * Wrap content in proper draw.io structure
   */
  wrapInDrawIOStructure(content) {
    if (content.includes('<mxGraphModel')) return content;
    
    return `<mxGraphModel dx="1422" dy="794" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        ${content}
      </root>
    </mxGraphModel>`;
  }

  /**
   * Wrap content in proper SVG structure
   */
  wrapInSVGStructure(content) {
    if (content.startsWith('<svg')) return content;
    
    return `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
      ${content}
    </svg>`;
  }

  /**
   * Extract AWS services from architecture analysis with proper naming
   */
  extractAWSServices(analysis) {
    const services = new Set();
    
    // AWS service mapping for consistent naming
    const serviceMapping = {
      'ec2': 'Amazon EC2',
      'rds': 'Amazon RDS', 
      's3': 'Amazon S3',
      'lambda': 'Amazon Lambda',
      'dynamodb': 'Amazon DynamoDB',
      'cloudfront': 'Amazon CloudFront',
      'api gateway': 'Amazon API Gateway',
      'ecs': 'Amazon ECS',
      'eks': 'Amazon EKS',
      'elasticache': 'Amazon ElastiCache',
      'sqs': 'Amazon SQS',
      'sns': 'Amazon SNS',
      'cloudwatch': 'Amazon CloudWatch',
      'iam': 'AWS IAM',
      'cognito': 'Amazon Cognito',
      'route 53': 'Amazon Route 53',
      'load balancer': 'Application Load Balancer',
      'alb': 'Application Load Balancer',
      'elb': 'Elastic Load Balancer'
    };

    // Extract services using multiple patterns
    const patterns = [
      /Amazon\s+(EC2|RDS|S3|Lambda|DynamoDB|CloudFront|ECS|EKS|ElastiCache|SQS|SNS|CloudWatch|Cognito)/gi,
      /AWS\s+(Lambda|IAM)/gi,
      /(API\s+Gateway|Application\s+Load\s+Balancer|Elastic\s+Load\s+Balancer)/gi,
      /\b(EC2|RDS|S3|Lambda|DynamoDB|CloudFront|ECS|EKS|ElastiCache|SQS|SNS|CloudWatch|IAM|Cognito)\b/gi
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(analysis)) !== null) {
        let serviceName = match[0].trim();
        
        // Normalize service name
        const normalizedKey = serviceName.toLowerCase()
          .replace(/^(amazon|aws)\s+/, '')
          .trim();
        
        // Map to standard AWS service name
        const standardName = serviceMapping[normalizedKey] || serviceName;
        
        if (standardName && standardName.length > 2) {
          services.add(standardName);
        }
      }
    });

    // If no services found, add default common services
    if (services.size === 0) {
      services.add('Amazon EC2');
      services.add('Amazon RDS');
      services.add('Amazon S3');
    }

    return Array.from(services).slice(0, 12); // Limit to 12 services for clean layout
  }

  /**
   * Extract architectural components from analysis
   */
  extractComponents(analysis) {
    const components = new Set();
    
    const componentPatterns = [
      /\b(microservices?|database|storage|authentication|monitoring|load balancer|cdn|cache|queue|api|gateway|serverless|container)\b/gi
    ];

    componentPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(analysis)) !== null) {
        components.add(match[0].toLowerCase());
      }
    });

    return Array.from(components);
  }

  /**
   * Generate AWS component shape with proper service-specific styling
   */
  generateAWSComponentShape(service, x, y, width, height, config) {
    const serviceName = service.replace('Amazon ', '').replace('AWS ', '');
    const serviceKey = service.toLowerCase();
    
    // AWS service-specific shapes
    if (serviceKey.includes('s3')) {
      // S3 Bucket shape (distinctive bucket icon)
      return `
        <g transform="translate(${x}, ${y})">
          <!-- S3 Bucket Shape -->
          <path d="M10 20 Q10 10 20 10 L80 10 Q90 10 90 20 L90 50 Q90 60 80 60 L20 60 Q10 60 10 50 Z" 
                fill="${config.bgColor}" stroke="#2E7D32" stroke-width="2"/>
          <ellipse cx="50" cy="20" rx="40" ry="8" fill="#4CAF50" opacity="0.8"/>
          <ellipse cx="50" cy="25" rx="35" ry="6" fill="#66BB6A" opacity="0.6"/>
          <text x="50" y="45" text-anchor="middle" font-family="Arial, sans-serif" 
                font-size="10" font-weight="bold" fill="white">S3</text>
          <text x="50" y="75" text-anchor="middle" font-family="Arial, sans-serif" 
                font-size="9" fill="#232F3E">${serviceName}</text>
        </g>
      `;
    } else if (serviceKey.includes('rds') || serviceKey.includes('dynamodb')) {
      // Database cylinder shape
      return `
        <g transform="translate(${x}, ${y})">
          <!-- Database Cylinder Shape -->
          <ellipse cx="50" cy="15" rx="35" ry="10" fill="${config.bgColor}" stroke="#1976D2" stroke-width="2"/>
          <rect x="15" y="15" width="70" height="35" fill="${config.bgColor}" stroke="none"/>
          <ellipse cx="50" cy="50" rx="35" ry="10" fill="${config.bgColor}" stroke="#1976D2" stroke-width="2"/>
          <line x1="15" y1="15" x2="15" y2="50" stroke="#1976D2" stroke-width="2"/>
          <line x1="85" y1="15" x2="85" y2="50" stroke="#1976D2" stroke-width="2"/>
          <text x="50" y="35" text-anchor="middle" font-family="Arial, sans-serif" 
                font-size="10" font-weight="bold" fill="white">DB</text>
          <text x="50" y="75" text-anchor="middle" font-family="Arial, sans-serif" 
                font-size="9" fill="#232F3E">${serviceName}</text>
        </g>
      `;
    } else if (serviceKey.includes('lambda')) {
      // Lambda function shape (distinctive lambda symbol)
      return `
        <g transform="translate(${x}, ${y})">
          <!-- Lambda Function Shape -->
          <rect x="10" y="10" width="80" height="50" rx="8" fill="${config.bgColor}" 
                stroke="#E65100" stroke-width="2"/>
          <path d="M25 20 L35 20 L45 40 L55 20 L65 20 L50 45 L40 45 Z" 
                fill="white" stroke="none"/>
          <text x="50" y="75" text-anchor="middle" font-family="Arial, sans-serif" 
                font-size="9" fill="#232F3E">${serviceName}</text>
        </g>
      `;
    } else if (serviceKey.includes('ec2')) {
      // EC2 instance shape (server/compute icon)
      return `
        <g transform="translate(${x}, ${y})">
          <!-- EC2 Instance Shape -->
          <rect x="10" y="15" width="80" height="40" rx="6" fill="${config.bgColor}" 
                stroke="#E65100" stroke-width="2"/>
          <rect x="15" y="20" width="15" height="8" rx="2" fill="white" opacity="0.8"/>
          <rect x="35" y="20" width="15" height="8" rx="2" fill="white" opacity="0.8"/>
          <rect x="55" y="20" width="15" height="8" rx="2" fill="white" opacity="0.8"/>
          <rect x="75" y="20" width="10" height="8" rx="2" fill="white" opacity="0.8"/>
          <rect x="15" y="32" width="70" height="4" rx="1" fill="white" opacity="0.6"/>
          <rect x="15" y="38" width="70" height="4" rx="1" fill="white" opacity="0.6"/>
          <rect x="15" y="44" width="70" height="4" rx="1" fill="white" opacity="0.6"/>
          <text x="50" y="75" text-anchor="middle" font-family="Arial, sans-serif" 
                font-size="9" fill="#232F3E">${serviceName}</text>
        </g>
      `;
    } else if (serviceKey.includes('api gateway')) {
      // API Gateway shape (gateway/network icon)
      return `
        <g transform="translate(${x}, ${y})">
          <!-- API Gateway Shape -->
          <rect x="10" y="10" width="80" height="50" rx="8" fill="${config.bgColor}" 
                stroke="#D32F2F" stroke-width="2"/>
          <circle cx="30" cy="25" r="4" fill="white"/>
          <circle cx="50" cy="25" r="4" fill="white"/>
          <circle cx="70" cy="25" r="4" fill="white"/>
          <line x1="34" y1="25" x2="46" y2="25" stroke="white" stroke-width="2"/>
          <line x1="54" y1="25" x2="66" y2="25" stroke="white" stroke-width="2"/>
          <circle cx="30" cy="45" r="4" fill="white"/>
          <circle cx="50" cy="45" r="4" fill="white"/>
          <circle cx="70" cy="45" r="4" fill="white"/>
          <line x1="34" y1="45" x2="46" y2="45" stroke="white" stroke-width="2"/>
          <line x1="54" y1="45" x2="66" y2="45" stroke="white" stroke-width="2"/>
          <line x1="30" y1="29" x2="30" y2="41" stroke="white" stroke-width="2"/>
          <line x1="50" y1="29" x2="50" y2="41" stroke="white" stroke-width="2"/>
          <line x1="70" y1="29" x2="70" y2="41" stroke="white" stroke-width="2"/>
          <text x="50" y="75" text-anchor="middle" font-family="Arial, sans-serif" 
                font-size="9" fill="#232F3E">${serviceName}</text>
        </g>
      `;
    } else if (serviceKey.includes('cloudfront')) {
      // CloudFront CDN shape (globe/distribution icon)
      return `
        <g transform="translate(${x}, ${y})">
          <!-- CloudFront CDN Shape -->
          <rect x="10" y="10" width="80" height="50" rx="8" fill="${config.bgColor}" 
                stroke="#7B1FA2" stroke-width="2"/>
          <circle cx="50" cy="35" r="18" fill="none" stroke="white" stroke-width="2"/>
          <ellipse cx="50" cy="35" rx="18" ry="9" fill="none" stroke="white" stroke-width="1.5"/>
          <ellipse cx="50" cy="35" rx="9" ry="18" fill="none" stroke="white" stroke-width="1.5"/>
          <line x1="32" y1="35" x2="68" y2="35" stroke="white" stroke-width="1.5"/>
          <text x="50" y="75" text-anchor="middle" font-family="Arial, sans-serif" 
                font-size="9" fill="#232F3E">${serviceName}</text>
        </g>
      `;
    } else if (serviceKey.includes('cognito')) {
      // Cognito authentication shape (user/shield icon)
      return `
        <g transform="translate(${x}, ${y})">
          <!-- Cognito Authentication Shape -->
          <rect x="10" y="10" width="80" height="50" rx="8" fill="${config.bgColor}" 
                stroke="#D32F2F" stroke-width="2"/>
          <circle cx="45" cy="28" r="8" fill="white"/>
          <path d="M35 45 Q35 38 45 38 Q55 38 55 45 L55 50 L35 50 Z" fill="white"/>
          <path d="M60 20 L75 30 L60 40 L65 35 L70 35 L65 30 L70 25 L65 25 Z" 
                fill="white" opacity="0.8"/>
          <text x="50" y="75" text-anchor="middle" font-family="Arial, sans-serif" 
                font-size="9" fill="#232F3E">${serviceName}</text>
        </g>
      `;
    } else if (serviceKey.includes('load balancer') || serviceKey.includes('alb') || serviceKey.includes('elb')) {
      // Load Balancer shape (distribution/balance icon)
      return `
        <g transform="translate(${x}, ${y})">
          <!-- Load Balancer Shape -->
          <rect x="10" y="10" width="80" height="50" rx="8" fill="${config.bgColor}" 
                stroke="#FF6F00" stroke-width="2"/>
          <circle cx="50" cy="25" r="6" fill="white"/>
          <circle cx="30" cy="45" r="4" fill="white"/>
          <circle cx="50" cy="45" r="4" fill="white"/>
          <circle cx="70" cy="45" r="4" fill="white"/>
          <line x1="50" y1="31" x2="30" y2="41" stroke="white" stroke-width="2"/>
          <line x1="50" y1="31" x2="50" y2="41" stroke="white" stroke-width="2"/>
          <line x1="50" y1="31" x2="70" y2="41" stroke="white" stroke-width="2"/>
          <text x="50" y="75" text-anchor="middle" font-family="Arial, sans-serif" 
                font-size="9" fill="#232F3E">${serviceName}</text>
        </g>
      `;
    } else {
      // Default AWS service shape (generic but styled)
      return `
        <g transform="translate(${x}, ${y})">
          <!-- Default AWS Service Shape -->
          <rect x="10" y="10" width="80" height="50" rx="8" fill="${config.bgColor}" 
                stroke="#232F3E" stroke-width="2" filter="url(#serviceShadow)"/>
          <rect x="15" y="15" width="70" height="8" rx="2" fill="white" opacity="0.3"/>
          <rect x="15" y="27" width="50" height="4" rx="1" fill="white" opacity="0.5"/>
          <rect x="15" y="35" width="60" height="4" rx="1" fill="white" opacity="0.5"/>
          <rect x="15" y="43" width="40" height="4" rx="1" fill="white" opacity="0.5"/>
          <text x="50" y="75" text-anchor="middle" font-family="Arial, sans-serif" 
                font-size="9" fill="#232F3E">${serviceName}</text>
        </g>
      `;
    }
  }

  /**
   * Generate technical writeups for each numbered connection using AWS Bedrock Claude Haiku 3
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
   * Generate overall architecture summary
   */
  generateArchitectureSummary(awsServices, architectureAnalysis) {
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
   * Generate cache key for diagram caching
   */
  generateCacheKey(architectureAnalysis) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(architectureAnalysis).digest('hex');
  }

  /**
   * Clear diagram cache
   */
  clearCache() {
    this.diagramCache.clear();
    logger.info('Architecture diagram cache cleared');
  }
}

module.exports = new ArchitectureDiagramService();