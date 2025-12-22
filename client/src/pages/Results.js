import { useState } from 'react';
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
  RefreshCw,
  Edit2,
  Trash2,
  Save,
  X,
  Upload,
  FileSpreadsheet,
  Share2,
  Cloud,
  Layers
} from 'lucide-react';
import MindmapViewer from '../components/MindmapViewer';
import ArchitectureAnalysis from '../components/ArchitectureAnalysis';
import ArchitectureDiagram from '../components/ArchitectureDiagram';
import KnowledgeGraph from '../components/KnowledgeGraph';

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
        window.alert('Failed to retry workflow. Please try again.');
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
    { id: 'mindmap', name: 'Mindmap', icon: Share2 },
    { id: 'architecture', name: 'Architecture Analysis', icon: Cloud },
    { id: 'diagram', name: 'Architecture Diagram', icon: Layers },
    { id: 'knowledge-graph', name: 'Knowledge Graph', icon: Share2 },
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
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          {results?.error === 'Workflow not found' ? 'Workflow Not Found' : 'Results not available'}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          {results?.error === 'Workflow not found' 
            ? `Workflow ${workflowId} does not exist. It may have been deleted or the ID is incorrect.`
            : 'The results for this workflow are not yet available or the workflow is still processing.'
          }
        </p>
        {results?.error === 'Workflow not found' && (
          <div className="mt-4">
            <button
              onClick={() => window.location.href = '/'}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              Go to Dashboard
            </button>
          </div>
        )}
        {results?.error && results.error !== 'Workflow not found' && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">Error: {results.error}</p>
            {results.details && (
              <p className="text-xs text-red-600 mt-1">{results.details}</p>
            )}
          </div>
        )}
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
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState(null);
    const [isGeneratingAnswers, setIsGeneratingAnswers] = useState(false);
    const [showUploadForm, setShowUploadForm] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    
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

    // Count unanswered questions
    const allQuestions = Array.isArray(questionsToShow) ? questionsToShow : 
      Object.values(questionsByCategory).flat();
    const answeredQuestionIds = new Set(
      (results.answers || []).map(answer => answer.question_id)
    );
    const unansweredCount = allQuestions.filter(
      q => !answeredQuestionIds.has(q.question_id)
    ).length;

    const handleGenerateMissingAnswers = async () => {
      if (unansweredCount === 0) {
        window.alert('All questions already have answers!');
        return;
      }

      if (!window.confirm(`Generate answers for ${unansweredCount} unanswered questions? This may take a few moments.`)) {
        return;
      }

      setIsGeneratingAnswers(true);
      try {
        const response = await fetch(`/api/rfp/workflow/${workflowId}/generate-missing-answers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const result = await response.json();
          window.alert(`Successfully generated ${result.newAnswers} new answers out of ${result.processedQuestions} processed questions.`);
          refetch(); // Refresh the data
        } else {
          const error = await response.json();
          window.alert('Failed to generate answers: ' + error.error);
        }
      } catch (error) {
        window.alert('Failed to generate answers: ' + error.message);
      } finally {
        setIsGeneratingAnswers(false);
      }
    };

    const handleExcelUpload = async (file) => {
      if (!file) {
        window.alert('Please select a file to upload');
        return;
      }

      // Validate file type
      const allowedTypes = ['.xlsx', '.xls', '.csv'];
      const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (!allowedTypes.includes(fileExt)) {
        window.alert('Please upload an Excel file (.xlsx, .xls) or CSV file (.csv)');
        return;
      }

      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('questionsFile', file);

        const response = await fetch(`/api/rfp/workflow/${workflowId}/upload-questions`, {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const result = await response.json();
          let message = `Successfully uploaded ${result.savedQuestions} questions from Excel file.`;
          
          if (result.validationErrors && result.validationErrors.length > 0) {
            message += `\n\nValidation errors:\n${result.validationErrors.join('\n')}`;
          }
          
          if (result.saveErrors && result.saveErrors.length > 0) {
            message += `\n\nSave errors:\n${result.saveErrors.join('\n')}`;
          }

          window.alert(message);
          setShowUploadForm(false);
          refetch(); // Refresh the data
        } else {
          const error = await response.json();
          window.alert('Failed to upload questions: ' + error.error);
        }
      } catch (error) {
        window.alert('Failed to upload questions: ' + error.message);
      } finally {
        setIsUploading(false);
      }
    };

    const downloadTemplate = () => {
      const link = document.createElement('a');
      link.href = '/api/rfp/questions-template';
      link.download = 'questions-template.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    return (
      <div className="space-y-6">
        {/* Manage Questions Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Manage Questions</h3>
            <div className="flex items-center space-x-3">
              {unansweredCount > 0 && (
                <button
                  onClick={handleGenerateMissingAnswers}
                  disabled={isGeneratingAnswers}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isGeneratingAnswers ? 'animate-spin' : ''}`} />
                  {isGeneratingAnswers ? 'Generating...' : `Generate Answers (${unansweredCount})`}
                </button>
              )}
              <button
                onClick={downloadTemplate}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </button>
              <button
                onClick={() => setShowUploadForm(!showUploadForm)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700"
              >
                <Upload className="h-4 w-4 mr-2" />
                {showUploadForm ? 'Cancel Upload' : 'Upload Excel'}
              </button>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                {showAddForm ? 'Cancel' : 'Add Single Question'}
              </button>
            </div>
          </div>
          
          {unansweredCount > 0 && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                <AlertCircle className="h-4 w-4 inline mr-1" />
                {unansweredCount} question{unansweredCount !== 1 ? 's' : ''} without answers. 
                Click "Generate Answers" to automatically create answers using available documents.
              </p>
            </div>
          )}
          
          {showAddForm && (
            <AddQuestionForm 
              workflowId={workflowId}
              onSuccess={() => {
                setShowAddForm(false);
                refetch();
              }}
              onCancel={() => setShowAddForm(false)}
            />
          )}

          {showUploadForm && (
            <ExcelUploadForm 
              onUpload={handleExcelUpload}
              onCancel={() => setShowUploadForm(false)}
              isUploading={isUploading}
            />
          )}
        </div>

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
                    <QuestionCard 
                      key={question.id || question.question_id || index}
                      question={question}
                      workflowId={workflowId}
                      onEdit={setEditingQuestion}
                      onUpdate={refetch}
                      hasAnswer={answeredQuestionIds.has(question.question_id)}
                    />
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
        
        {editingQuestion && (
          <EditQuestionModal
            question={editingQuestion}
            workflowId={workflowId}
            onClose={() => setEditingQuestion(null)}
            onUpdate={refetch}
          />
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
          {activeTab === 'mindmap' && <MindmapViewer workflowId={workflowId} />}
          {activeTab === 'architecture' && <ArchitectureAnalysis workflowId={workflowId} />}
          {activeTab === 'diagram' && <ArchitectureDiagram workflowId={workflowId} />}
          {activeTab === 'knowledge-graph' && <KnowledgeGraph workflowId={workflowId} />}
        </div>
      </div>
    </div>
  );
};

