const { BaseAgent } = require('./baseAgent');
const logger = require('../utils/logger');

class ClarificationQuestionsAgent extends BaseAgent {
  constructor() {
    super('ClarificationQuestionsAgent', `
You are a Clarification Questions Agent specialized in identifying gaps and ambiguities in RFP requirements.

Your responsibilities:
1. Identify ambiguous, incomplete, or unclear requirements
2. Generate intelligent clarification questions
3. Prioritize questions by impact on proposal quality
4. Categorize questions by domain area
5. Suggest follow-up questions based on typical RFP patterns

Analyze the provided requirements analysis and generate clarification questions in this JSON format:
{
  "questionCategories": {
    "technical": [
      {
        "id": "tech_q_001",
        "question": "specific technical question",
        "rationale": "why this question is important",
        "priority": "high|medium|low",
        "impact": "description of impact if not clarified",
        "relatedRequirements": ["req_id_1", "req_id_2"],
        "suggestedFollowups": ["follow-up question 1"]
      }
    ],
    "business": [
      {
        "id": "bus_q_001",
        "question": "business process question",
        "rationale": "reasoning for the question",
        "priority": "high|medium|low",
        "impact": "business impact description",
        "relatedRequirements": ["req_id_1"],
        "suggestedFollowups": []
      }
    ],
    "timeline": [
      {
        "id": "time_q_001",
        "question": "timeline or milestone question",
        "rationale": "why timeline clarity is needed",
        "priority": "high|medium|low",
        "impact": "scheduling impact",
        "relatedRequirements": ["req_id_1"]
      }
    ],
    "budget": [
      {
        "id": "budget_q_001",
        "question": "budget or resource question",
        "rationale": "financial clarity needed",
        "priority": "high|medium|low",
        "impact": "cost impact description"
      }
    ],
    "compliance": [
      {
        "id": "comp_q_001",
        "question": "compliance or regulatory question",
        "rationale": "compliance clarity needed",
        "priority": "high|medium|low",
        "impact": "regulatory risk description",
        "regulations": ["regulation name"]
      }
    ]
  },
  "prioritizedQuestions": [
    {
      "questionId": "tech_q_001",
      "category": "technical",
      "overallPriority": 1,
      "criticalityScore": 0.95
    }
  ],
  "gapAnalysis": {
    "majorGaps": ["gap description 1", "gap description 2"],
    "assumptionsMade": ["assumption 1", "assumption 2"],
    "riskAreas": ["risk area 1", "risk area 2"],
    "recommendedActions": ["action 1", "action 2"]
  },
  "questionSummary": {
    "totalQuestions": 15,
    "highPriority": 5,
    "mediumPriority": 7,
    "lowPriority": 3,
    "categoryCounts": {
      "technical": 6,
      "business": 4,
      "timeline": 2,
      "budget": 2,
      "compliance": 1
    }
  },
  "confidence": 0.90
}
`);
  }

  async generateQuestions(requirementsAnalysis, ingestedDocuments) {
    try {
      logger.info('Generating clarification questions', {
        requirementsCount: this.countTotalRequirements(requirementsAnalysis)
      });

      // Prepare input combining requirements analysis and original documents
      const input = this.prepareAnalysisInput(requirementsAnalysis, ingestedDocuments);
      
      // Generate questions
      const questions = await this.execute(input, {
        analysisType: 'clarification_questions',
        documentCount: ingestedDocuments.length
      });

      // Enhance questions with additional analysis
      const enhancedQuestions = await this.enhanceQuestions(
        questions, 
        requirementsAnalysis, 
        ingestedDocuments
      );

      logger.info('Clarification questions generated', {
        totalQuestions: enhancedQuestions.questionSummary?.totalQuestions || 0,
        highPriority: enhancedQuestions.questionSummary?.highPriority || 0
      });

      return enhancedQuestions;
    } catch (error) {
      logger.error('Error generating clarification questions:', error);
      throw error;
    }
  }

