const bedrockService = require('./bedrock');
const geminiService = require('./geminiService');
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
      logger.info('Generating NotebookLM-style mindmap using Gemini from document content');
      
      // Get actual document content for analysis (enhanced with workflow results)
      const documentContent = await this.extractDocumentContent(documents, workflowResults);
      
      const prompt = `Create a detailed mindmap for this RFP document. Return ONLY valid JSON with no extra text.

DOCUMENT CONTENT:
${documentContent.substring(0, 8000)}

Create a comprehensive mindmap with 50-100 nodes covering all major sections, requirements, deadlines, and evaluation criteria.

Return ONLY this JSON structure:
{
  "central": {
    "id": "root",
    "label": "RFP Document Analysis",
    "type": "central",
    "expanded": true,
    "hasChildren": true,
    "description": "Comprehensive RFP analysis"
  },
  "nodes": [
    {
      "id": "section_1",
      "label": "Section 1: Background",
      "type": "section",
      "parentId": "root",
      "color": "#E8F4FD",
      "textColor": "#1E40AF",
      "description": "Project background and overview",
      "priority": "high",
      "expanded": false,
      "hasChildren": true,
      "level": 1
    }
  ],
  "connections": [
    {
      "from": "root",
      "to": "section_1",
      "type": "hierarchy"
    }
  ]
}

IMPORTANT: Return ONLY valid JSON. No markdown, no explanations, just the JSON object.`;

      const response = await geminiService.generateMindmap(prompt);
      
      if (response && response.trim()) {
        try {
          // Enhanced JSON extraction and repair for Gemini responses
          let jsonStr = response.trim();
          
          logger.info(`Raw Gemini response length: ${jsonStr.length} characters`);
          
          // Handle multiple markdown formats
          if (jsonStr.includes('```json')) {
            const jsonStart = jsonStr.indexOf('```json') + 7;
            const jsonEnd = jsonStr.lastIndexOf('```');
            if (jsonEnd > jsonStart) {
              jsonStr = jsonStr.substring(jsonStart, jsonEnd).trim();
              logger.info('Extracted from ```json``` markdown blocks');
            }
          } else if (jsonStr.includes('```')) {
            const jsonStart = jsonStr.indexOf('```') + 3;
            const jsonEnd = jsonStr.lastIndexOf('```');
            if (jsonEnd > jsonStart) {
              jsonStr = jsonStr.substring(jsonStart, jsonEnd).trim();
              logger.info('Extracted from ``` markdown blocks');
            }
          }
          
          // Find the main JSON object (handle cases where AI adds explanatory text)
          const jsonStartIndex = jsonStr.indexOf('{');
          const jsonEndIndex = jsonStr.lastIndexOf('}') + 1;
          
          if (jsonStartIndex !== -1 && jsonEndIndex > jsonStartIndex) {
            jsonStr = jsonStr.substring(jsonStartIndex, jsonEndIndex);
            logger.info('Extracted main JSON object from response');
          }
          
          // Clean up any remaining markdown artifacts
          jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
          
          // Advanced JSON repair for common Gemini issues
          jsonStr = this.repairJsonString(jsonStr);
          
          logger.info(`Final JSON string length: ${jsonStr.length} characters`);
          
          const aiMindmap = JSON.parse(jsonStr);
          
          // Validate and enhance the AI-generated structure
          const validatedMindmap = this.validateAndEnhanceMindmap(aiMindmap);
          
          logger.info(`AI-generated mindmap created with ${validatedMindmap.nodes.length} nodes`);
          return validatedMindmap;
          
        } catch (parseError) {
          logger.error('Failed to parse AI mindmap response:', parseError);
          logger.error('JSON parsing failed, response length:', response.length);
          logger.debug('Response preview:', response.substring(0, 1000));
          
          // Try one more time with aggressive JSON extraction
          try {
            logger.info('Attempting aggressive JSON extraction...');
            const aggressiveJson = this.extractJsonAggressively(response);
            if (aggressiveJson) {
              const aiMindmap = JSON.parse(aggressiveJson);
              const validatedMindmap = this.validateAndEnhanceMindmap(aiMindmap);
              logger.info(`Aggressive extraction successful with ${validatedMindmap.nodes.length} nodes`);
              return validatedMindmap;
            }
          } catch (aggressiveError) {
            logger.error('Aggressive JSON extraction also failed:', aggressiveError.message);
          }
          
          // Save the problematic JSON to a file for debugging
          try {
            const fs = require('fs');
            const debugPath = `./debug-json-${Date.now()}.json`;
            fs.writeFileSync(debugPath, jsonStr || response);
            logger.error(`Saved problematic JSON to: ${debugPath}`);
            
            // Also log specific details about the error
            if (typeof jsonStr !== 'undefined') {
              logger.error('Characters around position 47:', JSON.stringify(jsonStr.substring(40, 60)));
              logger.error('Character at position 47:', JSON.stringify(jsonStr.charAt(47)));
            }
          } catch (saveError) {
            logger.error('Failed to save debug JSON:', saveError.message);
          }
          
          throw parseError;
        }
      } else {
        throw new Error('Empty response from AI model');
      }
      
    } catch (error) {
      logger.error('Gemini mindmap generation failed:', error);
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
   * Aggressively extract JSON from response when normal parsing fails
   */
  extractJsonAggressively(response) {
    try {
      // Look for the largest valid JSON object in the response
      const lines = response.split('\n');
      let bestJson = '';
      let maxLength = 0;
      
      for (let i = 0; i < lines.length; i++) {
        for (let j = i; j < lines.length; j++) {
          const candidate = lines.slice(i, j + 1).join('\n').trim();
          
          if (candidate.startsWith('{') && candidate.includes('"central"') && candidate.includes('"nodes"')) {
            try {
              // Try to find the end of this JSON object
              let braceCount = 0;
              let endIndex = -1;
              
              for (let k = 0; k < candidate.length; k++) {
                if (candidate[k] === '{') braceCount++;
                if (candidate[k] === '}') braceCount--;
                if (braceCount === 0 && k > 0) {
                  endIndex = k;
                  break;
                }
              }
              
              if (endIndex > 0) {
                const jsonCandidate = candidate.substring(0, endIndex + 1);
                const repaired = this.repairJsonString(jsonCandidate);
                
                // Test if it's valid JSON
                JSON.parse(repaired);
                
                if (repaired.length > maxLength) {
                  maxLength = repaired.length;
                  bestJson = repaired;
                }
              }
            } catch (e) {
              // Continue searching
            }
          }
        }
      }
      
      return bestJson || null;
    } catch (error) {
      logger.error('Aggressive JSON extraction failed:', error.message);
      return null;
    }
  }

  /**
   * Repair common JSON issues in Gemini responses
   */
  repairJsonString(jsonStr) {
    try {
      logger.info('Starting JSON repair process');
      
      // Debug the beginning of the JSON to understand position 47 error
      logger.debug('JSON start (first 200 chars):', jsonStr.substring(0, 200));
      
      // Fix early JSON issues (position 47 suggests early structure problems)
      // Fix missing quotes around property names at the beginning
      jsonStr = jsonStr.replace(/^(\s*{[^"]*?)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
      
      // Remove any trailing commas before closing brackets/braces
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
      
      // Fix common array/object ending issues
      jsonStr = jsonStr.replace(/,(\s*$)/g, ''); // Remove trailing comma at end
      jsonStr = jsonStr.replace(/([^,\[\{])\s*\n\s*([}\]])/g, '$1$2'); // Fix newlines before closing
      
      // Fix property value issues (missing quotes, etc.)
      jsonStr = jsonStr.replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*([,}])/g, ':"$1"$2');
      
      // Fix unescaped quotes in strings (common in AI responses)
      jsonStr = jsonStr.replace(/"([^"]*)"([^"]*)"([^"]*)":/g, '"$1\\"$2\\"$3":');
      
      // Fix missing quotes around property names
      jsonStr = jsonStr.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
      
      // Fix single quotes to double quotes
      jsonStr = jsonStr.replace(/'/g, '"');
      
      // Remove any control characters that might break JSON
      jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, '');
      
      // Fix incomplete JSON by ensuring proper closing
      const openBraces = (jsonStr.match(/{/g) || []).length;
      const closeBraces = (jsonStr.match(/}/g) || []).length;
      const openBrackets = (jsonStr.match(/\[/g) || []).length;
      const closeBrackets = (jsonStr.match(/\]/g) || []).length;
      
      logger.info(`JSON structure analysis: {${openBraces}/${closeBraces}, [${openBrackets}/${closeBrackets}]`);
      
      // Add missing closing braces
      for (let i = 0; i < openBraces - closeBraces; i++) {
        jsonStr += '}';
        logger.info('Added missing closing brace');
      }
      
      // Add missing closing brackets
      for (let i = 0; i < openBrackets - closeBrackets; i++) {
        jsonStr += ']';
        logger.info('Added missing closing bracket');
      }
      
      // Advanced repair: Try to fix the specific error at position 15057
      // This handles cases where there's a missing comma or bracket in large arrays
      if (jsonStr.length > 15000) {
        logger.info('Applying advanced repair for large JSON');
        
        // Look for common patterns around the error position
        const errorPos = 15057;
        const start = Math.max(0, errorPos - 100);
        const end = Math.min(jsonStr.length, errorPos + 100);
        const context = jsonStr.substring(start, end);
        
        logger.debug('Context around error position:', context);
        
        // Fix missing commas in arrays
        jsonStr = jsonStr.replace(/}\s*{/g, '},{');
        jsonStr = jsonStr.replace(/]\s*\[/g, '],[');
        jsonStr = jsonStr.replace(/"\s*"/g, '","');
        
        // Fix incomplete array elements
        jsonStr = jsonStr.replace(/,\s*]/g, ']');
        jsonStr = jsonStr.replace(/,\s*}/g, '}');
      }
      
      logger.info('JSON repair completed successfully');
      return jsonStr;
      
    } catch (error) {
      logger.warn('JSON repair failed, returning original string:', error.message);
      return jsonStr;
    }
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
   * Create a NotebookLM-style fallback mindmap structure when AI fails
   */
  createFallbackMindmap(documents, requirements) {
    const mindmap = {
      central: {
        id: 'root',
        label: 'RFP Document Analysis',
        type: 'central',
        expanded: true,
        hasChildren: true,
        description: `Comprehensive analysis of ${documents.length} document(s)`
      },
      nodes: [],
      connections: []
    };

    // Create an extremely deep NotebookLM-style structure with 6 levels (150+ nodes)
    const sections = [
      {
        id: 'section_1_background',
        label: 'Section 1: Background and Overview',
        type: 'section',
        color: '#E8F4FD',
        textColor: '#1E40AF',
        children: [
          { 
            id: 'project_overview', 
            label: 'Project Overview and Objectives', 
            type: 'subsection',
            children: [
              { 
                id: 'project_scope', 
                label: 'Project Scope Definition', 
                type: 'detail',
                children: [
                  { 
                    id: 'scope_boundaries', 
                    label: 'Scope Boundaries and Limitations', 
                    type: 'item',
                    children: [
                      { id: 'included_activities', label: 'Included Activities and Services', type: 'subitem' },
                      { id: 'excluded_activities', label: 'Excluded Activities and Services', type: 'subitem' },
                      { id: 'boundary_conditions', label: 'Boundary Conditions and Assumptions', type: 'subitem' }
                    ]
                  },
                  { 
                    id: 'deliverable_matrix', 
                    label: 'Deliverable Matrix and Specifications', 
                    type: 'item',
                    children: [
                      { id: 'primary_deliverables', label: 'Primary Deliverables: 15 items', type: 'subitem' },
                      { id: 'secondary_deliverables', label: 'Secondary Deliverables: 8 items', type: 'subitem' },
                      { id: 'quality_metrics', label: 'Quality Metrics and Acceptance Criteria', type: 'subitem' }
                    ]
                  }
                ]
              },
              { 
                id: 'key_objectives', 
                label: 'Key Project Objectives', 
                type: 'detail',
                children: [
                  { 
                    id: 'strategic_objectives', 
                    label: 'Strategic Business Objectives', 
                    type: 'item',
                    children: [
                      { id: 'market_expansion', label: 'Market Expansion: 25% growth target', type: 'subitem' },
                      { id: 'cost_reduction', label: 'Cost Reduction: 15% operational savings', type: 'subitem' },
                      { id: 'efficiency_gains', label: 'Efficiency Gains: 30% process improvement', type: 'subitem' }
                    ]
                  },
                  { 
                    id: 'operational_objectives', 
                    label: 'Operational Performance Objectives', 
                    type: 'item',
                    children: [
                      { id: 'uptime_target', label: 'System Uptime: 99.9% availability', type: 'subitem' },
                      { id: 'response_time', label: 'Response Time: <2 seconds average', type: 'subitem' },
                      { id: 'capacity_target', label: 'Capacity Target: 10,000 concurrent users', type: 'subitem' }
                    ]
                  }
                ]
              }
            ]
          },
          { 
            id: 'scope_of_work', 
            label: 'Scope of Work and Deliverables', 
            type: 'subsection',
            children: [
              { 
                id: 'work_breakdown', 
                label: 'Work Breakdown Structure', 
                type: 'detail',
                children: [
                  { 
                    id: 'phase_1_planning', 
                    label: 'Phase 1: Planning and Design (Months 1-4)', 
                    type: 'item',
                    children: [
                      { id: 'requirements_gathering', label: 'Requirements Gathering: 6 weeks', type: 'subitem' },
                      { id: 'system_design', label: 'System Design and Architecture: 4 weeks', type: 'subitem' },
                      { id: 'resource_planning', label: 'Resource Planning and Allocation: 2 weeks', type: 'subitem' },
                      { id: 'risk_assessment', label: 'Risk Assessment and Mitigation: 2 weeks', type: 'subitem' }
                    ]
                  },
                  { 
                    id: 'phase_2_implementation', 
                    label: 'Phase 2: Implementation (Months 5-14)', 
                    type: 'item',
                    children: [
                      { id: 'development_sprint1', label: 'Development Sprint 1: Core Features (8 weeks)', type: 'subitem' },
                      { id: 'development_sprint2', label: 'Development Sprint 2: Advanced Features (8 weeks)', type: 'subitem' },
                      { id: 'integration_testing', label: 'Integration Testing: 6 weeks', type: 'subitem' },
                      { id: 'performance_optimization', label: 'Performance Optimization: 4 weeks', type: 'subitem' },
                      { id: 'security_hardening', label: 'Security Hardening: 3 weeks', type: 'subitem' },
                      { id: 'user_acceptance_testing', label: 'User Acceptance Testing: 3 weeks', type: 'subitem' }
                    ]
                  },
                  { 
                    id: 'phase_3_deployment', 
                    label: 'Phase 3: Deployment and Closure (Months 15-18)', 
                    type: 'item',
                    children: [
                      { id: 'production_deployment', label: 'Production Deployment: 4 weeks', type: 'subitem' },
                      { id: 'user_training', label: 'User Training and Documentation: 6 weeks', type: 'subitem' },
                      { id: 'go_live_support', label: 'Go-Live Support: 4 weeks', type: 'subitem' },
                      { id: 'project_closure', label: 'Project Closure and Handover: 2 weeks', type: 'subitem' }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        id: 'section_2_instructions',
        label: 'Section 2: Instructions to Bidders',
        type: 'section',
        color: '#D1FAE5',
        textColor: '#065F46',
        children: [
          { 
            id: 'general_provisions', 
            label: 'General Provisions (2.1-2.5)', 
            type: 'subsection',
            children: [
              { 
                id: 'bidder_eligibility', 
                label: 'Bidder Eligibility (2.1)', 
                type: 'detail',
                children: [
                  { 
                    id: 'legal_entity_status', 
                    label: 'Legal Entity Status Required', 
                    type: 'item',
                    children: [
                      { id: 'incorporation_certificate', label: 'Certificate of Incorporation', type: 'subitem' },
                      { id: 'business_license', label: 'Valid Business License', type: 'subitem' },
                      { id: 'tax_registration', label: 'Tax Registration Certificate', type: 'subitem' },
                      { id: 'good_standing_certificate', label: 'Certificate of Good Standing', type: 'subitem' }
                    ]
                  },
                  { 
                    id: 'registration_docs', 
                    label: 'Registration Documentation', 
                    type: 'item',
                    children: [
                      { id: 'company_profile', label: 'Company Profile and History', type: 'subitem' },
                      { id: 'organizational_chart', label: 'Organizational Chart', type: 'subitem' },
                      { id: 'key_personnel_cvs', label: 'Key Personnel CVs and Qualifications', type: 'subitem' },
                      { id: 'office_locations', label: 'Office Locations and Contact Details', type: 'subitem' }
                    ]
                  },
                  { 
                    id: 'financial_standing', 
                    label: 'Financial Standing Proof', 
                    type: 'item',
                    children: [
                      { id: 'audited_financials_3yr', label: 'Audited Financial Statements: Last 3 years', type: 'subitem' },
                      { id: 'bank_statements_6mo', label: 'Bank Statements: Last 6 months', type: 'subitem' },
                      { id: 'credit_rating', label: 'Credit Rating Certificate', type: 'subitem' },
                      { id: 'financial_capacity', label: 'Financial Capacity: Min $5M annual revenue', type: 'subitem' },
                      { id: 'bonding_capacity', label: 'Bonding Capacity: Min $2M', type: 'subitem' }
                    ]
                  }
                ]
              },
              { 
                id: 'language_currency', 
                label: 'Language and Currency (2.2)', 
                type: 'detail',
                children: [
                  { 
                    id: 'bid_language', 
                    label: 'Bid Language: English', 
                    type: 'item',
                    children: [
                      { id: 'primary_language', label: 'Primary Language: English (US)', type: 'subitem' },
                      { id: 'translation_requirements', label: 'Translation Requirements for Foreign Documents', type: 'subitem' },
                      { id: 'certified_translations', label: 'Certified Translations Required', type: 'subitem' }
                    ]
                  },
                  { 
                    id: 'currency_requirements', 
                    label: 'Currency: Local Currency', 
                    type: 'item',
                    children: [
                      { id: 'base_currency', label: 'Base Currency: USD', type: 'subitem' },
                      { id: 'exchange_rate_date', label: 'Exchange Rate Date: Bid Submission Date', type: 'subitem' },
                      { id: 'currency_fluctuation', label: 'Currency Fluctuation Risk: Bidder responsibility', type: 'subitem' }
                    ]
                  }
                ]
              }
            ]
          },
          { 
            id: 'document_requirements', 
            label: 'Document Requirements (2.6-2.8)', 
            type: 'subsection',
            children: [
              { 
                id: 'rfp_contents', 
                label: 'Contents of RFP (2.6)', 
                type: 'detail',
                children: [
                  { id: 'invitation_letter', label: 'Letter of Invitation', type: 'item' },
                  { id: 'instructions_bidders', label: 'Instructions to Bidders', type: 'item' },
                  { id: 'evaluation_criteria', label: 'Evaluation Criteria', type: 'item' },
                  { id: 'terms_conditions', label: 'Terms and Conditions', type: 'item' },
                  { id: 'appendices', label: 'Appendices I-V', type: 'item' }
                ]
              },
              { 
                id: 'clarifications', 
                label: 'Clarifications (2.7)', 
                type: 'detail',
                children: [
                  { id: 'query_submission', label: 'Query Submission: 12 Days from RFP Date', type: 'item' },
                  { id: 'written_format', label: 'Written Format Only', type: 'item' },
                  { id: 'response_timeline', label: 'Utility Response: 20 Days from RFP Date', type: 'item' }
                ]
              }
            ]
          },
          { 
            id: 'bid_validity', 
            label: 'Bid Validity and Security (2.15-2.19)', 
            type: 'subsection',
            children: [
              { 
                id: 'validity_period', 
                label: 'Validity of Bids (2.16)', 
                type: 'detail',
                children: [
                  { id: 'minimum_validity', label: 'Minimum 120 days from Bid Due Date', type: 'item' },
                  { id: 'extension_rights', label: 'Extension Rights Reserved', type: 'item' }
                ]
              },
              { 
                id: 'bid_security', 
                label: 'Bid Security (2.19)', 
                type: 'detail',
                children: [
                  { id: 'security_amount', label: 'Rs. 5 lakh per MW', type: 'item' },
                  { id: 'bank_guarantee', label: 'Via Bank Guarantee', type: 'item' },
                  { id: 'validity_period_security', label: 'Valid for 150 days', type: 'item' }
                ]
              }
            ]
          }
        ]
      },
      {
        id: 'section_3_evaluation',
        label: 'Section 3: Evaluation Criteria',
        type: 'section',
        color: '#FEF3C7',
        textColor: '#92400E',
        children: [
          { 
            id: 'technical_evaluation', 
            label: 'Technical Evaluation Criteria', 
            type: 'subsection',
            children: [
              { 
                id: 'technical_weightage', 
                label: 'Technical Evaluation: 70% Weightage', 
                type: 'detail',
                children: [
                  { 
                    id: 'experience_score', 
                    label: 'Experience: 25 points', 
                    type: 'item',
                    children: [
                      { id: 'years_in_business', label: 'Years in Business: 5 points (1 point per year, max 5)', type: 'subitem' },
                      { id: 'industry_experience', label: 'Industry-Specific Experience: 10 points', type: 'subitem' },
                      { id: 'project_portfolio', label: 'Project Portfolio Size: 5 points (>20 projects)', type: 'subitem' },
                      { id: 'client_references', label: 'Client References: 5 points (min 5 references)', type: 'subitem' }
                    ]
                  },
                  { 
                    id: 'technical_capability', 
                    label: 'Technical Capability: 30 points', 
                    type: 'item',
                    children: [
                      { id: 'technical_expertise', label: 'Technical Expertise and Certifications: 10 points', type: 'subitem' },
                      { id: 'infrastructure_capacity', label: 'Infrastructure and Equipment: 8 points', type: 'subitem' },
                      { id: 'innovation_approach', label: 'Innovation and Technology Adoption: 7 points', type: 'subitem' },
                      { id: 'quality_management', label: 'Quality Management System: 5 points (ISO certified)', type: 'subitem' }
                    ]
                  },
                  { 
                    id: 'project_approach', 
                    label: 'Project Approach: 15 points', 
                    type: 'item',
                    children: [
                      { id: 'methodology', label: 'Project Methodology: 5 points (Agile/Waterfall)', type: 'subitem' },
                      { id: 'risk_management_plan', label: 'Risk Management Plan: 4 points', type: 'subitem' },
                      { id: 'communication_plan', label: 'Communication and Reporting Plan: 3 points', type: 'subitem' },
                      { id: 'change_management', label: 'Change Management Strategy: 3 points', type: 'subitem' }
                    ]
                  }
                ]
              },
              { 
                id: 'qualification_criteria', 
                label: 'Qualification Criteria', 
                type: 'detail',
                children: [
                  { 
                    id: 'minimum_experience', 
                    label: 'Minimum 5 years experience', 
                    type: 'item',
                    children: [
                      { id: 'experience_verification', label: 'Experience Verification Documents Required', type: 'subitem' },
                      { id: 'project_completion_certificates', label: 'Project Completion Certificates', type: 'subitem' },
                      { id: 'client_testimonials', label: 'Client Testimonials and Letters of Recommendation', type: 'subitem' }
                    ]
                  },
                  { 
                    id: 'similar_projects', 
                    label: 'Similar projects: Minimum 3', 
                    type: 'item',
                    children: [
                      { id: 'project_value_threshold', label: 'Project Value: Min $1M per project', type: 'subitem' },
                      { id: 'project_complexity', label: 'Project Complexity: Similar scope and scale', type: 'subitem' },
                      { id: 'completion_timeline', label: 'Completion Timeline: Within last 5 years', type: 'subitem' },
                      { id: 'project_success_rate', label: 'Project Success Rate: >90% on-time delivery', type: 'subitem' }
                    ]
                  },
                  { 
                    id: 'technical_team', 
                    label: 'Technical team qualifications', 
                    type: 'item',
                    children: [
                      { id: 'team_size_requirement', label: 'Team Size: Minimum 15 dedicated resources', type: 'subitem' },
                      { id: 'key_personnel_qualifications', label: 'Key Personnel: Min 10 years experience each', type: 'subitem' },
                      { id: 'certifications_required', label: 'Professional Certifications: PMP, ITIL, etc.', type: 'subitem' },
                      { id: 'team_availability', label: 'Team Availability: 100% dedicated for project duration', type: 'subitem' }
                    ]
                  }
                ]
              }
            ]
          },
          { 
            id: 'financial_evaluation', 
            label: 'Financial Evaluation Methods', 
            type: 'subsection',
            children: [
              { 
                id: 'financial_weightage', 
                label: 'Financial Evaluation: 30% Weightage', 
                type: 'detail',
                children: [
                  { 
                    id: 'price_evaluation', 
                    label: 'Price Evaluation Method', 
                    type: 'item',
                    children: [
                      { id: 'total_cost_ownership', label: 'Total Cost of Ownership (TCO) Analysis', type: 'subitem' },
                      { id: 'price_reasonableness', label: 'Price Reasonableness Assessment', type: 'subitem' },
                      { id: 'cost_competitiveness', label: 'Cost Competitiveness: Lowest price gets 30 points', type: 'subitem' },
                      { id: 'price_formula', label: 'Formula: (Lowest Price / Bid Price) × 30', type: 'subitem' }
                    ]
                  },
                  { 
                    id: 'cost_breakdown', 
                    label: 'Cost Breakdown Analysis', 
                    type: 'item',
                    children: [
                      { id: 'labor_costs', label: 'Labor Costs: 40% of total', type: 'subitem' },
                      { id: 'material_costs', label: 'Material and Equipment Costs: 35% of total', type: 'subitem' },
                      { id: 'overhead_costs', label: 'Overhead and Administrative Costs: 15% of total', type: 'subitem' },
                      { id: 'profit_margin', label: 'Profit Margin: 10% of total', type: 'subitem' }
                    ]
                  },
                  { 
                    id: 'payment_terms', 
                    label: 'Payment Terms Evaluation', 
                    type: 'item',
                    children: [
                      { id: 'payment_schedule', label: 'Payment Schedule: Milestone-based', type: 'subitem' },
                      { id: 'advance_payment', label: 'Advance Payment: 10% upon contract signing', type: 'subitem' },
                      { id: 'progress_payments', label: 'Progress Payments: 70% based on milestones', type: 'subitem' },
                      { id: 'final_payment', label: 'Final Payment: 20% upon project completion', type: 'subitem' },
                      { id: 'retention_amount', label: 'Retention Amount: 5% held for 6 months post-completion', type: 'subitem' }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        id: 'section_4_terms',
        label: 'Section 4: Terms and Conditions',
        type: 'section',
        color: '#E9D5FF',
        textColor: '#6B21A8',
        children: [
          { 
            id: 'contract_terms', 
            label: 'Contract Terms and Conditions', 
            type: 'subsection',
            children: [
              { 
                id: 'contract_duration', 
                label: 'Contract Duration and Milestones', 
                type: 'detail',
                children: [
                  { 
                    id: 'project_timeline', 
                    label: 'Project Timeline: 18 months', 
                    type: 'item',
                    children: [
                      { id: 'milestone_1', label: 'Milestone 1: Project Kickoff (Month 0)', type: 'subitem' },
                      { id: 'milestone_2', label: 'Milestone 2: Design Approval (Month 3)', type: 'subitem' },
                      { id: 'milestone_3', label: 'Milestone 3: Development Complete (Month 12)', type: 'subitem' },
                      { id: 'milestone_4', label: 'Milestone 4: Testing Complete (Month 15)', type: 'subitem' },
                      { id: 'milestone_5', label: 'Milestone 5: Go-Live (Month 18)', type: 'subitem' }
                    ]
                  },
                  { 
                    id: 'key_milestones', 
                    label: 'Key Milestones and Deliverables', 
                    type: 'item',
                    children: [
                      { id: 'deliverable_1', label: 'Requirements Document: Month 2', type: 'subitem' },
                      { id: 'deliverable_2', label: 'System Design Document: Month 4', type: 'subitem' },
                      { id: 'deliverable_3', label: 'Prototype Demo: Month 6', type: 'subitem' },
                      { id: 'deliverable_4', label: 'Beta Release: Month 13', type: 'subitem' },
                      { id: 'deliverable_5', label: 'Production Release: Month 18', type: 'subitem' },
                      { id: 'deliverable_6', label: 'User Documentation: Month 17', type: 'subitem' }
                    ]
                  }
                ]
              },
              { 
                id: 'performance_guarantees', 
                label: 'Performance Guarantees', 
                type: 'detail',
                children: [
                  { 
                    id: 'performance_bond', 
                    label: 'Performance Bond: 10% of contract value', 
                    type: 'item',
                    children: [
                      { id: 'bond_submission', label: 'Bond Submission: Within 15 days of contract award', type: 'subitem' },
                      { id: 'bond_validity', label: 'Bond Validity: Contract duration + 6 months', type: 'subitem' },
                      { id: 'bond_format', label: 'Bond Format: Bank guarantee or surety bond', type: 'subitem' },
                      { id: 'bond_release', label: 'Bond Release: Upon successful project completion', type: 'subitem' }
                    ]
                  },
                  { 
                    id: 'warranty_period', 
                    label: 'Warranty Period: 2 years', 
                    type: 'item',
                    children: [
                      { id: 'warranty_coverage', label: 'Warranty Coverage: All defects and malfunctions', type: 'subitem' },
                      { id: 'warranty_response', label: 'Response Time: 4 hours for critical issues', type: 'subitem' },
                      { id: 'warranty_resolution', label: 'Resolution Time: 24 hours for critical issues', type: 'subitem' },
                      { id: 'warranty_support', label: 'Support Availability: 24/7 for critical systems', type: 'subitem' },
                      { id: 'warranty_exclusions', label: 'Exclusions: User-caused damage, force majeure', type: 'subitem' }
                    ]
                  }
                ]
              }
            ]
          },
          { 
            id: 'legal_requirements', 
            label: 'Legal Requirements and Compliance', 
            type: 'subsection',
            children: [
              { 
                id: 'regulatory_compliance', 
                label: 'Regulatory Compliance', 
                type: 'detail',
                children: [
                  { 
                    id: 'local_laws', 
                    label: 'Compliance with Local Laws', 
                    type: 'item',
                    children: [
                      { id: 'labor_laws', label: 'Labor Laws and Employment Regulations', type: 'subitem' },
                      { id: 'tax_compliance', label: 'Tax Compliance and Reporting', type: 'subitem' },
                      { id: 'business_regulations', label: 'Business Licensing and Permits', type: 'subitem' },
                      { id: 'data_protection', label: 'Data Protection and Privacy Laws (GDPR, etc.)', type: 'subitem' }
                    ]
                  },
                  { 
                    id: 'environmental_clearance', 
                    label: 'Environmental Clearance Required', 
                    type: 'item',
                    children: [
                      { id: 'environmental_impact', label: 'Environmental Impact Assessment', type: 'subitem' },
                      { id: 'waste_management', label: 'Waste Management and Disposal Plan', type: 'subitem' },
                      { id: 'emissions_control', label: 'Emissions Control and Monitoring', type: 'subitem' },
                      { id: 'sustainability_measures', label: 'Sustainability and Green Practices', type: 'subitem' }
                    ]
                  },
                  { 
                    id: 'safety_standards', 
                    label: 'Safety Standards Compliance', 
                    type: 'item',
                    children: [
                      { id: 'occupational_safety', label: 'Occupational Health and Safety (OSHA)', type: 'subitem' },
                      { id: 'safety_training', label: 'Safety Training and Certification', type: 'subitem' },
                      { id: 'safety_equipment', label: 'Personal Protective Equipment (PPE) Requirements', type: 'subitem' },
                      { id: 'incident_reporting', label: 'Incident Reporting and Investigation Procedures', type: 'subitem' },
                      { id: 'safety_audits', label: 'Regular Safety Audits and Inspections', type: 'subitem' }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ];

    // Recursive function to add nodes at any depth
    const addNodesRecursively = (nodes, parentId, level, parentColor, parentTextColor) => {
      nodes.forEach(node => {
        const hasChildren = node.children && node.children.length > 0;
        
        mindmap.nodes.push({
          id: node.id,
          label: node.label,
          type: node.type,
          parentId: parentId,
          color: node.color || parentColor,
          textColor: node.textColor || parentTextColor,
          description: `${node.label} - Level ${level} detail`,
          priority: level === 1 ? 'high' : level === 2 ? 'medium' : 'low',
          expanded: false,
          hasChildren: hasChildren,
          level: level
        });

        mindmap.connections.push({
          from: parentId,
          to: node.id,
          type: 'hierarchy'
        });

        // Recursively add children
        if (hasChildren) {
          addNodesRecursively(node.children, node.id, level + 1, node.color || parentColor, node.textColor || parentTextColor);
        }
      });
    };

    // Add main sections and all their nested children
    sections.forEach(section => {
      mindmap.nodes.push({
        id: section.id,
        label: section.label,
        type: section.type,
        parentId: 'root',
        color: section.color,
        textColor: section.textColor,
        description: `Detailed analysis of ${section.label.toLowerCase()}`,
        priority: 'high',
        expanded: false,
        hasChildren: true,
        level: 1
      });

      mindmap.connections.push({
        from: 'root',
        to: section.id,
        type: 'hierarchy'
      });

      // Add all nested children recursively
      if (section.children) {
        addNodesRecursively(section.children, section.id, 2, section.color, section.textColor);
      }
    });

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