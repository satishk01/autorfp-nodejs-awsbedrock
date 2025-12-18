const bedrockService = require('./bedrock');
const logger = require('../utils/logger');

class MindmapService {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Generate a mindmap structure from document content
   * @param {string} workflowId - The workflow ID
   * @param {Array} documents - Array of document objects
   * @param {Object} requirements - Requirements analysis
   * @param {Object} workflowResults - Complete workflow results with processed content
   * @returns {Object} Mindmap structure
   */
  async generateMindmap(workflowId, documents, requirements, workflowResults = null) {
    try {
      logger.info(`Generating mindmap for workflow: ${workflowId}`);

      // Check cache first
      const cacheKey = `mindmap_${workflowId}`;
      if (this.cache.has(cacheKey)) {
        logger.info('Returning cached mindmap');
        return this.cache.get(cacheKey);
      }

      // Create requirements summary
      const requirementsSummary = this.summarizeRequirements(requirements);

      // Generate mindmap using AI with actual document content
      const mindmapStructure = await this.generateMindmapWithAI(
        documents,
        requirementsSummary,
        workflowResults
      );

      // Cache the result
      this.cache.set(cacheKey, mindmapStructure);

      logger.info('Mindmap generated successfully');
      return mindmapStructure;

    } catch (error) {
      logger.error('Error generating mindmap:', error);
      throw new Error(`Failed to generate mindmap: ${error.message}`);
    }
  }

  /**
   * Summarize requirements for mindmap generation
   */
  summarizeRequirements(requirements) {
    if (!requirements || !Array.isArray(requirements)) {
      return 'No requirements available';
    }

    const categorized = {};
    requirements.forEach(req => {
      const category = req.category || 'general';
      if (!categorized[category]) {
        categorized[category] = [];
      }
      categorized[category].push(req.description || req.requirement || 'Unknown requirement');
    });

    return Object.entries(categorized)
      .map(([category, reqs]) => `${category}: ${reqs.slice(0, 3).join(', ')}`)
      .join('; ');
  }

