import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from 'react-query';
import { 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Download,
  Eye,
  ChevronDown,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

const Results = () => {
  const { workflowId } = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedSections, setExpandedSections] = useState({
    'answered': true, // Expand answered questions by default
    'unanswered': true // Expand unanswered questions by default
  });

  // Helper functions to count data
  const countRequirements = (requirementsAnalysis, directRequirements) => {
    // Check direct requirements array first (new structure)
    if (directRequirements && Array.isArray(directRequirements)) {
      return directRequirements.length;
    }
    // Fallback to nested structure (old structure)
    if (!requirementsAnalysis?.requirements) return 0;
    let count = 0;
    Object.values(requirementsAnalysis.requirements).forEach(reqs => {
      if (Array.isArray(reqs)) count += reqs.length;
    });
    return count;
  };

  const countQuestions = (clarificationQuestions, directQuestions) => {
    // Check direct questions array first (new structure)
    if (directQuestions && Array.isArray(directQuestions)) {
      return directQuestions.length;
    }
    // Fallback to nested structure (old structure)
    if (!clarificationQuestions?.questionCategories) return 0;
    let count = 0;
    Object.values(clarificationQuestions.questionCategories).forEach(questions => {
      if (Array.isArray(questions)) count += questions.length;
    });
    return count;
  };

  const countAnsweredQuestions = (extractedAnswers, directAnswers) => {
    // Check direct answers array first (new structure)
    if (directAnswers && Array.isArray(directAnswers)) {
      return directAnswers.length;
    }
    // Fallback to nested structure (old structure)
    return extractedAnswers?.answeredQuestions?.length || 0;
  };

  // Fetch workflow results
  const { data: results, isLoading, refetch } = useQuery(
    ['workflow-results', workflowId],
    () => fetch(`/api/rfp/workflow/${workflowId}`).then(res => res.json()),
    { enabled: !!workflowId }
  );

  // Retry workflow mutation
  const retryMutation = useMutation(
    ({ workflowId, fromStep }) => fetch(`/api/rfp/workflow/${workflowId}/retry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fromStep })
    }).then(res => res.json()),
    {
      onSuccess: () => {
        refetch();
      },
      onError: (error) => {
        console.error('Failed to retry workflow:', error);
        alert('Failed to retry workflow. Please try again.');
      }
    }
  );

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const tabs = [
    { id: 'overview', name: 'Overview', icon: Eye },
    { id: 'requirements', name: 'Requirements', icon: FileText },
    { id: 'questions', name: 'Questions', icon: AlertCircle },
    { id: 'answers', name: 'Answers', icon: CheckCircle },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!results || results.error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Results not available</h3>
        <p className="mt-1 text-sm text-gray-500">
          The results for this workflow are not yet available or the workflow is still processing.
        </p>
      </div>
    );
  }

  const { requirementsAnalysis, clarificationQuestions, extractedAnswers, compiledResponse } = results.results || {};
  
  // Calculate summary statistics from the actual data
  const summary = {
    documentsProcessed: results.documents?.length || 0,
    requirementsIdentified: countRequirements(requirementsAnalysis, results.requirements),
    questionsGenerated: countQuestions(clarificationQuestions, results.questions),
    questionsAnswered: countAnsweredQuestions(extractedAnswers, results.answers)
  };

  const OverviewTab = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <FileText className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Documents</p>
              <p className="text-2xl font-semibold text-gray-900">
                {summary.documentsProcessed}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Requirements</p>
              <p className="text-2xl font-semibold text-gray-900">
                {summary.requirementsIdentified}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <AlertCircle className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Questions</p>
              <p className="text-2xl font-semibold text-gray-900">
                {summary.questionsGenerated}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Answered</p>
              <p className="text-2xl font-semibold text-gray-900">
                {summary.questionsAnswered}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Documents Section */}
      {results.documents && Array.isArray(results.documents) && results.documents.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Processed Documents</h3>
          <div className="space-y-4">
            {results.documents.map((doc, index) => (
              <div key={doc.id || index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 text-blue-600 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {doc.original_name || doc.filename || doc.id}
                        </p>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className="text-xs text-gray-500">
                            Size: {doc.file_size ? (doc.file_size / 1024).toFixed(1) + ' KB' : 'Unknown'}
                          </span>
                          <span className="text-xs text-gray-500">
                            Type: {doc.mime_type || 'Unknown'}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            doc.processing_status === 'completed' ? 'bg-green-100 text-green-800' :
                            doc.processing_status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                            doc.processing_status === 'pending' ? 'bg-gray-100 text-gray-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {doc.processing_status || 'Unknown'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        // Download document
                        const downloadUrl = `/api/documents/download/${doc.id}`;
                        const link = document.createElement('a');
                        link.href = downloadUrl;
                        link.download = doc.original_name || doc.filename || doc.id;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </button>
                    <button
                      onClick={() => {
                        // View document details
                        window.open(`/api/documents/view/${doc.id}`, '_blank');
                      }}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </button>
                  </div>
                </div>
                {doc.metadata && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      Uploaded: {new Date(doc.created_at).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Project Overview */}
      {requirementsAnalysis?.projectOverview && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Project Overview</h3>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-500">Title</h4>
              <p className="mt-1 text-sm text-gray-900">{requirementsAnalysis.projectOverview.title}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Description</h4>
              <p className="mt-1 text-sm text-gray-900">{requirementsAnalysis.projectOverview.description}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Scope</h4>
              <p className="mt-1 text-sm text-gray-900">{requirementsAnalysis.projectOverview.scope}</p>
            </div>
          </div>
        </div>
      )}

      {/* Completeness Score */}
      {compiledResponse?.qualityAssurance && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quality Assessment</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm">
                <span>Completeness Score</span>
                <span>{Math.round((compiledResponse.qualityAssurance.completenessScore || 0) * 100)}%</span>
              </div>
              <div className="mt-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${(compiledResponse.qualityAssurance.completenessScore || 0) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const RequirementsTab = () => {
    // Use direct requirements array if available, otherwise fall back to nested structure
    const requirementsToShow = results.requirements || requirementsAnalysis?.requirements;
    
    // If direct array, group by category
    let requirementsByCategory = {};
    if (Array.isArray(requirementsToShow)) {
      requirementsToShow.forEach(req => {
        const category = req.category || 'general';
        if (!requirementsByCategory[category]) {
          requirementsByCategory[category] = [];
        }
        requirementsByCategory[category].push(req);
      });
    } else if (requirementsToShow && typeof requirementsToShow === 'object') {
      requirementsByCategory = requirementsToShow;
    }

    return (
      <div className="space-y-6">
        {Object.keys(requirementsByCategory).length > 0 && Object.entries(requirementsByCategory).map(([category, reqs]) => {
          if (!Array.isArray(reqs)) return null;
          return (
          <div key={category} className="bg-white shadow rounded-lg">
            <div 
              className="px-6 py-4 border-b border-gray-200 cursor-pointer"
              onClick={() => toggleSection(category)}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 capitalize">
                  {category} Requirements ({reqs.length})
                </h3>
                {expandedSections[category] ? 
                  <ChevronDown className="h-5 w-5 text-gray-500" /> : 
                  <ChevronRight className="h-5 w-5 text-gray-500" />
                }
              </div>
            </div>
            
            {expandedSections[category] && (
              <div className="px-6 py-4">
                <div className="space-y-4">
                  {reqs.map((req, index) => (
                    <div key={req.id || index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{req.description}</p>
                          <div className="mt-2 flex items-center space-x-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              req.priority === 'high' ? 'bg-red-100 text-red-800' :
                              req.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {req.priority} priority
                            </span>
                            {req.complexity && (
                              <span className="text-xs text-gray-500">
                                Complexity: {req.complexity}
                              </span>
                            )}
                            {req.mandatory !== undefined && (
                              <span className={`text-xs ${req.mandatory ? 'text-red-600' : 'text-gray-500'}`}>
                                {req.mandatory ? 'Mandatory' : 'Optional'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          );
        })}
        {Object.keys(requirementsByCategory).length === 0 && (
          <div className="text-center py-8">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No requirements found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Requirements analysis may still be processing or no requirements were identified.
            </p>
          </div>
        )}
      </div>
    );
  };

  const QuestionsTab = () => {
    // Use direct questions array if available, otherwise fall back to nested structure
    const questionsToShow = results.questions || clarificationQuestions?.questionCategories;
    
    // If direct array, group by category
    let questionsByCategory = {};
    if (Array.isArray(questionsToShow)) {
      questionsToShow.forEach(q => {
        const category = q.category || 'general';
        if (!questionsByCategory[category]) {
          questionsByCategory[category] = [];
        }
        questionsByCategory[category].push(q);
      });
    } else if (questionsToShow && typeof questionsToShow === 'object') {
      questionsByCategory = questionsToShow;
    }

    return (
      <div className="space-y-6">
        {Object.keys(questionsByCategory).length > 0 && Object.entries(questionsByCategory).map(([category, questions]) => {
          if (!Array.isArray(questions)) return null;
          return (
          <div key={category} className="bg-white shadow rounded-lg">
            <div 
              className="px-6 py-4 border-b border-gray-200 cursor-pointer"
              onClick={() => toggleSection(`questions-${category}`)}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 capitalize">
                  {category} Questions ({questions.length})
                </h3>
                {expandedSections[`questions-${category}`] ? 
                  <ChevronDown className="h-5 w-5 text-gray-500" /> : 
                  <ChevronRight className="h-5 w-5 text-gray-500" />
                }
              </div>
            </div>
            
            {expandedSections[`questions-${category}`] && (
              <div className="px-6 py-4">
                <div className="space-y-4">
                  {questions.map((question, index) => (
                    <div key={question.id || index} className="border border-gray-200 rounded-lg p-4">
                      <p className="text-sm font-medium text-gray-900 mb-2">
                        {question.questionText || question.question}
                      </p>
                      <p className="text-sm text-gray-600 mb-3">{question.rationale}</p>
                      {question.impact && (
                        <p className="text-sm text-gray-600 mb-3">
                          <span className="font-medium">Impact:</span> {question.impact}
                        </p>
                      )}
                      <div className="flex items-center space-x-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          question.priority === 'high' ? 'bg-red-100 text-red-800' :
                          question.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {question.priority} priority
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          );
        })}
        {Object.keys(questionsByCategory).length === 0 && (
          <div className="text-center py-8">
            <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No questions found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Question generation may still be processing or no questions were generated.
            </p>
          </div>
        )}
      </div>
    );
  };

  const AnswersTab = () => {
    // Use direct answers array if available, otherwise fall back to nested structure
    const answersToShow = results.answers || extractedAnswers?.answeredQuestions;
    const questionsToShow = results.questions || [];
    const unansweredToShow = extractedAnswers?.unansweredQuestions;

    // Debug logging (can be removed in production)
    // console.log('AnswersTab Debug - answersToShow:', answersToShow);
    // console.log('AnswersTab Debug - questionsToShow:', questionsToShow);

    // Create a map of question id to question text for easy lookup
    const questionMap = {};
    if (questionsToShow && Array.isArray(questionsToShow)) {
      questionsToShow.forEach(q => {
        // Handle both database format (question_id) and memory format (id)
        const questionId = q.question_id || q.id;
        const questionText = q.question_text || q.questionText;
        questionMap[questionId] = questionText;
      });
    }

    // Create combined data with questions that have answers and questions that don't
    const allQuestionsWithAnswers = [];
    
    if (questionsToShow && Array.isArray(questionsToShow)) {
      questionsToShow.forEach(question => {
        const questionId = question.question_id || question.id;
        const questionText = question.question_text || question.questionText;
        
        // Find corresponding answer - handle both database format (question_id) and memory format (questionId)
        const answer = answersToShow && Array.isArray(answersToShow) ? 
          answersToShow.find(a => (a.question_id === questionId) || (a.questionId === questionId)) : null;
        
        allQuestionsWithAnswers.push({
          questionId: questionId,
          questionText: questionText,
          answer: answer ? (answer.answer_text || answer.answerText || answer.answer) : null,
          confidence: answer ? (answer.confidence_score || answer.confidenceScore || answer.confidence) : null,
          sources: answer ? (typeof answer.sources === 'string' ? JSON.parse(answer.sources) : answer.sources) : [],
          answerType: answer ? (answer.answer_type || answer.answerType || answer.type) : null,
          hasAnswer: !!answer
        });
      });
    }

    const answeredQuestions = allQuestionsWithAnswers.filter(q => q.hasAnswer);
    const unansweredQuestions = allQuestionsWithAnswers.filter(q => !q.hasAnswer);

    return (
      <div className="space-y-6">
        {/* Answered Questions */}
        {answeredQuestions.length > 0 && (
          <div className="bg-white shadow rounded-lg">
            <div 
              className="px-6 py-4 border-b border-gray-200 cursor-pointer"
              onClick={() => toggleSection('answered')}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Answered Questions ({answeredQuestions.length})
                </h3>
                {expandedSections['answered'] ? 
                  <ChevronDown className="h-5 w-5 text-gray-500" /> : 
                  <ChevronRight className="h-5 w-5 text-gray-500" />
                }
              </div>
            </div>
            
            {expandedSections['answered'] && (
              <div className="px-6 py-4">
                <div className="space-y-6">
                  {answeredQuestions.map((qa, index) => (
                    <div key={qa.questionId || index} className="border border-gray-200 rounded-lg p-4">
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-900 mb-2">
                          Q: {qa.questionText || 'Question text not available'}
                        </p>
                        <p className="text-sm text-gray-700">{qa.answer || 'Answer not available'}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          {qa.confidence !== undefined && qa.confidence !== null && (
                            <span className={`text-xs font-medium ${
                              qa.confidence >= 0.8 ? 'text-green-600' :
                              qa.confidence >= 0.6 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              Confidence: {Math.round((qa.confidence || 0) * 100)}%
                            </span>
                          )}
                          {qa.sources && Array.isArray(qa.sources) && qa.sources.length > 0 && (
                            <span className="text-xs text-gray-500">
                              Sources: {qa.sources.map(s => s.documentName || s.name || s.documentId || 'Unknown').join(', ')}
                            </span>
                          )}
                          {qa.answerType && (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              qa.answerType === 'direct' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {qa.answerType}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Unanswered Questions */}
        {unansweredQuestions.length > 0 && (
          <div className="bg-white shadow rounded-lg">
            <div 
              className="px-6 py-4 border-b border-gray-200 cursor-pointer"
              onClick={() => toggleSection('unanswered')}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Unanswered Questions ({unansweredQuestions.length})
                </h3>
                {expandedSections['unanswered'] ? 
                  <ChevronDown className="h-5 w-5 text-gray-500" /> : 
                  <ChevronRight className="h-5 w-5 text-gray-500" />
                }
              </div>
            </div>
            
            {expandedSections['unanswered'] && (
              <div className="px-6 py-4">
                <div className="space-y-4">
                  {unansweredQuestions.map((question, index) => (
                    <div key={question.questionId || index} className="border border-red-200 rounded-lg p-4 bg-red-50">
                      <p className="text-sm font-medium text-gray-900 mb-2">
                        Q: {question.questionText}
                      </p>
                      <p className="text-sm text-red-700 mb-2">No answer found in the uploaded documents</p>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Unanswered
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Unanswered Questions */}
        {unansweredToShow && Array.isArray(unansweredToShow) && unansweredToShow.length > 0 && (
          <div className="bg-white shadow rounded-lg">
            <div 
              className="px-6 py-4 border-b border-gray-200 cursor-pointer"
              onClick={() => toggleSection('unanswered')}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Unanswered Questions ({unansweredToShow.length})
                </h3>
                {expandedSections['unanswered'] ? 
                  <ChevronDown className="h-5 w-5 text-gray-500" /> : 
                  <ChevronRight className="h-5 w-5 text-gray-500" />
                }
              </div>
            </div>
            
            {expandedSections['unanswered'] && (
              <div className="px-6 py-4">
                <div className="space-y-4">
                  {unansweredToShow.map((question, index) => (
                    <div key={question.id || index} className="border border-red-200 rounded-lg p-4 bg-red-50">
                      <p className="text-sm font-medium text-gray-900 mb-2">
                        {question.questionText || question.question}
                      </p>
                      <p className="text-sm text-red-700 mb-2">Reason: {question.reason}</p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        question.priority === 'high' ? 'bg-red-100 text-red-800' :
                        question.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {question.priority} priority
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* No answers message */}
        {(!answersToShow || answersToShow.length === 0) && 
         (!unansweredToShow || unansweredToShow.length === 0) && (
          <div className="text-center py-8">
            <CheckCircle className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No answers available</h3>
            <p className="mt-1 text-sm text-gray-500">
              Answer extraction may still be processing or no answers were found.
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">RFP Analysis Results</h1>
          <p className="mt-1 text-sm text-gray-500">
            Workflow ID: {workflowId}
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to retry this workflow? This will restart the processing from the beginning.')) {
                retryMutation.mutate({ workflowId, fromStep: null });
              }
            }}
            disabled={retryMutation.isLoading}
            className="inline-flex items-center px-4 py-2 border border-orange-300 shadow-sm text-sm font-medium rounded-md text-orange-700 bg-white hover:bg-orange-50 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {retryMutation.isLoading ? 'Retrying...' : 'Retry Workflow'}
          </button>
          <button
            onClick={() => {
              // Download PDF logic
              fetch(`/api/generate-pdf/${workflowId}`, { method: 'POST' })
                .then(response => response.blob())
                .then(blob => {
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `rfp-analysis-${workflowId}.pdf`;
                  a.click();
                });
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Download PDF Report
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>
        
        <div className="p-6">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'requirements' && <RequirementsTab />}
          {activeTab === 'questions' && <QuestionsTab />}
          {activeTab === 'answers' && <AnswersTab />}
        </div>
      </div>
    </div>
  );
};

export default Results;