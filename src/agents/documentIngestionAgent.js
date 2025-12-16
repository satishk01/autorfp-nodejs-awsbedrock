const { BaseAgent } = require('./baseAgent');
const documentProcessor = require('../services/documentProcessor');
const logger = require('../utils/logger');

class DocumentIngestionAgent extends BaseAgent {
  constructor() {
    super('DocumentIngestionAgent', `
You are a Document Ingestion Agent specialized in analyzing RFP (Request for Proposal) documents.

Your responsibilities:
1. Extract and identify RFP requirements, questions, and specifications
2. Categorize content by type (technical, business, compliance, timeline, budget)
3. Identify key sections and structure
4. Flag important deadlines and submission requirements
5. Extract contact information and submission details

Return your analysis in the following JSON format:
{
  "documentType": "rfp|supporting|other",
  "title": "extracted document title",
  "overview": "brief summary of the document",
  "keyRequirements": ["requirement1", "requirement2"],
  "questions": ["question1", "question2"],
  "deadlines": ["deadline1", "deadline2"],
  "technicalSpecs": ["spec1", "spec2"],
  "businessRequirements": ["req1", "req2"],
  "complianceRequirements": ["comp1", "comp2"],
  "budgetInfo": "budget information if found",
  "contactInfo": "contact details",
  "submissionRequirements": ["req1", "req2"],
  "evaluationCriteria": ["criteria1", "criteria2"],
  "confidence": 0.95
}
`);
  }

  async processDocuments(documents, workflowId = null) {
    const results = [];
    
    for (const doc of documents) {
      try {
        logger.info(`Processing document: ${doc.originalName}`);
        
        // Process the document content
        const processedDoc = await documentProcessor.processDocument(
          doc.path, 
          doc.originalName,
          workflowId
        );
        
        // Analyze with AI
        const analysis = await this.execute(processedDoc.content, {
          metadata: processedDoc.metadata,
          structuredData: processedDoc.structuredData
        });
        
        results.push({
          ...analysis,
          documentId: doc.id,
          fileName: doc.originalName,
          processedContent: processedDoc.content,
          metadata: processedDoc.metadata,
          structuredData: processedDoc.structuredData
        });
        
      } catch (error) {
        logger.error(`Error processing document ${doc.originalName}:`, error);
        results.push({
          documentId: doc.id,
          fileName: doc.originalName,
          error: error.message,
          processed: false
        });
      }
    }
    
    return results;
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
      
      // Validate required fields
      const requiredFields = ['documentType', 'overview', 'confidence'];
      const missingFields = requiredFields.filter(field => !parsed[field]);
      
      if (missingFields.length > 0) {
        logger.warn(`Missing required fields: ${missingFields.join(', ')}`);
      }
      
      // Ensure arrays are properly formatted
      const arrayFields = [
        'keyRequirements', 'questions', 'deadlines', 'technicalSpecs',
        'businessRequirements', 'complianceRequirements', 'submissionRequirements',
        'evaluationCriteria'
      ];
      
      arrayFields.forEach(field => {
        if (parsed[field] && !Array.isArray(parsed[field])) {
          parsed[field] = [parsed[field]];
        } else if (!parsed[field]) {
          parsed[field] = [];
        }
      });
      
      // Add processing metadata
      parsed.processedAt = new Date().toISOString();
      parsed.agent = this.name;
      
      return parsed;
    } catch (error) {
      logger.error('Error parsing document ingestion result:', error);
      logger.debug('Raw result:', result.substring(0, 500));
      
      // Fallback: extract basic information from text
      return this.extractBasicInfo(result, context);
    }
  }

  extractBasicInfo(text, context) {
    // Fallback extraction when JSON parsing fails
    const lines = text.split('\n').filter(line => line.trim());
    
    return {
      documentType: 'unknown',
      title: context.metadata?.fileName || 'Unknown Document',
      overview: lines.slice(0, 3).join(' '),
      keyRequirements: this.extractPatterns(text, /requirement[s]?[:\s]([^\n]+)/gi),
      questions: this.extractPatterns(text, /question[s]?[:\s]([^\n]+)/gi),
      deadlines: this.extractPatterns(text, /deadline[s]?[:\s]([^\n]+)/gi),
      technicalSpecs: [],
      businessRequirements: [],
      complianceRequirements: [],
      budgetInfo: this.extractPatterns(text, /budget[:\s]([^\n]+)/gi)[0] || '',
      contactInfo: this.extractPatterns(text, /contact[:\s]([^\n]+)/gi)[0] || '',
      submissionRequirements: [],
      evaluationCriteria: [],
      confidence: 0.5,
      processedAt: new Date().toISOString(),
      agent: this.name,
      fallbackExtraction: true
    };
  }

  extractPatterns(text, pattern) {
    const matches = [...text.matchAll(pattern)];
    return matches.map(match => match[1]?.trim()).filter(Boolean);
  }

  validateDocumentSet(documents) {
    const validation = {
      valid: true,
      errors: [],
      warnings: []
    };

    if (!documents || documents.length === 0) {
      validation.valid = false;
      validation.errors.push('No documents provided');
      return validation;
    }

    // Check for potential RFP document
    const hasRFPDocument = documents.some(doc => 
      doc.originalName.toLowerCase().includes('rfp') ||
      doc.originalName.toLowerCase().includes('request') ||
      doc.originalName.toLowerCase().includes('proposal')
    );

    if (!hasRFPDocument) {
      validation.warnings.push('No obvious RFP document detected in file names');
    }

    // Check file sizes
    const largeDocs = documents.filter(doc => doc.size > 10 * 1024 * 1024); // 10MB
    if (largeDocs.length > 0) {
      validation.warnings.push(`Large documents detected: ${largeDocs.map(d => d.originalName).join(', ')}`);
    }

    return validation;
  }
}

module.exports = new DocumentIngestionAgent();