  /**
   * Generate mindmap structure using AI with document content analysis
   */
  async generateMindmapWithAI(documents, requirements, workflowResults = null) {
    try {
      logger.info('Generating AI-powered mindmap from document content');
      
      // Get actual document content for analysis (enhanced with workflow results)
      const documentContent = await this.extractDocumentContent(documents, workflowResults);
      
      const prompt = `Create a comprehensive mindmap from this RFP document. You must create AT LEAST 50 nodes to match NotebookLM quality.

DOCUMENT CONTENT:
${documentContent}

REQUIREMENTS:
${requirements}

INSTRUCTIONS:
You MUST create nodes for EVERY section, subsection, and important detail. This document has extensive structure that requires detailed breakdown.

CREATE NODES FOR:
1. MAIN SECTIONS: Introduction (1), Instructions to Bidders (2), Evaluation of Bids (3), Fraud and Corrupt Practices (4), Pre-Bid Conference (5), Miscellaneous (6)

2. ALL SUBSECTIONS in Section 1:
- 1.1 Background
- 1.2 Brief description of Bidding Process  
- 1.3 Schedule of Bidding Process

3. ALL SUBSECTIONS in Section 2 (Instructions to Bidders):
- 2.1 General terms of Bidding
- 2.2 Change in Ownership
- 2.3 Cost of Bidding
- 2.4 Verification of information
- 2.5 Verification and Disqualification
- 2.6 Contents of the RFP
- 2.7 Clarifications
- 2.8 Amendment of RFP
- 2.9 Format and Signing of Bid
- 2.10 Sealing and Marking of Bids
- 2.11 Bid Due Date
- 2.12 Late Bids
- 2.13 Contents of the Bid
- 2.14 Modifications/Substitution/Withdrawal of Bids
- 2.15 Rejection of Bids
- 2.16 Validity of Bids
- 2.17 Confidentiality
- 2.18 Correspondence with the Bidder
- 2.19 Bid Security

4. ALL SUBSECTIONS in Section 3 (Evaluation):
- 3.1 Opening and Evaluation of Bids
- 3.2 Tests of responsiveness
- 3.3 Selection of Bidder
- 3.4 Contacts during Bid Evaluation
- 3.5 Bid Parameter

5. ALL APPENDICES:
- Appendix I: Letter comprising the Bid
- Appendix II: Bank Guarantee for Bid Security
- Appendix III: Power of Attorney for signing of Bid
- Appendix IV: List of Bid-specific Clauses
- Appendix V: List of Project-specific Clauses

6. ALL SUB-SUBSECTIONS (1.1.1, 1.1.2, etc.) found in the document

7. ALL SPECIFIC DEADLINES AND DATES:
- Last date for receiving queries (12 days)
- Pre-Bid meeting
- Utility response to queries (20 days)
- Bid Due Date (30 days)
- Opening of Bids (30 days)
- Letter of Award (10 days)
- Validity of Bids (60 days)
- Signing of APP (10 days)

MINIMUM TARGET: 50+ nodes. Create detailed breakdown of every section.

NOTEBOOKLM-STYLE EXAMPLES (create similar detail):
For "Instructions to Bidders (Section 2)", create children like:
- "General Provisions (2.1)"
- "Language and Currency (2.2)"
- "Cost of Bidding (2.3): borne by Bidders"
- "Verification of Information (2.4)"
- "Verification and Disqualification (2.5)"
- "Documents (2.6-2.8)"
- "Preparation and Submission (2.9-2.14)"
- "Rejection of Bids (2.15): Utility retains right to annul process"
- "Validity of Bids (2.16): min 120 days from BDD"
- "Modification and Withdrawal (2.17-2.18)"
- "Bid Security (2.19)"
- "Opening and Evaluation (2.20-2.25)"

For "Evaluation Criteria (Section 3)", create children like:
- "Technical Evaluation (3.1)"
- "Financial Evaluation (3.2)"
- "Scoring Methodology (3.3)"
- "Qualification Criteria (3.4)"
- "Selection Process (3.5)"

EXTRACT SPECIFIC DETAILS like:
- Exact percentages, amounts, and thresholds
- Specific deadlines and timeframes
- Detailed procedural steps
- Compliance requirements
- Technical specifications
- Legal obligations

JSON STRUCTURE (return ONLY this JSON):
{
  "central": {
    "id": "root",
    "label": "[Extract exact document title]",
    "type": "central",
    "expanded": true,
    "hasChildren": true,
    "description": "Based on [X] source document(s)"
  },
  "nodes": [
    {
      "id": "descriptive_unique_id",
      "label": "[Exact section title with numbers and key details]",
      "type": "section|subsection|detail|subdetail|item",
      "parentId": "parent_node_id",
      "color": "#color_code",
      "textColor": "#text_color", 
      "description": "[Specific content description]",
      "priority": "high|medium|low",
      "expanded": false,
      "hasChildren": true|false,
      "level": 1-6
    }
  ],
  "connections": [
    {
      "from": "parent_id",
      "to": "child_id", 
      "type": "hierarchy"
    }
  ]
}

QUALITY REQUIREMENTS:
- MINIMUM 50 nodes (aim for 60-80+ for NotebookLM quality)
- 4-6 levels of hierarchy depth
- Use exact section numbers and titles from document
- Include specific deadlines, amounts, and requirements in labels
- Colors: #E8F4FD (sections), #D1FAE5 (subsections), #FEF3C7 (details), #E9D5FF (sub-details), #FEE2E2 (items)
- IDs: descriptive like "section_1_intro", "subsection_2_1_general", "appendix_i_bid_letter"
- Labels: detailed like "Background (1.1)", "Bid Security (2.19): Bank Guarantee", "Validity of Bids (2.16): 60 days"

CRITICAL: You must create nodes for ALL sections listed above. Do not skip any. This is a structural decomposition, not a summary.`;

      const response = await bedrockService.invokeMindmapModel(prompt, 16000, 0.1);
      
      if (response && response.trim()) {
        try {
          // Clean the response to extract JSON
          let jsonStr = response.trim();
          
          console.log('=== RAW AI RESPONSE (first 1000 chars) ===');
          console.log(jsonStr.substring(0, 1000));
          
          // Remove any markdown formatting
          if (jsonStr.includes('```json')) {
            const jsonStart = jsonStr.indexOf('```json') + 7;
            const jsonEnd = jsonStr.lastIndexOf('```');
            jsonStr = jsonStr.substring(jsonStart, jsonEnd).trim();
            console.log('Extracted from ```json``` blocks');
          } else if (jsonStr.includes('```')) {
            const jsonStart = jsonStr.indexOf('```') + 3;
            const jsonEnd = jsonStr.lastIndexOf('```');
            jsonStr = jsonStr.substring(jsonStart, jsonEnd).trim();
            console.log('Extracted from ``` blocks');
          }
          
          // Look for JSON object in the response (handle cases where AI adds explanatory text)
          const jsonStartIndex = jsonStr.indexOf('{');
          const jsonEndIndex = jsonStr.lastIndexOf('}') + 1;
          
          if (jsonStartIndex !== -1 && jsonEndIndex > jsonStartIndex) {
            jsonStr = jsonStr.substring(jsonStartIndex, jsonEndIndex);
            console.log('Extracted JSON object from response');
          }
          
          console.log('=== FINAL JSON STRING (first 500 chars) ===');
          console.log(jsonStr.substring(0, 500));
          
          const aiMindmap = JSON.parse(jsonStr);
          
          // Validate and enhance the AI-generated structure
          const validatedMindmap = this.validateAndEnhanceMindmap(aiMindmap);
          
          logger.info(`AI-generated mindmap created with ${validatedMindmap.nodes.length} nodes`);
          return validatedMindmap;
          
        } catch (parseError) {
          logger.error('Failed to parse AI mindmap response:', parseError);
          logger.error('Full AI Response:', response);
          console.log('=== FULL AI RESPONSE FOR DEBUGGING ===');
          console.log(response);
          console.log('=== END AI RESPONSE ===');
          throw parseError;
        }
      } else {
        throw new Error('Empty response from AI model');
      }
      
    } catch (error) {
      logger.error('AI mindmap generation failed:', error);
      logger.info('Falling back to simple structure');
      return this.createFallbackMindmap(documents, requirements);
    }
  }