// Component for individual question cards with edit/delete functionality
const QuestionCard = ({ question, workflowId, onEdit, onUpdate, hasAnswer }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteQuestion = async () => {
    if (!question.is_custom) {
      window.alert('Only custom questions can be deleted');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this question?')) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/rfp/workflow/${workflowId}/questions/${question.question_id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        onUpdate();
      } else {
        const error = await response.json();
        window.alert('Failed to delete question: ' + error.error);
      }
    } catch (error) {
      window.alert('Failed to delete question: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={`border rounded-lg p-4 ${hasAnswer ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <p className="text-sm font-medium text-gray-900 flex-1">
              {question.question_text || question.questionText || question.question}
            </p>
            <span className={`ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              hasAnswer ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {hasAnswer ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Answered
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 mr-1" />
                  No Answer
                </>
              )}
            </span>
          </div>
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
            {question.is_custom && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Custom
              </span>
            )}
          </div>
        </div>
        
        {question.is_custom && (
          <div className="flex items-center space-x-2 ml-4">
            <button
              onClick={() => onEdit(question)}
              className="p-1 text-gray-400 hover:text-blue-600"
              title="Edit question"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={deleteQuestion}
              disabled={isDeleting}
              className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
              title="Delete question"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Component for adding new questions
const AddQuestionForm = ({ workflowId, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    category: 'technical',
    question_text: '',
    rationale: '',
    priority: 'medium',
    impact: '',
    related_requirements: []
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.question_text.trim()) {
      window.alert('Question text is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/rfp/workflow/${workflowId}/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        window.alert('Failed to add question: ' + error.error);
      }
    } catch (error) {
      window.alert('Failed to add question: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <h4 className="text-md font-medium text-gray-900 mb-4">Add Custom Question</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category *
          </label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            required
          >
            <option value="technical">Technical</option>
            <option value="business">Business</option>
            <option value="timeline">Timeline</option>
            <option value="budget">Budget</option>
            <option value="compliance">Compliance</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Priority *
          </label>
          <select
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            required
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Question Text *
        </label>
        <textarea
          value={formData.question_text}
          onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          rows={3}
          placeholder="Enter your question here..."
          required
        />
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Rationale
        </label>
        <textarea
          value={formData.rationale}
          onChange={(e) => setFormData({ ...formData, rationale: e.target.value })}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          rows={2}
          placeholder="Why is this question important?"
        />
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Impact
        </label>
        <textarea
          value={formData.impact}
          onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          rows={2}
          placeholder="What is the impact if this question is not answered?"
        />
      </div>
      
      <div className="flex items-center space-x-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSubmitting ? 'Adding...' : 'Add Question'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          <X className="h-4 w-4 mr-2" />
          Cancel
        </button>
      </div>
    </form>
  );
};

// Component for uploading questions from Excel
const ExcelUploadForm = ({ onUpload, onCancel, isUploading }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = (file) => {
    setSelectedFile(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedFile) {
      onUpload(selectedFile);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
      <h4 className="text-md font-medium text-gray-900 mb-4">Upload Questions from Excel</h4>
      
      <form onSubmit={handleSubmit}>
        {/* File Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors mb-4 ${
            dragActive 
              ? 'border-purple-400 bg-purple-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => document.getElementById('excel-file-input').click()}
        >
          <input
            id="excel-file-input"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => e.target.files[0] && handleFileSelect(e.target.files[0])}
            className="hidden"
          />
          
          <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          
          {selectedFile ? (
            <div>
              <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
              <p className="text-xs text-gray-500 mt-1">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600">
                {dragActive
                  ? 'Drop the Excel file here...'
                  : 'Drag & drop an Excel file here, or click to select'
                }
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Supports .xlsx, .xls, and .csv files
              </p>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <h5 className="text-sm font-medium text-blue-900 mb-2">Excel File Format:</h5>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• <strong>Column A:</strong> Category (technical, business, timeline, budget, compliance)</li>
            <li>• <strong>Column B:</strong> Question Text (required)</li>
            <li>• <strong>Column C:</strong> Rationale (optional)</li>
            <li>• <strong>Column D:</strong> Priority (high, medium, low)</li>
            <li>• <strong>Column E:</strong> Impact (optional)</li>
            <li>• <strong>Column F:</strong> Related Requirements (optional, semicolon-separated)</li>
          </ul>
          <p className="text-xs text-blue-700 mt-2">
            Download the template above for the correct format.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <button
            type="submit"
            disabled={!selectedFile || isUploading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
          >
            <Upload className="h-4 w-4 mr-2" />
            {isUploading ? 'Uploading...' : 'Upload Questions'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

// Component for editing existing questions
const EditQuestionModal = ({ question, workflowId, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    category: question.category || 'technical',
    question_text: question.question_text || question.questionText || question.question || '',
    rationale: question.rationale || '',
    priority: question.priority || 'medium',
    impact: question.impact || '',
    related_requirements: question.related_requirements || []
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.question_text.trim()) {
      window.alert('Question text is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/rfp/workflow/${workflowId}/questions/${question.question_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        onUpdate();
        onClose();
      } else {
        const error = await response.json();
        window.alert('Failed to update question: ' + error.error);
      }
    } catch (error) {
      window.alert('Failed to update question: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Edit Question</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                required
              >
                <option value="technical">Technical</option>
                <option value="business">Business</option>
                <option value="timeline">Timeline</option>
                <option value="budget">Budget</option>
                <option value="compliance">Compliance</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority *
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                required
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Question Text *
            </label>
            <textarea
              value={formData.question_text}
              onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              rows={3}
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rationale
            </label>
            <textarea
              value={formData.rationale}
              onChange={(e) => setFormData({ ...formData, rationale: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              rows={2}
            />
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Impact
            </label>
            <textarea
              value={formData.impact}
              onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              rows={2}
            />
          </div>
          
          <div className="flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Updating...' : 'Update Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Results;