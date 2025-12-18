const { BaseAgent } = require('./baseAgent');
const logger = require('../utils/logger');
const ragService = require('../services/ragService');

class AnswerExtractionAgent extends BaseAgent {
  constructor() {
    super('AnswerExtractionAgent', `
You are an Answer Extraction Agent specialized in finding relevant answers to RFP questions from company documents.

Your responsibilities:
1. Search through company documents for relevant answers to RFP questions
2. Use semantic matching to find related information
3. Provide confidence scores for each answer
4. Cross-reference information across multiple documents
5. Flag questions that cannot be answered with available data

Analyze the provided RFP questions and company documents, then return answers in this JSON format:
{
  "answeredQuestions": [
    {
      "questionId": "original question ID",
      "question": "the original question text",
      "answer": "comprehensive answer based on available documents",
      "confidence": 0.85,
      "sources": [
        {
          "documentName": "source document name",
          "section": "relevant section",
          "excerpt": "relevant text excerpt",
          "relevanceScore": 0.90
        }
      ],
      "answerType": "direct|inferred|partial",
      "completeness": "complete|partial|incomplete",
      "additionalContext": "any additional relevant context"
    }
  ],
  "unansweredQuestions": [
    {
      "questionId": "question ID",
      "question": "question text",
      "reason": "why it couldn't be answered",
      "suggestedSources": ["what documents might contain the answer"],
      "priority": "high|medium|low"
    }
  ],
  "partialAnswers": [
    {
      "questionId": "question ID", 
      "question": "question text",
      "partialAnswer": "what we know so far",
      "missingInformation": ["what information is still needed"],
      "confidence": 0.45,
      "sources": []
    }
  ],
  "crossReferences": [
    {
      "questionIds": ["q1", "q2"],
      "relationship": "related|conflicting|complementary",
      "explanation": "how the questions relate"
    }
  ],
  "answerSummary": {
    "totalQuestions": 25,
    "answered": 18,
    "partiallyAnswered": 4,
    "unanswered": 3,
    "averageConfidence": 0.78,
    "coverageByCategory": {
      "technical": 0.85,
      "business": 0.70,
      "compliance": 0.60
    }
  },
  "recommendations": {
    "priorityGaps": ["gap 1", "gap 2"],
    "documentNeeds": ["needed document type 1"],
    "expertConsultation": ["area requiring SME input"]
  },
  "confidence": 0.82
}
`);
  }

  async extractAnswers(rfpQuestions, companyDocuments, requirementsAnalysis, workflowId = null) {
    try {
      // Ensure companyDocuments is an array
      if (!Array.isArray(companyDocuments)) {
        logger.warn('companyDocuments is not an array, converting:', typeof companyDocuments);
        companyDocuments = [];
      }

      logger.info('Starting RAG-based answer extraction', {
        questionsCount: this.countTotalQuestions(rfpQuestions),
        documentsCount: companyDocuments.length
      });

      // Use RAG service to answer questions
      const ragAnswers = await this.extractAnswersWithRAG(rfpQuestions, workflowId);

      // Fallback to traditional method if RAG fails
      let answers;
      if (ragAnswers && ragAnswers.answeredQuestions && ragAnswers.answeredQuestions.length > 0) {
        answers = ragAnswers;
        logger.info('Using RAG-based answers');
      } else {
        logger.warn('RAG service failed or returned no answers, falling back to traditional method');
        const input = this.prepareExtractionInput(rfpQuestions, companyDocuments, requirementsAnalysis);
        answers = await this.execute(input, {
          extractionType: 'rfp_answers',
          questionCount: this.countTotalQuestions(rfpQuestions),
          documentCount: companyDocuments.length
        });
      }

      // Enhance answers with semantic analysis
      const enhancedAnswers = await this.enhanceAnswers(
        answers, 
        rfpQuestions, 
        companyDocuments
      );

      logger.info('Answer extraction completed', {
        answered: enhancedAnswers.answerSummary?.answered || 0,
        unanswered: enhancedAnswers.answerSummary?.unanswered || 0,
        avgConfidence: enhancedAnswers.answerSummary?.averageConfidence || 0
      });

      return enhancedAnswers;
    } catch (error) {
      logger.error('Error in answer extraction:', error);
      throw error;
    }
  }