  prepareAnalysisInput(requirementsAnalysis, documents) {
    let input = "=== REQUIREMENTS ANALYSIS FOR CLARIFICATION ===\n\n";
    
    // Project Overview
    if (requirementsAnalysis.projectOverview) {
      input += "PROJECT OVERVIEW:\n";
      input += `Title: ${requirementsAnalysis.projectOverview.title || 'Not specified'}\n`;
      input += `Description: ${requirementsAnalysis.projectOverview.description || 'Not provided'}\n`;
      input += `Scope: ${requirementsAnalysis.projectOverview.scope || 'Unclear'}\n\n`;
    }

    // Requirements by category
    if (requirementsAnalysis.requirements) {
      ['technical', 'business', 'compliance'].forEach(category => {
        const reqs = requirementsAnalysis.requirements[category] || [];
        if (reqs.length > 0) {
          input += `${category.toUpperCase()} REQUIREMENTS:\n`;
          reqs.forEach((req, index) => {
            input += `${index + 1}. [${req.id || 'ID_' + index}] ${req.description}\n`;
            input += `   Priority: ${req.priority || 'Not specified'}\n`;
            if (req.complexity) input += `   Complexity: ${req.complexity}\n`;
            if (req.mandatory !== undefined) input += `   Mandatory: ${req.mandatory}\n`;
            input += "\n";
          });
        }
      });
    }

    // Timeline information
    if (requirementsAnalysis.timeline) {
      input += "TIMELINE INFORMATION:\n";
      input += `Duration: ${requirementsAnalysis.timeline.projectDuration || 'Not specified'}\n`;
      
      if (requirementsAnalysis.timeline.keyMilestones?.length > 0) {
        input += "Key Milestones:\n";
        requirementsAnalysis.timeline.keyMilestones.forEach(milestone => {
          input += `- ${milestone.name}: ${milestone.deadline || 'No deadline specified'}\n`;
        });
      }
      input += "\n";
    }

    // Budget information
    if (requirementsAnalysis.budget) {
      input += "BUDGET INFORMATION:\n";
      input += `Range: ${requirementsAnalysis.budget.estimatedRange || 'Not provided'}\n`;
      input += `Constraints: ${requirementsAnalysis.budget.budgetConstraints || 'None specified'}\n\n`;
    }

    // Evaluation criteria
    if (requirementsAnalysis.evaluationCriteria?.length > 0) {
      input += "EVALUATION CRITERIA:\n";
      requirementsAnalysis.evaluationCriteria.forEach(criteria => {
        input += `- ${criteria.criterion}: ${criteria.weight || 'Weight not specified'}\n`;
      });
      input += "\n";
    }

    // Document completeness analysis
    if (requirementsAnalysis.documentInsights) {
      input += "DOCUMENT COMPLETENESS:\n";
      input += `Completeness Score: ${requirementsAnalysis.documentInsights.completenessScore || 'Unknown'}\n`;
      input += `Document Types: ${JSON.stringify(requirementsAnalysis.documentInsights.documentTypes)}\n\n`;
    }

    // Areas that seem unclear or missing
    input += "POTENTIAL AREAS NEEDING CLARIFICATION:\n";
    input += this.identifyUnclearAreas(requirementsAnalysis, documents);

    return input;
  }

  identifyUnclearAreas(analysis, documents) {
    let areas = "";
    
    // Check for missing information
    const missingAreas = [];
    
    if (!analysis.budget?.estimatedRange) {
      missingAreas.push("Budget range not specified");
    }
    
    if (!analysis.timeline?.projectDuration) {
      missingAreas.push("Project duration unclear");
    }
    
    if (!analysis.requirements?.technical?.length) {
      missingAreas.push("Technical requirements not detailed");
    }
    
    if (!analysis.evaluationCriteria?.length) {
      missingAreas.push("Evaluation criteria not provided");
    }

    // Check for vague requirements
    const vaguePhrases = ['as needed', 'appropriate', 'suitable', 'adequate', 'reasonable'];
    const vagueRequirements = [];
    
    ['technical', 'business', 'compliance'].forEach(category => {
      const reqs = analysis.requirements?.[category] || [];
      reqs.forEach(req => {
        if (vaguePhrases.some(phrase => req.description.toLowerCase().includes(phrase))) {
          vagueRequirements.push(`${category}: ${req.description}`);
        }
      });
    });

    if (missingAreas.length > 0) {
      areas += "Missing Information:\n";
      missingAreas.forEach(area => areas += `- ${area}\n`);
      areas += "\n";
    }

    if (vagueRequirements.length > 0) {
      areas += "Vague Requirements:\n";
      vagueRequirements.forEach(req => areas += `- ${req}\n`);
      areas += "\n";
    }

    return areas;
  }