  /**
   * Extract actual content from documents for AI analysis
   */
  async extractDocumentContent(documents, workflowResults = null) {
    let content = '';
    
    try {
      content += 'COMPREHENSIVE RFP DOCUMENT ANALYSIS FOR NOTEBOOKLM-STYLE MINDMAP:\n\n';
      
      // First, try to get rich content from workflow results
      if (workflowResults && workflowResults.document_ingestion) {
        content += '=== PROCESSED DOCUMENT CONTENT (FROM WORKFLOW RESULTS) ===\n\n';
        
        // Extract from document ingestion results
        const docResults = workflowResults.document_ingestion;
        
        // Handle both array and object formats
        const docData = Array.isArray(docResults) ? docResults[0] : 
                       (docResults['0'] || docResults);
        
        if (docData) {
          content += `DOCUMENT TITLE: ${docData.title || 'RFP Document'}\n`;
          content += `DOCUMENT TYPE: ${docData.documentType || 'RFP'}\n`;
          content += `FILE NAME: ${docData.fileName || 'Unknown'}\n\n`;
          
          content += `OVERVIEW:\n${docData.overview || 'No overview available'}\n\n`;
          
          // Add the full processed content (this is the key improvement!)
          if (docData.processedContent) {
            content += 'FULL DOCUMENT TEXT CONTENT:\n';
            content += docData.processedContent;
            content += '\n\n';
          }
          
          // Add structured requirements data
          if (docData.keyRequirements && Array.isArray(docData.keyRequirements)) {
            content += 'KEY REQUIREMENTS:\n';
            docData.keyRequirements.forEach((req, i) => {
              content += `${i + 1}. ${req}\n`;
            });
            content += '\n';
          }
          
          // Add technical specifications
          if (docData.technicalSpecs && Array.isArray(docData.technicalSpecs)) {
            content += 'TECHNICAL SPECIFICATIONS:\n';
            docData.technicalSpecs.forEach((spec, i) => {
              content += `${i + 1}. ${spec}\n`;
            });
            content += '\n';
          }
          
          // Add evaluation criteria
          if (docData.evaluationCriteria && Array.isArray(docData.evaluationCriteria)) {
            content += 'EVALUATION CRITERIA:\n';
            docData.evaluationCriteria.forEach((criteria, i) => {
              content += `${i + 1}. ${criteria}\n`;
            });
            content += '\n';
          }
          
          // Add deadlines and important dates
          if (docData.deadlines && Array.isArray(docData.deadlines)) {
            content += 'DEADLINES AND IMPORTANT DATES:\n';
            docData.deadlines.forEach((deadline, i) => {
              content += `${i + 1}. ${deadline}\n`;
            });
            content += '\n';
          }
          
          // Add submission requirements
          if (docData.submissionRequirements && Array.isArray(docData.submissionRequirements)) {
            content += 'SUBMISSION REQUIREMENTS:\n';
            docData.submissionRequirements.forEach((req, i) => {
              content += `${i + 1}. ${req}\n`;
            });
            content += '\n';
          }
        }
      }
      
      // Fallback to document metadata if workflow results not available
      if (content.length < 1000) {
        content += '=== DOCUMENT METADATA ===\n\n';
        for (const doc of documents) {
          content += `DOCUMENT: ${doc.original_name || doc.name}\n`;
          content += `Type: ${doc.mime_type || doc.type}\n`;
          content += `Size: ${Math.round((doc.file_size || doc.size || 0) / 1024)}KB\n\n`;
          
          if (doc.processed_content) {
            content += 'DOCUMENT CONTENT:\n';
            content += doc.processed_content;
            content += '\n\n';
          }
        }
      }
      
      // If still no content, use enhanced context
      if (content.length < 1000) {
        content += this.getEnhancedDocumentContext(documents);
      }
      
      // Claude 3.5 Sonnet can handle much more content (~200K tokens = ~150K chars)
      // For NotebookLM-level analysis, we need comprehensive content
      if (content.length > 100000) {
        // Keep much more content for detailed analysis (80K chars)
        const beginning = content.substring(0, 40000);
        const ending = content.substring(content.length - 40000);
        content = beginning + '\n\n[MIDDLE CONTENT TRUNCATED FOR LENGTH - SHOWING COMPREHENSIVE BEGINNING AND END SECTIONS]\n\n' + ending;
      }
      
      logger.info(`Extracted document content: ${content.length} characters`);
      return content;
      
    } catch (error) {
      logger.error('Error extracting document content:', error);
      return this.getEnhancedDocumentContext(documents);
    }
  }

