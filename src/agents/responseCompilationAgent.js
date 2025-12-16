const { BaseAgent } = require('./baseAgent');
const logger = require('../utils/logger');

class ResponseCompilationAgent extends BaseAgent {
  constructor() {
    super('ResponseCompilationAgent', `
You are a Response Compilation Agent specialized in organizing and structuring RFP responses into a comprehensive proposal format.

Your responsibilities:
1. Match RFP questions with extracted answers
2. Organize responses in a structured, professional format
3. Include source references and confidence indicators
4. Highlight gaps requiring manual input
5. Generate executive summary and proposal outline
6. Ensure consistency and flow across all sections

Compile the provided information into a structured RFP response in this JSON format:
{
  "executiveSummary": {
    "projectTitle": "RFP project title",
    "companyResponse": "our understanding and approach summary",
    "keyStrengths": ["strength 1", "strength 2"],
    "valueProposition": "what we bring to this project",
    "confidenceLevel": "high|medium|low",
    "overallReadiness": 0.85
  },
  "proposalStructure": {
    "sections": [
      {
        "sectionId": "exec_summary",
        "title": "Executive Summary",
        "order": 1,
        "status": "complete|partial|needs_input",
        "content": "section content",
        "subsections": []
      },
      {
        "sectionId": "technical_approach",
        "title": "Technical Approach",
        "order": 2,
        "status": "complete",
        "content": "technical approach content",
        "subsections": [
          {
            "title": "Architecture Overview",
            "content": "architecture details",
            "sources": ["doc1.pdf", "doc2.docx"]
          }
        ]
      }
    ]
  },
  "questionResponses": [
    {
      "questionId": "tech_001",
      "originalQuestion": "question text",
      "response": "our detailed response",
      "confidence": 0.90,
      "status": "answered|partial|needs_review",
      "sources": [
        {
          "document": "source document",
          "section": "relevant section",
          "relevance": 0.95
        }
      ],
      "reviewNotes": "any notes for review"
    }
  ],
  "gapsAndActions": {
    "criticalGaps": [
      {
        "area": "gap area",
        "description": "what's missing",
        "impact": "high|medium|low",
        "recommendedAction": "what to do",
        "assignedTo": "SME area",
        "priority": 1
      }
    ],
    "reviewItems": [
      {
        "item": "item needing review",
        "reason": "why it needs review",
        "section": "which section"
      }
    ],
    "additionalResearch": [
      {
        "topic": "research topic",
        "purpose": "why needed",
        "urgency": "high|medium|low"
      }
    ]
  },
  "qualityAssurance": {
    "completenessScore": 0.78,
    "consistencyCheck": "passed|failed|warnings",
    "sourceValidation": "all sources verified",
    "recommendedReviews": ["technical review", "business review"],
    "estimatedEffort": "hours needed for completion"
  },
  "nextSteps": {
    "immediateActions": ["action 1", "action 2"],
    "reviewSchedule": "suggested review timeline",
    "deliverableTimeline": "when sections will be ready",
    "riskMitigation": ["risk mitigation step 1"]
  },
  "appendices": {
    "sourceDocuments": ["list of all source documents"],
    "assumptions": ["assumption 1", "assumption 2"],
    "definitions": {"term": "definition"},
    "contactReferences": ["contact info for follow-up"]
  },
  "confidence": 0.88
}
`);
  }

  async compileResponse(requirementsAnalysis, clarificationQuestions, extractedAnswers, projectContext) {
    try {
      logger.info('Starting response compilation', {
        requirements: this.countRequirements(requirementsAnalysis),
        questions: this.countQuestions(clarificationQuestions),
        answers: extractedAnswers.answeredQuestions?.length || 0
      });

      // Prepare comprehensive input
      const input = this.prepareCompilationInput(
        requirementsAnalysis, 
        clarificationQuestions, 
        extractedAnswers, 
        projectContext
      );
      
      // Compile response
      const compiledResponse = await this.execute(input, {
        compilationType: 'rfp_response',
        projectContext
      });

      // Enhance with additional analysis
      const enhancedResponse = await this.enhanceResponse(
        compiledResponse,
        requirementsAnalysis,
        clarificationQuestions,
        extractedAnswers
      );

      logger.info('Response compilation completed', {
        completenessScore: enhancedResponse.qualityAssurance?.completenessScore || 0,
        criticalGaps: enhancedResponse.gapsAndActions?.criticalGaps?.length || 0
      });

      return enhancedResponse;
    } catch (error) {
      logger.error('Error in response compilation:', error);
      throw error;
    }
  }