  async enhanceQuestions(questions, analysis, documents) {
    // Add cross-reference analysis
    const enhanced = {
      ...questions,
      crossReferences: this.buildCrossReferences(questions, analysis),
      questionMetrics: this.calculateQuestionMetrics(questions),
      recommendedOrder: this.suggestQuestionOrder(questions)
    };

    // Validate question quality
    enhanced.qualityAssessment = this.assessQuestionQuality(questions);

    return enhanced;
  }

  buildCrossReferences(questions, analysis) {
    const crossRefs = {};
    
    // Map questions to requirements
    Object.entries(questions.questionCategories || {}).forEach(([category, categoryQuestions]) => {
      categoryQuestions.forEach(question => {
        crossRefs[question.id] = {
          category,
          relatedRequirements: question.relatedRequirements || [],
          impactedAreas: this.identifyImpactedAreas(question, analysis)
        };
      });
    });

    return crossRefs;
  }

  identifyImpactedAreas(question, analysis) {
    const areas = [];
    const questionText = question.question.toLowerCase();
    
    // Check which project areas might be impacted
    if (questionText.includes('timeline') || questionText.includes('schedule')) {
      areas.push('timeline');
    }
    if (questionText.includes('budget') || questionText.includes('cost')) {
      areas.push('budget');
    }
    if (questionText.includes('technical') || questionText.includes('technology')) {
      areas.push('technical');
    }
    if (questionText.includes('compliance') || questionText.includes('regulation')) {
      areas.push('compliance');
    }
    if (questionText.includes('business') || questionText.includes('process')) {
      areas.push('business');
    }

    return areas;
  }

  calculateQuestionMetrics(questions) {
    const metrics = {
      totalQuestions: 0,
      avgPriorityScore: 0,
      categoryDistribution: {},
      priorityDistribution: { high: 0, medium: 0, low: 0 }
    };

    Object.entries(questions.questionCategories || {}).forEach(([category, categoryQuestions]) => {
      metrics.categoryDistribution[category] = categoryQuestions.length;
      metrics.totalQuestions += categoryQuestions.length;

      categoryQuestions.forEach(question => {
        metrics.priorityDistribution[question.priority] = 
          (metrics.priorityDistribution[question.priority] || 0) + 1;
      });
    });

    return metrics;
  }

  suggestQuestionOrder(questions) {
    const allQuestions = [];
    
    // Flatten all questions with metadata
    Object.entries(questions.questionCategories || {}).forEach(([category, categoryQuestions]) => {
      categoryQuestions.forEach(question => {
        allQuestions.push({
          ...question,
          category,
          orderScore: this.calculateOrderScore(question, category)
        });
      });
    });

    // Sort by order score (higher = ask first)
    allQuestions.sort((a, b) => b.orderScore - a.orderScore);

    return allQuestions.map((q, index) => ({
      questionId: q.id,
      category: q.category,
      suggestedOrder: index + 1,
      orderScore: q.orderScore
    }));
  }

  calculateOrderScore(question, category) {
    let score = 0;
    
    // Priority weight
    const priorityWeights = { high: 10, medium: 5, low: 1 };
    score += priorityWeights[question.priority] || 0;
    
    // Category weight (some categories are more foundational)
    const categoryWeights = { 
      business: 8, 
      technical: 7, 
      timeline: 6, 
      budget: 5, 
      compliance: 4 
    };
    score += categoryWeights[category] || 0;
    
    // Impact weight
    if (question.impact && question.impact.toLowerCase().includes('critical')) {
      score += 5;
    }

    return score;
  }