  /**
   * Get enhanced context about document types when actual content is not available
   */
  getEnhancedDocumentContext(documents) {
    return this.getDocumentTypeContext(documents);
  }

  /**
   * Get context about document types when actual content is not available
   */
  getDocumentTypeContext(documents) {
    let context = 'DOCUMENT TYPE ANALYSIS:\n\n';
    
    documents.forEach((doc, index) => {
      context += `Document ${index + 1}: ${doc.original_name || doc.name}\n`;
      context += `Type: ${doc.mime_type || doc.type || 'unknown'}\n`;
      context += `Size: ${Math.round((doc.file_size || doc.size || 0) / 1024)}KB\n\n`;
    });
    
    context += `
INFERRED DOCUMENT STRUCTURE (RFP for Power Procurement):
Based on the document names and types, this appears to be a comprehensive RFP document that likely contains:

1. INTRODUCTION/BACKGROUND SECTION
   - Project overview and objectives
   - Scope of work and deliverables
   - Background information and context

2. INSTRUCTIONS TO BIDDERS SECTION
   - General provisions and requirements
   - Language and currency specifications
   - Cost of bidding (borne by bidders)
   - Verification of information procedures
   - Verification and disqualification criteria
   - Document requirements and specifications
   - Preparation and submission guidelines
   - Rejection of bids policies
   - Validity of bids (minimum duration)
   - Bid security requirements
   - Opening and evaluation procedures

3. EVALUATION CRITERIA SECTION
   - Technical evaluation criteria
   - Financial evaluation methods
   - Scoring methodology and weightings
   - Selection process and timeline

4. TERMS AND CONDITIONS SECTION
   - Contract terms and conditions
   - Legal requirements and compliance
   - Fraud and corrupt practices policies
   - Penalties and sanctions

5. APPENDICES AND FORMS
   - Required forms and templates
   - Technical specifications
   - Legal documents and agreements
   - Supporting documentation

This structure should be analyzed to create a comprehensive mindmap with multiple levels of detail.`;

    return context;
  }