  prepareCompilationInput(requirementsAnalysis, clarificationQuestions, extractedAnswers, projectContext) {
    let input = "=== RFP RESPONSE COMPILATION ===\n\n";
    
    // Project context
    if (projectContext) {
      input += "PROJECT CONTEXT:\n";
      input += `RFP Title: ${projectContext.title || 'Not specified'}\n`;
      input += `Client: ${projectContext.client || 'Not specified'}\n`;
      input += `Deadline: ${projectContext.deadline || 'Not specified'}\n\n`;
    }

    // Requirements analysis summary
    if (requirementsAnalysis?.projectOverview) {
      input += "PROJECT OVERVIEW:\n";
      input += `Title: ${requirementsAnalysis.projectOverview.title}\n`;
      input += `Description: ${requirementsAnalysis.projectOverview.description}\n`;
      input += `Scope: ${requirementsAnalysis.projectOverview.scope}\n`;
      
      if (requirementsAnalysis.projectOverview.objectives?.length > 0) {
        input += "Objectives:\n";
        requirementsAnalysis.projectOverview.objectives.forEach(obj => {
          input += `- ${obj}\n`;
        });
      }
      input += "\n";
    }

    // Key requirements by category
    if (requirementsAnalysis?.requirements) {
      input += "KEY REQUIREMENTS:\n";
      ['technical', 'business', 'compliance'].forEach(category => {
        const reqs = requirementsAnalysis.requirements[category] || [];
        if (reqs.length > 0) {
          input += `\n${category.toUpperCase()} REQUIREMENTS:\n`;
          reqs.forEach(req => {
            input += `- [${req.id}] ${req.description} (Priority: ${req.priority})\n`;
          });
        }
      });
      input += "\n";
    }

    // Timeline and budget
    if (requirementsAnalysis?.timeline) {
      input += "TIMELINE:\n";
      input += `Duration: ${requirementsAnalysis.timeline.projectDuration}\n`;
      if (requirementsAnalysis.timeline.keyMilestones?.length > 0) {
        input += "Key Milestones:\n";
        requirementsAnalysis.timeline.keyMilestones.forEach(milestone => {
          input += `- ${milestone.name}: ${milestone.deadline}\n`;
        });
      }
      input += "\n";
    }

    if (requirementsAnalysis?.budget) {
      input += "BUDGET INFORMATION:\n";
      input += `Range: ${requirementsAnalysis.budget.estimatedRange || 'Not specified'}\n`;
      input += `Constraints: ${requirementsAnalysis.budget.budgetConstraints || 'None specified'}\n\n`;
    }

    // Answered questions
    if (extractedAnswers?.answeredQuestions?.length > 0) {
      input += "ANSWERED QUESTIONS:\n";
      extractedAnswers.answeredQuestions.forEach(answer => {
        input += `\nQ: ${answer.question}\n`;
        input += `A: ${answer.answer}\n`;
        input += `Confidence: ${answer.confidence}\n`;
        input += `Sources: ${answer.sources?.map(s => s.documentName).join(', ') || 'None'}\n`;
      });
      input += "\n";
    }

    // Unanswered questions (gaps)
    if (extractedAnswers?.unansweredQuestions?.length > 0) {
      input += "UNANSWERED QUESTIONS (GAPS):\n";
      extractedAnswers.unansweredQuestions.forEach(gap => {
        input += `- [${gap.questionId}] ${gap.question}\n`;
        input += `  Reason: ${gap.reason}\n`;
        input += `  Priority: ${gap.priority}\n`;
      });
      input += "\n";
    }

    // Clarification questions
    if (clarificationQuestions?.questionSummary?.totalQuestions > 0) {
      input += "CLARIFICATION QUESTIONS TO ADDRESS:\n";
      input += `Total: ${clarificationQuestions.questionSummary.totalQuestions}\n`;
      input += `High Priority: ${clarificationQuestions.questionSummary.highPriority}\n`;
      
      // Include a few high-priority examples
      const highPriorityQuestions = this.getHighPriorityQuestions(clarificationQuestions, 3);
      if (highPriorityQuestions.length > 0) {
        input += "Sample High Priority Questions:\n";
        highPriorityQuestions.forEach(q => {
          input += `- ${q.question}\n`;
        });
      }
      input += "\n";
    }

    // Evaluation criteria
    if (requirementsAnalysis?.evaluationCriteria?.length > 0) {
      input += "EVALUATION CRITERIA:\n";
      requirementsAnalysis.evaluationCriteria.forEach(criteria => {
        input += `- ${criteria.criterion}: ${criteria.weight || 'Weight not specified'}\n`;
        if (criteria.description) {
          input += `  ${criteria.description}\n`;
        }
      });
      input += "\n";
    }

    return input;
  }