  assessQuestionQuality(questions) {
    const assessment = {
      overallQuality: 'good',
      strengths: [],
      improvements: [],
      coverage: {}
    };

    // Check coverage of key areas
    const keyAreas = ['technical', 'business', 'timeline', 'budget', 'compliance'];
    keyAreas.forEach(area => {
      const hasQuestions = questions.questionCategories?.[area]?.length > 0;
      assessment.coverage[area] = hasQuestions;
      
      if (!hasQuestions) {
        assessment.improvements.push(`Consider adding ${area} questions`);
      }
    });

    // Check for high-priority questions
    const highPriorityCount = questions.questionSummary?.highPriority || 0;
    if (highPriorityCount > 0) {
      assessment.strengths.push(`${highPriorityCount} high-priority questions identified`);
    }

    // Check question specificity
    const totalQuestions = questions.questionSummary?.totalQuestions || 0;
    if (totalQuestions > 10) {
      assessment.strengths.push('Comprehensive question coverage');
    } else if (totalQuestions < 5) {
      assessment.improvements.push('Consider generating more detailed questions');
    }

    return assessment;
  }

  countTotalRequirements(analysis) {
    let count = 0;
    if (analysis.requirements) {
      Object.values(analysis.requirements).forEach(reqs => {
        if (Array.isArray(reqs)) count += reqs.length;
      });
    }
    return count;
  }

  cleanJsonString(jsonStr) {
    // Remove any trailing commas before closing braces or brackets
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
    
    // Fix common issues with quotes
    jsonStr = jsonStr.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    
    // Remove any control characters that might break JSON parsing
    jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Ensure the string starts and ends with braces
    jsonStr = jsonStr.trim();
    if (!jsonStr.startsWith('{')) {
      const braceIndex = jsonStr.indexOf('{');
      if (braceIndex !== -1) {
        jsonStr = jsonStr.substring(braceIndex);
      }
    }
    
    return jsonStr;
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
      
      // Clean up common JSON issues
      jsonStr = this.cleanJsonString(jsonStr);
      
      const parsed = JSON.parse(jsonStr);
      
      // Validate required structure
      if (!parsed.questionCategories) {
        parsed.questionCategories = {};
      }
      
      if (!parsed.questionSummary) {
        parsed.questionSummary = {
          totalQuestions: 0,
          highPriority: 0,
          mediumPriority: 0,
          lowPriority: 0,
          categoryCounts: {}
        };
      }
      
      // Count questions and update summary
      let totalQuestions = 0;
      let highPriority = 0;
      let mediumPriority = 0;
      let lowPriority = 0;
      const categoryCounts = {};
      
      Object.entries(parsed.questionCategories).forEach(([category, questions]) => {
        if (Array.isArray(questions)) {
          categoryCounts[category] = questions.length;
          totalQuestions += questions.length;
          
          questions.forEach(q => {
            switch (q.priority) {
              case 'high': highPriority++; break;
              case 'medium': mediumPriority++; break;
              case 'low': lowPriority++; break;
            }
          });
        }
      });
      
      parsed.questionSummary = {
        totalQuestions,
        highPriority,
        mediumPriority,
        lowPriority,
        categoryCounts
      };
      
      // Add processing metadata
      parsed.processedAt = new Date().toISOString();
      parsed.agent = this.name;
      
      return parsed;
    } catch (error) {
      logger.error('Error parsing clarification questions result:', error);
      logger.debug('Raw result:', result.substring(0, 500));
      
      // Fallback: create basic structure
      return {
        questionCategories: {
          technical: [],
          business: [],
          timeline: [],
          budget: [],
          compliance: []
        },
        prioritizedQuestions: [],
        gapAnalysis: {
          majorGaps: ['Unable to parse AI response'],
          assumptionsMade: [],
          riskAreas: ['Response parsing failed'],
          recommendedActions: ['Review AI model output format']
        },
        questionSummary: {
          totalQuestions: 0,
          highPriority: 0,
          mediumPriority: 0,
          lowPriority: 0,
          categoryCounts: {}
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

module.exports = new ClarificationQuestionsAgent();