  /**
   * Create a simple fallback mindmap structure when AI fails
   */
  createFallbackMindmap(documents, requirements) {
    const mindmap = {
      central: {
        id: 'root',
        label: 'RFP Document Analysis',
        type: 'central',
        expanded: true,
        hasChildren: true,
        description: `Based on ${documents.length} document(s)`
      },
      nodes: [
        {
          id: 'background_section',
          label: 'Background and Overview',
          type: 'section',
          parentId: 'root',
          color: '#E8F4FD',
          textColor: '#1E40AF',
          description: 'Project background and context',
          priority: 'high',
          expanded: false,
          hasChildren: true,
          level: 1
        },
        {
          id: 'instructions_section',
          label: 'Instructions to Bidders',
          type: 'section',
          parentId: 'root',
          color: '#D1FAE5',
          textColor: '#065F46',
          description: 'Bidding instructions and requirements',
          priority: 'high',
          expanded: false,
          hasChildren: true,
          level: 1
        },
        {
          id: 'evaluation_section',
          label: 'Evaluation Criteria',
          type: 'section',
          parentId: 'root',
          color: '#FEF3C7',
          textColor: '#92400E',
          description: 'Bid evaluation methodology',
          priority: 'high',
          expanded: false,
          hasChildren: true,
          level: 1
        },
        {
          id: 'terms_section',
          label: 'Terms and Conditions',
          type: 'section',
          parentId: 'root',
          color: '#E9D5FF',
          textColor: '#6B21A8',
          description: 'Legal terms and requirements',
          priority: 'medium',
          expanded: false,
          hasChildren: true,
          level: 1
        }
      ],
      connections: [
        { from: 'root', to: 'background_section', type: 'hierarchy' },
        { from: 'root', to: 'instructions_section', type: 'hierarchy' },
        { from: 'root', to: 'evaluation_section', type: 'hierarchy' },
        { from: 'root', to: 'terms_section', type: 'hierarchy' }
      ]
    };

    // Add document nodes
    documents.forEach((doc, index) => {
      const docId = `doc_${index}`;
      mindmap.nodes.push({
        id: docId,
        label: doc.original_name || doc.name,
        type: 'document',
        parentId: 'root',
        color: '#F3F4F6',
        textColor: '#374151',
        description: `${doc.mime_type || doc.type} file - ${Math.round((doc.file_size || doc.size || 0) / 1024)}KB`,
        priority: 'low',
        expanded: false,
        hasChildren: false,
        level: 1
      });
      mindmap.connections.push({
        from: 'root',
        to: docId,
        type: 'hierarchy'
      });
    });

    // Validate and clean up the mindmap structure
    return this.validateAndEnhanceMindmap(mindmap);
  }