  async extractAnswersWithRAG(rfpQuestions, workflowId = null) {
    try {
      const allQuestions = this.flattenQuestions(rfpQuestions);
      const answeredQuestions = [];
      const unansweredQuestions = [];

      logger.info(`Processing ${allQuestions.length} questions with RAG`);

      for (const question of allQuestions) {
        try {
          const result = await ragService.answerQuestion(question.questionText || question.question, workflowId);
          
          if (result.confidence > 0.3) { // Minimum confidence threshold
            answeredQuestions.push({
              questionId: question.id,
              question: question.questionText || question.question,
              answer: result.answer,
              confidence: result.confidence,
              sources: result.sources.map(source => ({
                documentName: source.documentId,
                excerpt: source.content,
                relevanceScore: source.similarity
              })),
              answerType: result.confidence > 0.8 ? 'direct' : 'inferred',
              completeness: result.confidence > 0.7 ? 'complete' : 'partial'
            });
          } else {
            unansweredQuestions.push({
              questionId: question.id,
              question: question.questionText || question.question,
              reason: result.confidence === 0 ? 'No relevant information found' : 'Low confidence answer',
              priority: question.priority || 'medium'
            });
          }
        } catch (error) {
          logger.error(`Error answering question ${question.id}`, { error: error.message });
          unansweredQuestions.push({
            questionId: question.id,
            question: question.questionText || question.question,
            reason: 'Error processing question',
            priority: question.priority || 'medium'
          });
        }
      }

      const answerSummary = {
        totalQuestions: allQuestions.length,
        answered: answeredQuestions.length,
        partiallyAnswered: 0,
        unanswered: unansweredQuestions.length,
        averageConfidence: answeredQuestions.length > 0 ? 
          answeredQuestions.reduce((sum, q) => sum + q.confidence, 0) / answeredQuestions.length : 0
      };

      return {
        answeredQuestions,
        unansweredQuestions,
        partialAnswers: [],
        answerSummary,
        confidence: answerSummary.averageConfidence
      };
    } catch (error) {
      logger.error('Error in RAG-based answer extraction', { error: error.message });
      return null;
    }
  }

  prepareExtractionInput(rfpQuestions, companyDocuments, requirementsAnalysis) {
    let input = "=== RFP ANSWER EXTRACTION ===\n\n";
    
    // Add context from requirements analysis
    if (requirementsAnalysis?.projectOverview) {
      input += "PROJECT CONTEXT:\n";
      input += `Title: ${requirementsAnalysis.projectOverview.title}\n`;
      input += `Description: ${requirementsAnalysis.projectOverview.description}\n\n`;
    }

    // Add RFP questions to answer
    input += "QUESTIONS TO ANSWER:\n";
    this.flattenQuestions(rfpQuestions).forEach((question, index) => {
      input += `${index + 1}. [${question.id}] ${question.question}\n`;
      input += `   Category: ${question.category}\n`;
      input += `   Priority: ${question.priority}\n`;
      if (question.relatedRequirements?.length > 0) {
        input += `   Related Requirements: ${question.relatedRequirements.join(', ')}\n`;
      }
      input += "\n";
    });

    // Add company documents content
    input += "COMPANY DOCUMENTS TO SEARCH:\n";
    companyDocuments.forEach((doc, index) => {
      input += `--- Document ${index + 1}: ${doc.fileName || doc.name} ---\n`;
      input += `Type: ${doc.documentType || 'Unknown'}\n`;
      
      if (doc.overview) {
        input += `Overview: ${doc.overview}\n`;
      }
      
      // Include relevant content sections with intelligent truncation
      if (doc.processedContent) {
        const content = this.intelligentContentTruncation(doc.processedContent, questions);
        input += `Content:\n${content}\n`;
      }
      
      // Include structured data if available
      if (doc.structuredData) {
        input += "Key Information:\n";
        Object.entries(doc.structuredData).forEach(([key, value]) => {
          if (Array.isArray(value) && value.length > 0) {
            input += `${key}: ${value.slice(0, 3).join(', ')}${value.length > 3 ? '...' : ''}\n`;
          } else if (typeof value === 'string' && value.trim()) {
            input += `${key}: ${value.substring(0, 200)}${value.length > 200 ? '...' : ''}\n`;
          }
        });
      }
      
      input += "---\n\n";
    });

    return input;
  }