  getHighPriorityQuestions(clarificationQuestions, limit = 5) {
    const highPriorityQuestions = [];
    
    Object.values(clarificationQuestions.questionCategories || {}).forEach(questions => {
      questions.forEach(question => {
        if (question.priority === 'high') {
          highPriorityQuestions.push(question);
        }
      });
    });

    return highPriorityQuestions.slice(0, limit);
  }

  async enhanceResponse(response, requirementsAnalysis, clarificationQuestions, extractedAnswers) {
    // Add cross-validation and quality checks
    const enhanced = {
      ...response,
      crossValidation: this.performCrossValidation(response, extractedAnswers),
      completenessAnalysis: this.analyzeCompleteness(response, requirementsAnalysis),
      consistencyCheck: this.checkConsistency(response),
      improvementSuggestions: this.generateImprovementSuggestions(response)
    };

    // Add section-level metrics
    enhanced.sectionMetrics = this.calculateSectionMetrics(response);

    // Add timeline analysis
    enhanced.timelineAnalysis = this.analyzeTimeline(response, requirementsAnalysis);

    return enhanced;
  }

  performCrossValidation(response, extractedAnswers) {
    const validation = {
      answerConsistency: 'good',
      sourceReliability: 'high',
      confidenceAlignment: true,
      issues: []
    };

    // Check if response answers align with extracted answers
    const responseAnswers = response.questionResponses || [];
    const extractedAnswerMap = {};
    
    (extractedAnswers.answeredQuestions || []).forEach(answer => {
      extractedAnswerMap[answer.questionId] = answer;
    });

    responseAnswers.forEach(responseAnswer => {
      const extractedAnswer = extractedAnswerMap[responseAnswer.questionId];
      
      if (extractedAnswer) {
        // Check confidence alignment
        const confidenceDiff = Math.abs(responseAnswer.confidence - extractedAnswer.confidence);
        if (confidenceDiff > 0.3) {
          validation.issues.push({
            questionId: responseAnswer.questionId,
            issue: 'Confidence score mismatch',
            severity: 'medium'
          });
        }

        // Check source consistency
        const responseSources = responseAnswer.sources?.map(s => s.document) || [];
        const extractedSources = extractedAnswer.sources?.map(s => s.documentName) || [];
        
        const commonSources = responseSources.filter(s => extractedSources.includes(s));
        if (commonSources.length === 0 && responseSources.length > 0 && extractedSources.length > 0) {
          validation.issues.push({
            questionId: responseAnswer.questionId,
            issue: 'No common sources between response and extraction',
            severity: 'low'
          });
        }
      }
    });

    return validation;
  }

  analyzeCompleteness(response, requirementsAnalysis) {
    const analysis = {
      overallCompleteness: 0,
      sectionCompleteness: {},
      missingElements: [],
      recommendations: []
    };

    // Check section completeness
    const sections = response.proposalStructure?.sections || [];
    sections.forEach(section => {
      let completeness = 0;
      
      if (section.content && section.content.trim().length > 0) {
        completeness += 0.5;
      }
      
      if (section.status === 'complete') {
        completeness += 0.5;
      } else if (section.status === 'partial') {
        completeness += 0.25;
      }
      
      analysis.sectionCompleteness[section.sectionId] = completeness;
    });

    // Calculate overall completeness
    const completenessValues = Object.values(analysis.sectionCompleteness);
    analysis.overallCompleteness = completenessValues.length > 0 ? 
      completenessValues.reduce((sum, val) => sum + val, 0) / completenessValues.length : 0;

    // Check for missing critical elements
    const criticalSections = ['exec_summary', 'technical_approach', 'project_timeline', 'budget'];
    const existingSections = sections.map(s => s.sectionId);
    
    criticalSections.forEach(criticalSection => {
      if (!existingSections.includes(criticalSection)) {
        analysis.missingElements.push(`Missing critical section: ${criticalSection}`);
      }
    });

    // Generate recommendations
    if (analysis.overallCompleteness < 0.7) {
      analysis.recommendations.push('Focus on completing partial sections');
    }
    
    if (analysis.missingElements.length > 0) {
      analysis.recommendations.push('Add missing critical sections');
    }

    return analysis;
  }

