const { BaseAgent } = require('./baseAgent');
const logger = require('../utils/logger');

class RequirementsAnalysisAgent extends BaseAgent {
  constructor() {
    super('RequirementsAnalysisAgent', `
You are a Requirements Analysis Agent specialized in analyzing RFP requirements and generating comprehensive overviews.

Your responsibilities:
1. Analyze all ingested RFP documents to identify key requirements
2. Categorize requirements by type and priority
3. Generate comprehensive project overview
4. Identify evaluation criteria and success metrics
5. Assess project complexity and risk factors

Analyze the provided RFP data and return a JSON response with this structure:
{
  "projectOverview": {
    "title": "project title",
    "description": "comprehensive project description",
    "scope": "project scope summary",
    "objectives": ["objective1", "objective2"]
  },
  "requirements": {
    "technical": [
      {
        "id": "tech_001",
        "description": "requirement description",
        "priority": "high|medium|low",
        "complexity": "high|medium|low",
        "category": "infrastructure|development|integration|security"
      }
    ],
    "business": [
      {
        "id": "bus_001", 
        "description": "business requirement",
        "priority": "high|medium|low",
        "impact": "high|medium|low"
      }
    ],
    "compliance": [
      {
        "id": "comp_001",
        "description": "compliance requirement", 
        "mandatory": true,
        "standard": "regulation or standard name"
      }
    ]
  },
  "timeline": {
    "projectDuration": "estimated duration",
    "keyMilestones": [
      {
        "name": "milestone name",
        "deadline": "date or timeframe",
        "deliverables": ["deliverable1", "deliverable2"]
      }
    ],
    "criticalPath": ["milestone1", "milestone2"]
  },
  "budget": {
    "estimatedRange": "budget range if mentioned",
    "costFactors": ["factor1", "factor2"],
    "budgetConstraints": "any budget limitations"
  },
  "riskAssessment": {
    "overallComplexity": "high|medium|low",
    "technicalRisks": ["risk1", "risk2"],
    "businessRisks": ["risk1", "risk2"],
    "mitigationStrategies": ["strategy1", "strategy2"]
  },
  "evaluationCriteria": [
    {
      "criterion": "evaluation criterion",
      "weight": "percentage or importance",
      "description": "what will be evaluated"
    }
  ],
  "recommendations": {
    "approachSuggestions": ["suggestion1", "suggestion2"],
    "focusAreas": ["area1", "area2"],
    "successFactors": ["factor1", "factor2"]
  },
  "confidence": 0.95
}
`);
  }

  async analyzeRequirements(ingestedDocuments) {
    try {
      logger.info('Starting requirements analysis', { 
        documentCount: ingestedDocuments.length 
      });

      // Combine all document content and analysis
      const combinedInput = this.combineDocumentData(ingestedDocuments);
      
      // Execute analysis
      const analysis = await this.execute(combinedInput, {
        documentCount: ingestedDocuments.length,
        documentTypes: ingestedDocuments.map(d => d.documentType)
      });

      // Enhance analysis with cross-document insights
      const enhancedAnalysis = await this.enhanceAnalysis(analysis, ingestedDocuments);

      logger.info('Requirements analysis completed', {
        requirementsCount: this.countRequirements(enhancedAnalysis),
        complexity: enhancedAnalysis.riskAssessment?.overallComplexity
      });

      return enhancedAnalysis;
    } catch (error) {
      logger.error('Error in requirements analysis:', error);
      throw error;
    }
  }

  combineDocumentData(documents) {
    let combinedData = "=== RFP DOCUMENTS ANALYSIS ===\n\n";
    
    documents.forEach((doc, index) => {
      combinedData += `--- Document ${index + 1}: ${doc.fileName} ---\n`;
      combinedData += `Type: ${doc.documentType}\n`;
      combinedData += `Overview: ${doc.overview}\n\n`;
      
      if (doc.keyRequirements?.length > 0) {
        combinedData += "Key Requirements:\n";
        doc.keyRequirements.forEach(req => combinedData += `- ${req}\n`);
        combinedData += "\n";
      }
      
      if (doc.technicalSpecs?.length > 0) {
        combinedData += "Technical Specifications:\n";
        doc.technicalSpecs.forEach(spec => combinedData += `- ${spec}\n`);
        combinedData += "\n";
      }
      
      if (doc.businessRequirements?.length > 0) {
        combinedData += "Business Requirements:\n";
        doc.businessRequirements.forEach(req => combinedData += `- ${req}\n`);
        combinedData += "\n";
      }
      
      if (doc.deadlines?.length > 0) {
        combinedData += "Deadlines:\n";
        doc.deadlines.forEach(deadline => combinedData += `- ${deadline}\n`);
        combinedData += "\n";
      }
      
      if (doc.evaluationCriteria?.length > 0) {
        combinedData += "Evaluation Criteria:\n";
        doc.evaluationCriteria.forEach(criteria => combinedData += `- ${criteria}\n`);
        combinedData += "\n";
      }
      
      combinedData += "---\n\n";
    });
    
    return combinedData;
  }

  async enhanceAnalysis(analysis, documents) {
    // Add cross-document insights
    const enhancement = {
      ...analysis,
      documentInsights: {
        totalDocuments: documents.length,
        documentTypes: this.categorizeDocuments(documents),
        consistencyCheck: this.checkConsistency(documents),
        completenessScore: this.assessCompleteness(documents)
      }
    };

    // Prioritize requirements based on frequency across documents
    if (enhancement.requirements) {
      enhancement.requirements = this.prioritizeRequirements(
        enhancement.requirements, 
        documents
      );
    }

    return enhancement;
  }