  flattenQuestions(rfpQuestions) {
    const allQuestions = [];
    
    Object.entries(rfpQuestions.questionCategories || {}).forEach(([category, questions]) => {
      questions.forEach(question => {
        allQuestions.push({
          ...question,
          category
        });
      });
    });

    return allQuestions;
  }

  async enhanceAnswers(answers, rfpQuestions, companyDocuments) {
    // Enhance with semantic similarity analysis
    const enhanced = {
      ...answers,
      semanticAnalysis: await this.performSemanticAnalysis(answers, companyDocuments),
      gapAnalysis: this.performGapAnalysis(answers, rfpQuestions),
      qualityMetrics: this.calculateQualityMetrics(answers)
    };

    // Add document utilization analysis
    enhanced.documentUtilization = this.analyzeDocumentUtilization(answers, companyDocuments);

    return enhanced;
  }

  async performSemanticAnalysis(answers, documents) {
    // Simplified semantic analysis - in production, you'd use embeddings
    const analysis = {
      keywordMatches: {},
      conceptCoverage: {},
      documentRelevance: {}
    };

    // Analyze keyword frequency in answers vs documents
    const answerText = answers.answeredQuestions?.map(a => a.answer).join(' ') || '';
    const documentText = documents.map(d => d.processedContent || '').join(' ');

    // Extract key terms (simplified approach)
    const keyTerms = this.extractKeyTerms(answerText);
    
    keyTerms.forEach(term => {
      const answerFreq = (answerText.match(new RegExp(term, 'gi')) || []).length;
      const docFreq = (documentText.match(new RegExp(term, 'gi')) || []).length;
      
      analysis.keywordMatches[term] = {
        answerFrequency: answerFreq,
        documentFrequency: docFreq,
        relevanceScore: docFreq > 0 ? answerFreq / docFreq : 0
      };
    });

    return analysis;
  }

