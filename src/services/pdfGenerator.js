const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class PDFGenerator {
  constructor() {
    this.browser = null;
    this.templatePath = './src/templates';
  }

  async initialize() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      logger.info('PDF generator initialized');
    }
  }

  async generateRFPReport(workflowResults, projectContext) {
    try {
      await this.initialize();
      
      logger.info('Generating RFP PDF report', { 
        projectTitle: projectContext?.title || 'Unknown',
        hasResults: !!workflowResults,
        resultsKeys: workflowResults ? Object.keys(workflowResults) : []
      });

      // Validate input data
      if (!workflowResults) {
        throw new Error('No workflow results provided for PDF generation');
      }

      // Generate HTML content with error handling
      const htmlContent = await this.generateHTMLContent(workflowResults, projectContext);
      
      if (!htmlContent || htmlContent.length < 100) {
        throw new Error('Generated HTML content is too short or empty');
      }

      logger.info('Generated HTML content', {
        length: htmlContent.length,
        hasDoctype: htmlContent.includes('<!DOCTYPE html>'),
        hasHtmlTag: htmlContent.includes('<html'),
        hasBodyTag: htmlContent.includes('<body'),
        hasClosingTags: htmlContent.includes('</body>') && htmlContent.includes('</html>')
      });
      
      // Create PDF with better error handling
      const page = await this.browser.newPage();
      
      try {
        // Set content with timeout
        await page.setContent(htmlContent, { 
          waitUntil: 'networkidle0',
          timeout: 30000
        });
        
        // Generate PDF with proper options
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '20mm',
            right: '15mm',
            bottom: '20mm',
            left: '15mm'
          },
          displayHeaderFooter: false, // Disable header/footer to avoid issues
          preferCSSPageSize: false,
          timeout: 30000
        });

        if (!pdfBuffer || pdfBuffer.length === 0) {
          throw new Error('Generated PDF buffer is empty');
        }

        logger.info('PDF report generated successfully', {
          bufferSize: pdfBuffer.length
        });
        
        return pdfBuffer;
        
      } finally {
        await page.close();
      }
      
    } catch (error) {
      logger.error('Error generating PDF report:', {
        error: error.message,
        stack: error.stack,
        projectContext,
        hasWorkflowResults: !!workflowResults
      });
      throw new Error(`PDF generation failed: ${error.message}`);
    }
  }

  async generateHTMLContent(workflowResults, projectContext) {
    try {
      // Safely extract results with defaults
      const ingestedDocuments = workflowResults?.ingestedDocuments || [];
      const requirementsAnalysis = workflowResults?.requirementsAnalysis || {};
      const clarificationQuestions = workflowResults?.clarificationQuestions || {};
      const extractedAnswers = workflowResults?.extractedAnswers || {};
      const compiledResponse = workflowResults?.compiledResponse || {};
      
      // Validate data
      const hasDocuments = ingestedDocuments.length > 0;
      const hasRequirements = requirementsAnalysis && Object.keys(requirementsAnalysis).length > 0;
      const hasQuestions = clarificationQuestions && clarificationQuestions.questionCategories;
      const hasAnswers = extractedAnswers && extractedAnswers.answeredQuestions;
      const hasResponse = compiledResponse && Object.keys(compiledResponse).length > 0;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RFP Analysis Report - ${projectContext?.title || 'Untitled Project'}</title>
    <style>
        ${await this.getCSS()}
    </style>
</head>
<body>
    <!-- Cover Page -->
    <div class="cover-page">
        <div class="cover-header">
            <h1>RFP Analysis Report</h1>
            <h2>${projectContext?.title || 'Project Title Not Specified'}</h2>
        </div>
        <div class="cover-details">
            <p><strong>Client:</strong> ${projectContext?.client || 'Not Specified'}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>Analysis Date:</strong> ${new Date().toLocaleDateString()}</p>
        </div>
        <div class="cover-summary">
            <div class="summary-stats">
                <div class="stat">
                    <span class="stat-number">${ingestedDocuments?.length || 0}</span>
                    <span class="stat-label">Documents Processed</span>
                </div>
                <div class="stat">
                    <span class="stat-number">${this.countRequirements(requirementsAnalysis)}</span>
                    <span class="stat-label">Requirements Identified</span>
                </div>
                <div class="stat">
                    <span class="stat-number">${clarificationQuestions?.questionSummary?.totalQuestions || 0}</span>
                    <span class="stat-label">Questions Generated</span>
                </div>
                <div class="stat">
                    <span class="stat-number">${Math.round((compiledResponse?.qualityAssurance?.completenessScore || 0) * 100)}%</span>
                    <span class="stat-label">Completeness Score</span>
                </div>
            </div>
        </div>
    </div>

    <!-- Table of Contents -->
    <div class="page-break">
        <div class="toc">
            <h2>Table of Contents</h2>
            <ul>
                <li><a href="#executive-summary">1. Executive Summary</a></li>
                <li><a href="#requirements-overview">2. Requirements Overview</a></li>
                <li><a href="#questions-answers">3. Questions & Answers</a></li>
                <li><a href="#unanswered-questions">4. Unanswered Questions</a></li>
                <li><a href="#clarification-questions">5. Clarification Questions</a></li>
                <li><a href="#gap-analysis">6. Gap Analysis</a></li>
                <li><a href="#recommendations">7. Next Steps & Recommendations</a></li>
                <li><a href="#appendices">8. Appendices</a></li>
            </ul>
        </div>
    </div>

    <!-- Executive Summary -->
    <div class="page-break">
        <section id="executive-summary">
            <h2>1. Executive Summary</h2>
            ${this.generateExecutiveSummaryHTML(compiledResponse, requirementsAnalysis)}
        </section>
    </div>

    <!-- Requirements Overview -->
    <div class="page-break">
        <section id="requirements-overview">
            <h2>2. Requirements Overview</h2>
            ${this.generateRequirementsOverviewHTML(requirementsAnalysis)}
        </section>
    </div>

    <!-- Questions & Answers -->
    <div class="page-break">
        <section id="questions-answers">
            <h2>3. Questions & Answers</h2>
            ${this.generateQuestionsAnswersHTML(extractedAnswers)}
        </section>
    </div>

    <!-- Unanswered Questions -->
    <div class="page-break">
        <section id="unanswered-questions">
            <h2>4. Unanswered Questions</h2>
            ${this.generateUnansweredQuestionsHTML(extractedAnswers)}
        </section>
    </div>

    <!-- Clarification Questions -->
    <div class="page-break">
        <section id="clarification-questions">
            <h2>5. Clarification Questions</h2>
            ${this.generateClarificationQuestionsHTML(clarificationQuestions)}
        </section>
    </div>

    <!-- Gap Analysis -->
    <div class="page-break">
        <section id="gap-analysis">
            <h2>6. Gap Analysis</h2>
            ${this.generateGapAnalysisHTML(compiledResponse)}
        </section>
    </div>

    <!-- Recommendations -->
    <div class="page-break">
        <section id="recommendations">
            <h2>7. Next Steps & Recommendations</h2>
            ${this.generateRecommendationsHTML(compiledResponse)}
        </section>
    </div>

    <!-- Appendices -->
    <div class="page-break">
        <section id="appendices">
            <h2>8. Appendices</h2>
            ${this.generateAppendicesHTML(workflowResults)}
        </section>
    </div>
</body>
</html>`;

    return html;
    
    } catch (error) {
      logger.error('Error generating HTML content:', error);
      
      // Fallback: Generate minimal HTML
      return this.generateFallbackHTML(projectContext, workflowResults);
    }
  }

  generateFallbackHTML(projectContext, workflowResults) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RFP Analysis Report - ${projectContext?.title || 'Untitled Project'}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
        h2 { color: #666; margin-top: 30px; }
        .error { color: #d32f2f; background: #ffebee; padding: 15px; border-radius: 4px; }
        .info { background: #e3f2fd; padding: 15px; border-radius: 4px; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>RFP Analysis Report</h1>
    <h2>Project: ${projectContext?.title || 'Untitled Project'}</h2>
    
    <div class="info">
        <p><strong>Client:</strong> ${projectContext?.client || 'Not specified'}</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
        <p><strong>Status:</strong> Report generated with limited data due to processing error</p>
    </div>

    <h2>Summary</h2>
    <p>This is a simplified report generated due to an error in the full report generation process.</p>
    
    <div class="error">
        <p><strong>Note:</strong> The full report could not be generated. Please try regenerating the report or contact support if the issue persists.</p>
    </div>

    <h2>Available Data</h2>
    <ul>
        <li>Documents processed: ${workflowResults?.ingestedDocuments?.length || 0}</li>
        <li>Requirements identified: ${this.countRequirements(workflowResults?.requirementsAnalysis) || 0}</li>
        <li>Questions generated: ${workflowResults?.clarificationQuestions?.questionSummary?.totalQuestions || 0}</li>
    </ul>
</body>
</html>`;
  }

  async getCSS() {
    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            font-size: 12px;
        }

        .page-break {
            page-break-before: always;
        }

        .page-break:first-child {
            page-break-before: avoid;
        }

        /* Cover Page */
        .cover-page {
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
        }

        .cover-header h1 {
            font-size: 3rem;
            margin-bottom: 1rem;
            font-weight: 300;
        }

        .cover-header h2 {
            font-size: 1.8rem;
            margin-bottom: 2rem;
            font-weight: 400;
        }

        .cover-details {
            margin: 2rem 0;
            font-size: 1.1rem;
        }

        .cover-details p {
            margin: 0.5rem 0;
        }

        .summary-stats {
            display: flex;
            justify-content: space-around;
            margin-top: 3rem;
            width: 100%;
            max-width: 800px;
        }

        .stat {
            text-align: center;
        }

        .stat-number {
            display: block;
            font-size: 2.5rem;
            font-weight: bold;
            margin-bottom: 0.5rem;
        }

        .stat-label {
            font-size: 0.9rem;
            opacity: 0.9;
        }

        /* Table of Contents */
        .toc {
            padding: 2rem;
        }

        .toc h2 {
            color: #667eea;
            margin-bottom: 2rem;
            font-size: 2rem;
        }

        .toc ul {
            list-style: none;
        }

        .toc li {
            margin: 1rem 0;
            font-size: 1.1rem;
        }

        .toc a {
            text-decoration: none;
            color: #333;
            padding: 0.5rem 0;
            display: block;
            border-bottom: 1px dotted #ccc;
        }

        /* Sections */
        section {
            padding: 2rem;
        }

        h2 {
            color: #667eea;
            font-size: 1.8rem;
            margin-bottom: 1.5rem;
            border-bottom: 2px solid #667eea;
            padding-bottom: 0.5rem;
        }

        h3 {
            color: #555;
            font-size: 1.3rem;
            margin: 1.5rem 0 1rem 0;
        }

        h4 {
            color: #666;
            font-size: 1.1rem;
            margin: 1rem 0 0.5rem 0;
        }

        /* Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
            font-size: 11px;
        }

        th, td {
            border: 1px solid #ddd;
            padding: 0.75rem;
            text-align: left;
            vertical-align: top;
        }

        th {
            background-color: #f8f9fa;
            font-weight: 600;
            color: #555;
        }

        tr:nth-child(even) {
            background-color: #f8f9fa;
        }

        /* Priority indicators */
        .priority-high {
            background-color: #ffebee;
            color: #c62828;
            padding: 0.2rem 0.5rem;
            border-radius: 3px;
            font-size: 0.9rem;
            font-weight: 500;
        }

        .priority-medium {
            background-color: #fff3e0;
            color: #ef6c00;
            padding: 0.2rem 0.5rem;
            border-radius: 3px;
            font-size: 0.9rem;
            font-weight: 500;
        }

        .priority-low {
            background-color: #e8f5e8;
            color: #2e7d32;
            padding: 0.2rem 0.5rem;
            border-radius: 3px;
            font-size: 0.9rem;
            font-weight: 500;
        }

        /* Confidence indicators */
        .confidence-high {
            color: #2e7d32;
            font-weight: 600;
        }

        .confidence-medium {
            color: #ef6c00;
            font-weight: 600;
        }

        .confidence-low {
            color: #c62828;
            font-weight: 600;
        }

        /* Lists */
        ul, ol {
            margin: 1rem 0;
            padding-left: 2rem;
        }

        li {
            margin: 0.5rem 0;
        }

        /* Boxes */
        .info-box {
            background-color: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 1rem;
            margin: 1rem 0;
        }

        .warning-box {
            background-color: #fff3e0;
            border-left: 4px solid #ff9800;
            padding: 1rem;
            margin: 1rem 0;
        }

        .error-box {
            background-color: #ffebee;
            border-left: 4px solid #f44336;
            padding: 1rem;
            margin: 1rem 0;
        }

        .success-box {
            background-color: #e8f5e8;
            border-left: 4px solid #4caf50;
            padding: 1rem;
            margin: 1rem 0;
        }

        /* Progress bars */
        .progress-bar {
            width: 100%;
            height: 20px;
            background-color: #f0f0f0;
            border-radius: 10px;
            overflow: hidden;
            margin: 0.5rem 0;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            transition: width 0.3s ease;
        }

        /* Source references */
        .source-ref {
            font-size: 0.9rem;
            color: #666;
            font-style: italic;
            margin-top: 0.5rem;
        }

        /* Question blocks */
        .question-block {
            margin: 1.5rem 0;
            padding: 1rem;
            border: 1px solid #e0e0e0;
            border-radius: 5px;
        }

        .question-text {
            font-weight: 600;
            color: #333;
            margin-bottom: 0.5rem;
        }

        .answer-text {
            margin: 0.5rem 0;
            line-height: 1.7;
        }

        /* Footer */
        .footer {
            position: fixed;
            bottom: 0;
            width: 100%;
            text-align: center;
            font-size: 10px;
            color: #666;
        }
    `;
  }

  generateExecutiveSummaryHTML(compiledResponse, requirementsAnalysis) {
    const executiveSummary = compiledResponse?.executiveSummary || {};
    const projectOverview = requirementsAnalysis?.projectOverview || {};

    return `
        <div class="info-box">
            <h3>Project Overview</h3>
            <p><strong>Title:</strong> ${projectOverview.title || 'Not specified'}</p>
            <p><strong>Description:</strong> ${projectOverview.description || 'Not provided'}</p>
            <p><strong>Scope:</strong> ${projectOverview.scope || 'Not defined'}</p>
        </div>

        <h3>Key Strengths</h3>
        <ul>
            ${(executiveSummary.keyStrengths || ['Analysis completed', 'Requirements identified']).map(strength => 
                `<li>${strength}</li>`
            ).join('')}
        </ul>

        <h3>Value Proposition</h3>
        <p>${executiveSummary.valueProposition || 'Our comprehensive analysis provides clear insights into the RFP requirements and identifies key areas for response development.'}</p>

        <h3>Overall Assessment</h3>
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${(executiveSummary.overallReadiness || 0.7) * 100}%"></div>
        </div>
        <p>Readiness Score: ${Math.round((executiveSummary.overallReadiness || 0.7) * 100)}%</p>
    `;
  }

  generateRequirementsOverviewHTML(requirementsAnalysis) {
    if (!requirementsAnalysis?.requirements) {
      return '<p>No requirements analysis available.</p>';
    }

    const { technical = [], business = [], compliance = [] } = requirementsAnalysis.requirements;

    return `
        <h3>Technical Requirements (${technical.length})</h3>
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Description</th>
                    <th>Priority</th>
                    <th>Complexity</th>
                </tr>
            </thead>
            <tbody>
                ${technical.map(req => `
                    <tr>
                        <td>${req.id}</td>
                        <td>${req.description}</td>
                        <td><span class="priority-${req.priority}">${req.priority?.toUpperCase()}</span></td>
                        <td>${req.complexity || 'Not assessed'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <h3>Business Requirements (${business.length})</h3>
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Description</th>
                    <th>Priority</th>
                    <th>Impact</th>
                </tr>
            </thead>
            <tbody>
                ${business.map(req => `
                    <tr>
                        <td>${req.id}</td>
                        <td>${req.description}</td>
                        <td><span class="priority-${req.priority}">${req.priority?.toUpperCase()}</span></td>
                        <td>${req.impact || 'Not assessed'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <h3>Compliance Requirements (${compliance.length})</h3>
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Description</th>
                    <th>Mandatory</th>
                    <th>Standard</th>
                </tr>
            </thead>
            <tbody>
                ${compliance.map(req => `
                    <tr>
                        <td>${req.id}</td>
                        <td>${req.description}</td>
                        <td>${req.mandatory ? 'Yes' : 'No'}</td>
                        <td>${req.standard || 'Not specified'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
  }

  generateQuestionsAnswersHTML(extractedAnswers) {
    const answeredQuestions = extractedAnswers?.answeredQuestions || [];

    if (answeredQuestions.length === 0) {
      return '<p>No answered questions available.</p>';
    }

    return `
        <div class="success-box">
            <p><strong>${answeredQuestions.length}</strong> questions have been answered with an average confidence of 
            <strong>${Math.round((extractedAnswers.answerSummary?.averageConfidence || 0) * 100)}%</strong></p>
        </div>

        ${answeredQuestions.map(qa => `
            <div class="question-block">
                <div class="question-text">Q: ${qa.question}</div>
                <div class="answer-text">${qa.answer}</div>
                <div style="margin-top: 1rem;">
                    <span class="confidence-${this.getConfidenceLevel(qa.confidence)}">
                        Confidence: ${Math.round((qa.confidence || 0) * 100)}%
                    </span>
                    ${qa.sources && qa.sources.length > 0 ? `
                        <div class="source-ref">
                            Sources: ${qa.sources.map(s => s.documentName).join(', ')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('')}
    `;
  }

  generateUnansweredQuestionsHTML(extractedAnswers) {
    const unansweredQuestions = extractedAnswers?.unansweredQuestions || [];

    if (unansweredQuestions.length === 0) {
      return '<div class="success-box"><p>All questions have been addressed!</p></div>';
    }

    return `
        <div class="warning-box">
            <p><strong>${unansweredQuestions.length}</strong> questions require additional attention</p>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Question</th>
                    <th>Reason</th>
                    <th>Priority</th>
                    <th>Suggested Sources</th>
                </tr>
            </thead>
            <tbody>
                ${unansweredQuestions.map(q => `
                    <tr>
                        <td>${q.question}</td>
                        <td>${q.reason}</td>
                        <td><span class="priority-${q.priority}">${q.priority?.toUpperCase()}</span></td>
                        <td>${(q.suggestedSources || []).join(', ') || 'None specified'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
  }

  generateClarificationQuestionsHTML(clarificationQuestions) {
    const questionCategories = clarificationQuestions?.questionCategories || {};
    const summary = clarificationQuestions?.questionSummary || {};

    return `
        <div class="info-box">
            <p><strong>Total Questions:</strong> ${summary.totalQuestions || 0}</p>
            <p><strong>High Priority:</strong> ${summary.highPriority || 0}</p>
            <p><strong>Medium Priority:</strong> ${summary.mediumPriority || 0}</p>
            <p><strong>Low Priority:</strong> ${summary.lowPriority || 0}</p>
        </div>

        ${Object.entries(questionCategories).map(([category, questions]) => `
            <h3>${category.charAt(0).toUpperCase() + category.slice(1)} Questions (${questions.length})</h3>
            <table>
                <thead>
                    <tr>
                        <th>Question</th>
                        <th>Priority</th>
                        <th>Impact</th>
                        <th>Rationale</th>
                    </tr>
                </thead>
                <tbody>
                    ${questions.map(q => `
                        <tr>
                            <td>${q.question}</td>
                            <td><span class="priority-${q.priority}">${q.priority?.toUpperCase()}</span></td>
                            <td>${q.impact || 'Not specified'}</td>
                            <td>${q.rationale || 'Not provided'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `).join('')}
    `;
  }

  generateGapAnalysisHTML(compiledResponse) {
    const gapsAndActions = compiledResponse?.gapsAndActions || {};
    const criticalGaps = gapsAndActions.criticalGaps || [];
    const reviewItems = gapsAndActions.reviewItems || [];

    return `
        <h3>Critical Gaps</h3>
        ${criticalGaps.length > 0 ? `
            <table>
                <thead>
                    <tr>
                        <th>Area</th>
                        <th>Description</th>
                        <th>Impact</th>
                        <th>Recommended Action</th>
                        <th>Priority</th>
                    </tr>
                </thead>
                <tbody>
                    ${criticalGaps.map(gap => `
                        <tr>
                            <td>${gap.area}</td>
                            <td>${gap.description}</td>
                            <td><span class="priority-${gap.impact}">${gap.impact?.toUpperCase()}</span></td>
                            <td>${gap.recommendedAction}</td>
                            <td>${gap.priority}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        ` : '<div class="success-box"><p>No critical gaps identified!</p></div>'}

        <h3>Items Requiring Review</h3>
        ${reviewItems.length > 0 ? `
            <ul>
                ${reviewItems.map(item => `
                    <li><strong>${item.item}:</strong> ${item.reason} (Section: ${item.section})</li>
                `).join('')}
            </ul>
        ` : '<p>No items require additional review.</p>'}
    `;
  }

  generateRecommendationsHTML(compiledResponse) {
    const nextSteps = compiledResponse?.nextSteps || {};
    const qualityAssurance = compiledResponse?.qualityAssurance || {};

    return `
        <h3>Immediate Actions</h3>
        <ul>
            ${(nextSteps.immediateActions || ['Review generated content', 'Address identified gaps']).map(action => 
                `<li>${action}</li>`
            ).join('')}
        </ul>

        <h3>Quality Assessment</h3>
        <div class="info-box">
            <p><strong>Completeness Score:</strong> ${Math.round((qualityAssurance.completenessScore || 0) * 100)}%</p>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${(qualityAssurance.completenessScore || 0) * 100}%"></div>
            </div>
            <p><strong>Consistency Check:</strong> ${qualityAssurance.consistencyCheck || 'Not performed'}</p>
            <p><strong>Estimated Effort:</strong> ${qualityAssurance.estimatedEffort || 'Not estimated'}</p>
        </div>

        <h3>Recommended Reviews</h3>
        <ul>
            ${(qualityAssurance.recommendedReviews || ['Technical review', 'Business review']).map(review => 
                `<li>${review}</li>`
            ).join('')}
        </ul>
    `;
  }

  generateAppendicesHTML(workflowResults) {
    const { ingestedDocuments } = workflowResults;

    return `
        <h3>Source Documents</h3>
        <table>
            <thead>
                <tr>
                    <th>Document Name</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Processed</th>
                </tr>
            </thead>
            <tbody>
                ${(ingestedDocuments || []).map(doc => `
                    <tr>
                        <td>${doc.fileName}</td>
                        <td>${doc.documentType || 'Unknown'}</td>
                        <td>${this.formatFileSize(doc.metadata?.size || 0)}</td>
                        <td>${doc.processed !== false ? 'Yes' : 'No'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <h3>Processing Information</h3>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Processing Time:</strong> ${workflowResults.duration || 'Not available'}</p>
        <p><strong>System Version:</strong> 1.0.0</p>
    `;
  }

  getHeaderTemplate(projectContext) {
    return `
        <div style="font-size: 10px; color: #666; width: 100%; text-align: center; margin-top: 10px;">
            RFP Analysis Report - ${projectContext?.title || 'Untitled Project'}
        </div>
    `;
  }

  getFooterTemplate() {
    return `
        <div style="font-size: 10px; color: #666; width: 100%; text-align: center; margin-bottom: 10px;">
            <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>
    `;
  }

  getConfidenceLevel(confidence) {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  }

  countRequirements(requirementsAnalysis) {
    if (!requirementsAnalysis?.requirements) return 0;
    
    let count = 0;
    Object.values(requirementsAnalysis.requirements).forEach(reqs => {
      if (Array.isArray(reqs)) count += reqs.length;
    });
    return count;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('PDF generator closed');
    }
  }
}

module.exports = new PDFGenerator();