  categorizeDocuments(documents) {
    const categories = {};
    documents.forEach(doc => {
      const type = doc.documentType || 'unknown';
      categories[type] = (categories[type] || 0) + 1;
    });
    return categories;
  }

  checkConsistency(documents) {
    // Check for conflicting information across documents
    const allDeadlines = documents.flatMap(d => d.deadlines || []);
    const allBudgetInfo = documents.map(d => d.budgetInfo).filter(Boolean);
    
    return {
      deadlineConsistency: this.checkDeadlineConsistency(allDeadlines),
      budgetConsistency: allBudgetInfo.length <= 1, // Simple check
      requirementOverlap: this.calculateRequirementOverlap(documents)
    };
  }

  checkDeadlineConsistency(deadlines) {
    // Simple consistency check - could be enhanced with date parsing
    const uniqueDeadlines = [...new Set(deadlines)];
    return uniqueDeadlines.length <= 2; // Allow for some variation
  }

  calculateRequirementOverlap(documents) {
    const allRequirements = documents.flatMap(d => d.keyRequirements || []);
    const uniqueRequirements = [...new Set(allRequirements)];
    
    return allRequirements.length > 0 ? 
      uniqueRequirements.length / allRequirements.length : 1;
  }

  assessCompleteness(documents) {
    const expectedSections = [
      'keyRequirements', 'technicalSpecs', 'businessRequirements',
      'deadlines', 'evaluationCriteria', 'budgetInfo'
    ];
    
    let totalSections = 0;
    let foundSections = 0;
    
    documents.forEach(doc => {
      expectedSections.forEach(section => {
        totalSections++;
        if (doc[section] && (Array.isArray(doc[section]) ? 
          doc[section].length > 0 : doc[section].trim().length > 0)) {
          foundSections++;
        }
      });
    });
    
    return totalSections > 0 ? foundSections / totalSections : 0;
  }

  prioritizeRequirements(requirements, documents) {
    // Enhance priority based on frequency and context
    const enhancedRequirements = { ...requirements };
    
    ['technical', 'business', 'compliance'].forEach(category => {
      if (enhancedRequirements[category]) {
        enhancedRequirements[category] = enhancedRequirements[category].map(req => ({
          ...req,
          frequency: this.calculateRequirementFrequency(req.description, documents),
          sources: this.findRequirementSources(req.description, documents)
        }));
      }
    });
    
    return enhancedRequirements;
  }

  calculateRequirementFrequency(requirement, documents) {
    let frequency = 0;
    const reqLower = requirement.toLowerCase();
    
    documents.forEach(doc => {
      const allReqs = [
        ...(doc.keyRequirements || []),
        ...(doc.technicalSpecs || []),
        ...(doc.businessRequirements || [])
      ];
      
      allReqs.forEach(docReq => {
        if (docReq.toLowerCase().includes(reqLower) || 
            reqLower.includes(docReq.toLowerCase())) {
          frequency++;
        }
      });
    });
    
    return frequency;
  }

  findRequirementSources(requirement, documents) {
    const sources = [];
    const reqLower = requirement.toLowerCase();
    
    documents.forEach(doc => {
      const allReqs = [
        ...(doc.keyRequirements || []),
        ...(doc.technicalSpecs || []),
        ...(doc.businessRequirements || [])
      ];
      
      const hasRequirement = allReqs.some(docReq => 
        docReq.toLowerCase().includes(reqLower) || 
        reqLower.includes(docReq.toLowerCase())
      );
      
      if (hasRequirement) {
        sources.push(doc.fileName);
      }
    });
    
    return sources;
  }

  countRequirements(analysis) {
    let count = 0;
    if (analysis.requirements) {
      count += (analysis.requirements.technical || []).length;
      count += (analysis.requirements.business || []).length;
      count += (analysis.requirements.compliance || []).length;
    }
    return count;
  }

  async processResult(result, context) {
    try {
      // Try to extract JSON from the result if it's wrapped in text
      let jsonStr = result;
      
      // Look for JSON block in the response
      const jsonMatch = result.match(/```json\s*([\s\S]*?)\s*```/) || 
                       result.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        jsonStr = jsonMatch[1] || jsonMatch[0];
      }
      
      const parsed = JSON.parse(jsonStr);
      
      // Validate and ensure required structure
      if (!parsed.requirements) {
        parsed.requirements = {
          technical: [],
          business: [],
          compliance: []
        };
      }
      
      // Ensure arrays for each category
      ['technical', 'business', 'compliance'].forEach(category => {
        if (!Array.isArray(parsed.requirements[category])) {
          parsed.requirements[category] = [];
        }
      });
      
      // Add processing metadata
      parsed.processedAt = new Date().toISOString();
      parsed.agent = this.name;
      
      return parsed;
    } catch (error) {
      logger.error('Error parsing requirements analysis result:', error);
      logger.debug('Raw result:', result.substring(0, 500));
      
      // Fallback: create basic structure
      return {
        projectOverview: {
          title: 'Unable to parse project title',
          description: 'Requirements analysis parsing failed',
          scope: 'Unknown scope',
          objectives: []
        },
        requirements: {
          technical: [],
          business: [],
          compliance: []
        },
        timeline: {
          projectDuration: 'Not specified',
          keyMilestones: [],
          criticalDeadlines: []
        },
        budget: {
          estimatedRange: 'Not specified',
          budgetConstraints: [],
          costFactors: []
        },
        evaluationCriteria: [],
        riskAssessment: {
          identifiedRisks: ['Requirements parsing failed'],
          riskMitigation: []
        },
        confidence: 0.1,
        processedAt: new Date().toISOString(),
        agent: this.name,
        fallbackExtraction: true,
        error: error.message
      };
    }
  }
}

module.exports = new RequirementsAnalysisAgent();