  extractKeyTerms(text) {
    // Simple keyword extraction - in production, use NLP libraries
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    const frequency = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    // Return top 20 most frequent terms
    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([word]) => word);
  }

  performGapAnalysis(answers, rfpQuestions) {
    const totalQuestions = this.countTotalQuestions(rfpQuestions);
    const answeredCount = answers.answeredQuestions?.length || 0;
    const partialCount = answers.partialAnswers?.length || 0;
    const unansweredCount = answers.unansweredQuestions?.length || 0;

    const gapsByCategory = {};
    
    // Analyze gaps by category
    Object.entries(rfpQuestions.questionCategories || {}).forEach(([category, questions]) => {
      const categoryAnswered = answers.answeredQuestions?.filter(a => 
        questions.some(q => q.id === a.questionId)
      ).length || 0;
      
      gapsByCategory[category] = {
        total: questions.length,
        answered: categoryAnswered,
        gapPercentage: questions.length > 0 ? 
          ((questions.length - categoryAnswered) / questions.length) * 100 : 0
      };
    });

    return {
      overallCoverage: totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0,
      gapsByCategory,
      criticalGaps: this.identifyCriticalGaps(answers, rfpQuestions),
      improvementAreas: this.suggestImprovements(gapsByCategory)
    };
  }

  identifyCriticalGaps(answers, rfpQuestions) {
    const criticalGaps = [];
    
    // Find high-priority unanswered questions
    answers.unansweredQuestions?.forEach(unanswered => {
      if (unanswered.priority === 'high') {
        criticalGaps.push({
          questionId: unanswered.questionId,
          question: unanswered.question,
          impact: 'High priority question without answer',
          recommendation: 'Requires immediate attention'
        });
      }
    });

    // Find low-confidence answers to important questions
    answers.answeredQuestions?.forEach(answered => {
      if (answered.confidence < 0.6 && answered.priority === 'high') {
        criticalGaps.push({
          questionId: answered.questionId,
          question: answered.question,
          impact: 'Low confidence answer to high priority question',
          recommendation: 'Verify and strengthen answer'
        });
      }
    });

    return criticalGaps;
  }

  suggestImprovements(gapsByCategory) {
    const improvements = [];
    
    Object.entries(gapsByCategory).forEach(([category, stats]) => {
      if (stats.gapPercentage > 50) {
        improvements.push({
          category,
          issue: `${stats.gapPercentage.toFixed(1)}% of ${category} questions unanswered`,
          suggestion: `Focus on gathering more ${category} documentation`
        });
      }
    });

    return improvements;
  }

  calculateQualityMetrics(answers) {
    const metrics = {
      averageConfidence: 0,
      confidenceDistribution: { high: 0, medium: 0, low: 0 },
      answerLengthStats: { min: 0, max: 0, average: 0 },
      sourceUtilization: {}
    };

    const answeredQuestions = answers.answeredQuestions || [];
    
    if (answeredQuestions.length > 0) {
      // Calculate average confidence
      const totalConfidence = answeredQuestions.reduce((sum, q) => sum + (q.confidence || 0), 0);
      metrics.averageConfidence = totalConfidence / answeredQuestions.length;

      // Confidence distribution
      answeredQuestions.forEach(q => {
        const conf = q.confidence || 0;
        if (conf >= 0.8) metrics.confidenceDistribution.high++;
        else if (conf >= 0.6) metrics.confidenceDistribution.medium++;
        else metrics.confidenceDistribution.low++;
      });

      // Answer length statistics
      const lengths = answeredQuestions.map(q => (q.answer || '').length);
      metrics.answerLengthStats = {
        min: Math.min(...lengths),
        max: Math.max(...lengths),
        average: lengths.reduce((sum, len) => sum + len, 0) / lengths.length
      };

      // Source utilization
      const sourceCount = {};
      answeredQuestions.forEach(q => {
        (q.sources || []).forEach(source => {
          sourceCount[source.documentName] = (sourceCount[source.documentName] || 0) + 1;
        });
      });
      metrics.sourceUtilization = sourceCount;
    }

    return metrics;
  }

  analyzeDocumentUtilization(answers, documents) {
    const utilization = {};
    
    documents.forEach(doc => {
      const docName = doc.fileName || doc.name;
      utilization[docName] = {
        timesReferenced: 0,
        questionsAnswered: [],
        utilizationScore: 0
      };
    });

    // Count references
    (answers.answeredQuestions || []).forEach(answer => {
      (answer.sources || []).forEach(source => {
        if (utilization[source.documentName]) {
          utilization[source.documentName].timesReferenced++;
          utilization[source.documentName].questionsAnswered.push(answer.questionId);
        }
      });
    });

    // Calculate utilization scores
    const maxReferences = Math.max(...Object.values(utilization).map(u => u.timesReferenced));
    Object.keys(utilization).forEach(docName => {
      utilization[docName].utilizationScore = maxReferences > 0 ? 
        utilization[docName].timesReferenced / maxReferences : 0;
    });

    return utilization;
  }

  countTotalQuestions(rfpQuestions) {
    let count = 0;
    Object.values(rfpQuestions.questionCategories || {}).forEach(questions => {
      count += questions.length;
    });
    return count;
  }

  /**
   * Intelligent content truncation for large documents
   * Prioritizes content based on question relevance and document structure
   */
  intelligentContentTruncation(content, questions, maxLength = 8000) {
    if (content.length <= maxLength) {
      return content;
    }

    logger.info(`Applying intelligent truncation to content of ${content.length} characters`);

    // Extract question keywords for relevance scoring
    const questionKeywords = questions.map(q => 
      q.question_text || q.question || ''
    ).join(' ').toLowerCase().split(/\s+/).filter(word => word.length > 3);

    // Split content into sections
    const sections = this.splitContentIntoSections(content);
    
    // Score sections based on relevance to questions
    const scoredSections = sections.map(section => ({
      content: section,
      score: this.calculateSectionRelevance(section, questionKeywords),
      length: section.length
    }));

    // Sort by relevance score (descending)
    scoredSections.sort((a, b) => b.score - a.score);

    // Select sections that fit within maxLength
    let selectedContent = '';
    let totalLength = 0;
    const selectedSections = [];

    for (const section of scoredSections) {
      if (totalLength + section.length <= maxLength) {
        selectedSections.push(section);
        totalLength += section.length;
      }
    }

    // Reconstruct content maintaining some original order
    selectedContent = selectedSections
      .sort((a, b) => content.indexOf(a.content) - content.indexOf(b.content))
      .map(s => s.content)
      .join('\n\n');

    // If still too long, truncate intelligently
    if (selectedContent.length > maxLength) {
      const truncated = selectedContent.substring(0, maxLength - 100);
      selectedContent = truncated + '\n\n... [Content truncated - showing most relevant sections]';
    }

    logger.info(`Content truncated from ${content.length} to ${selectedContent.length} characters`);
    return selectedContent;
  }

  /**
   * Split content into logical sections
   */
  splitContentIntoSections(content) {
    // Split by common section indicators
    const sectionPatterns = [
      /\n\s*\d+\.\s+[A-Z][^\n]*\n/g,  // Numbered sections
      /\n\s*[A-Z][A-Z\s]{10,}\n/g,    // ALL CAPS headers
      /\n\s*[A-Z][^:\n]{5,}:\s*\n/g,  // Title: format
      /\n\s*[-=]{5,}\s*\n/g           // Separator lines
    ];

    let sections = [content];
    
    for (const pattern of sectionPatterns) {
      const newSections = [];
      for (const section of sections) {
        const parts = section.split(pattern);
        newSections.push(...parts.filter(part => part.trim().length > 100));
      }
      if (newSections.length > sections.length) {
        sections = newSections;
        break; // Use the first pattern that creates meaningful splits
      }
    }

    // If no good splits found, split by paragraphs
    if (sections.length === 1) {
      sections = content.split(/\n\s*\n/).filter(para => para.trim().length > 50);
    }

    return sections;
  }

  /**
   * Calculate section relevance based on question keywords
   */
  calculateSectionRelevance(section, questionKeywords) {
    const sectionLower = section.toLowerCase();
    let score = 0;

    // Count keyword matches
    questionKeywords.forEach(keyword => {
      const matches = (sectionLower.match(new RegExp(keyword, 'g')) || []).length;
      score += matches;
    });

    // Boost score for sections with structured content
    const structureBonus = [
      /requirements?/i,
      /specifications?/i,
      /criteria/i,
      /evaluation/i,
      /timeline/i,
      /deadline/i,
      /budget/i,
      /cost/i
    ].reduce((bonus, pattern) => {
      return bonus + (pattern.test(section) ? 2 : 0);
    }, 0);

    return score + structureBonus;
  }
}

module.exports = new AnswerExtractionAgent();