  /**
   * Validate and enhance mindmap structure
   */
  validateAndEnhanceMindmap(mindmap) {
    // Ensure required properties exist
    if (!mindmap.central) {
      mindmap.central = {
        id: 'root',
        label: 'RFP Analysis',
        type: 'central'
      };
    }

    if (!mindmap.nodes) {
      mindmap.nodes = [];
    }

    if (!mindmap.connections) {
      mindmap.connections = [];
    }

    // Remove duplicate nodes (keep the first occurrence)
    const seenIds = new Set();
    mindmap.nodes = mindmap.nodes.filter(node => {
      if (seenIds.has(node.id)) {
        logger.warn(`Removing duplicate node: ${node.id}`);
        return false;
      }
      seenIds.add(node.id);
      return true;
    });

    // Validate node structure
    mindmap.nodes = mindmap.nodes.map(node => ({
      id: node.id || `node_${Math.random().toString(36).substr(2, 9)}`,
      label: node.label || 'Untitled',
      type: node.type || 'detail',
      parentId: node.parentId || 'root',
      color: node.color || '#6B7280',
      textColor: node.textColor || '#374151',
      description: node.description || '',
      priority: node.priority || 'medium',
      expanded: node.expanded || false,
      hasChildren: node.hasChildren || false,
      level: node.level || 1
    }));

    // Remove duplicate connections
    const seenConnections = new Set();
    mindmap.connections = mindmap.connections.filter(conn => {
      const connKey = `${conn.from}-${conn.to}`;
      if (seenConnections.has(connKey)) {
        logger.warn(`Removing duplicate connection: ${connKey}`);
        return false;
      }
      seenConnections.add(connKey);
      return true;
    });

    // Add metadata
    mindmap.metadata = {
      generatedAt: new Date().toISOString(),
      nodeCount: mindmap.nodes.length,
      connectionCount: mindmap.connections.length,
      version: '1.0'
    };

    logger.info(`Mindmap validated: ${mindmap.nodes.length} nodes, ${mindmap.connections.length} connections`);
    return mindmap;
  }

  /**
   * Get cached mindmap or return null
   */
  getCachedMindmap(workflowId) {
    const cacheKey = `mindmap_${workflowId}`;
    return this.cache.get(cacheKey) || null;
  }

  /**
   * Clear cache for a specific workflow
   */
  clearCache(workflowId) {
    const cacheKey = `mindmap_${workflowId}`;
    this.cache.delete(cacheKey);
  }

  /**
   * Export mindmap in different formats
   */
  exportMindmap(mindmap, format = 'json') {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(mindmap, null, 2);
      
      case 'mermaid':
        return this.convertToMermaid(mindmap);
      
      case 'graphviz':
        return this.convertToGraphviz(mindmap);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Convert mindmap to Mermaid diagram format
   */
  convertToMermaid(mindmap) {
    let mermaid = 'graph TD\n';
    
    // Add central node
    mermaid += `    ${mindmap.central.id}["${mindmap.central.label}"]\n`;
    
    // Add nodes and connections
    mindmap.nodes.forEach(node => {
      const shape = node.type === 'main' ? '[]' : node.type === 'detail' ? '()' : '{}';
      mermaid += `    ${node.id}${shape[0]}"${node.label}"${shape[1]}\n`;
    });
    
    // Add connections
    mindmap.connections.forEach(conn => {
      mermaid += `    ${conn.from} --> ${conn.to}\n`;
    });
    
    return mermaid;
  }

  /**
   * Convert mindmap to Graphviz DOT format
   */
  convertToGraphviz(mindmap) {
    let dot = 'digraph mindmap {\n';
    dot += '    rankdir=TB;\n';
    dot += '    node [shape=box, style=rounded];\n';
    
    // Add central node
    dot += `    "${mindmap.central.id}" [label="${mindmap.central.label}", style=filled, fillcolor=lightblue];\n`;
    
    // Add nodes
    mindmap.nodes.forEach(node => {
      const color = node.color.replace('#', '');
      dot += `    "${node.id}" [label="${node.label}", style=filled, fillcolor="#${color}"];\n`;
    });
    
    // Add connections
    mindmap.connections.forEach(conn => {
      dot += `    "${conn.from}" -> "${conn.to}";\n`;
    });
    
    dot += '}';
    return dot;
  }
}

module.exports = new MindmapService();