  checkConsistency(response) {
    const consistency = {
      overallConsistency: 'good',
      issues: [],
      checks: {
        terminologyConsistency: true,
        dateConsistency: true,
        budgetConsistency: true,
        contactConsistency: true
      }
    };

    // Check for consistent terminology across sections
    const allContent = (response.proposalStructure?.sections || [])
      .map(s => s.content || '')
      .join(' ');

    // Simple consistency checks (could be enhanced with NLP)
    const commonTerms = ['project', 'solution', 'implementation', 'delivery'];
    commonTerms.forEach(term => {
      const variations = this.findTermVariations(allContent, term);
      if (variations.length > 2) {
        consistency.issues.push({
          type: 'terminology',
          issue: `Multiple variations of "${term}" found: ${variations.join(', ')}`,
          severity: 'low'
        });
      }
    });

    return consistency;
  }

  findTermVariations(text, baseTerm) {
    const variations = new Set();
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    
    words.forEach(word => {
      if (word.includes(baseTerm.toLowerCase()) || baseTerm.toLowerCase().includes(word)) {
        variations.add(word);
      }
    });

    return Array.from(variations);
  }

  generateImprovementSuggestions(response) {
    const suggestions = [];

    // Check executive summary
    if (!response.executiveSummary?.valueProposition) {
      suggestions.push({
        area: 'Executive Summary',
        suggestion: 'Add a clear value proposition',
        priority: 'high'
      });
    }

    // Check question responses
    const lowConfidenceAnswers = (response.questionResponses || [])
      .filter(q => q.confidence < 0.6);
    
    if (lowConfidenceAnswers.length > 0) {
      suggestions.push({
        area: 'Question Responses',
        suggestion: `Review ${lowConfidenceAnswers.length} low-confidence answers`,
        priority: 'medium'
      });
    }

    // Check gaps
    const criticalGaps = (response.gapsAndActions?.criticalGaps || [])
      .filter(g => g.impact === 'high');
    
    if (criticalGaps.length > 0) {
      suggestions.push({
        area: 'Critical Gaps',
        suggestion: `Address ${criticalGaps.length} high-impact gaps`,
        priority: 'high'
      });
    }

    return suggestions;
  }

  calculateSectionMetrics(response) {
    const metrics = {};
    
    (response.proposalStructure?.sections || []).forEach(section => {
      metrics[section.sectionId] = {
        wordCount: (section.content || '').split(/\s+/).length,
        completeness: section.status === 'complete' ? 1 : section.status === 'partial' ? 0.5 : 0,
        subsectionCount: (section.subsections || []).length,
        hasContent: !!(section.content && section.content.trim().length > 0)
      };
    });

    return metrics;
  }

  analyzeTimeline(response, requirementsAnalysis) {
    const analysis = {
      timelineAlignment: 'unknown',
      criticalPathRisks: [],
      recommendations: []
    };

    // Check if response timeline aligns with RFP requirements
    const rfpTimeline = requirementsAnalysis?.timeline;
    const responseTimeline = response.nextSteps?.deliverableTimeline;

    if (rfpTimeline && responseTimeline) {
      analysis.timelineAlignment = 'aligned'; // Simplified check
    } else if (!responseTimeline) {
      analysis.recommendations.push('Add detailed deliverable timeline');
    }

    return analysis;
  }

  countRequirements(requirementsAnalysis) {
    let count = 0;
    if (requirementsAnalysis?.requirements) {
      Object.values(requirementsAnalysis.requirements).forEach(reqs => {
        if (Array.isArray(reqs)) count += reqs.length;
      });
    }
    return count;
  }

  countQuestions(clarificationQuestions) {
    return clarificationQuestions?.questionSummary?.totalQuestions || 0;
  }
}

module.exports = new ResponseCompilationAgent();