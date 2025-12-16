import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from 'react-query';
import io from 'socket.io-client';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  FileText,
  Download,
  RefreshCw
} from 'lucide-react';

const Workflow = () => {
  const { workflowId } = useParams();
  const [socket, setSocket] = useState(null);
  const [progress, setProgress] = useState(null);

  // Fetch workflow status
  const { data: workflow, isLoading, refetch } = useQuery(
    ['workflow', workflowId],
    () => fetch(`/api/rfp/workflow/${workflowId}`).then(res => res.json()),
    { 
      refetchInterval: (data) => data?.status === 'running' ? 2000 : false,
      enabled: !!workflowId
    }
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

  // Set up Socket.IO connection
  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.emit('join-workflow', workflowId);

    newSocket.on('workflow-progress', (progressData) => {
      if (progressData.workflowId === workflowId) {
        setProgress(progressData);
      }
    });

    newSocket.on('workflow-complete', (result) => {
      if (result.workflowId === workflowId) {
        refetch();
      }
    });

    newSocket.on('workflow-error', (error) => {
      if (error.workflowId === workflowId) {
        refetch();
      }
    });

    return () => {
      newSocket.emit('leave-workflow', workflowId);
      newSocket.close();
    };
  }, [workflowId, refetch]);

  const steps = [
    { id: 'document_ingestion', name: 'Document Ingestion', description: 'Processing uploaded documents' },
    { id: 'requirements_analysis', name: 'Requirements Analysis', description: 'Analyzing project requirements' },
    { id: 'clarification_questions', name: 'Question Generation', description: 'Generating clarification questions' },
    { id: 'answer_extraction', name: 'Answer Extraction', description: 'Extracting answers from company documents' },
    { id: 'response_compilation', name: 'Response Compilation', description: 'Compiling final response' }
  ];

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

  // Calculate summary from workflow results
  const workflowResults = workflow?.results || {};
  const summary = {
    documentsProcessed: workflow?.documents?.length || workflowResults?.ingestedDocuments?.length || 0,
    requirementsFound: countRequirements(workflowResults?.requirementsAnalysis, workflow?.requirements),
    questionsGenerated: countQuestions(workflowResults?.clarificationQuestions, workflow?.questions)
  };

  const getStepStatus = (stepId) => {
    if (!workflow) return 'pending';
    
    const currentStepIndex = steps.findIndex(s => s.id === workflow.currentStep);
    const stepIndex = steps.findIndex(s => s.id === stepId);
    
    if (workflow.status === 'failed' && stepIndex === currentStepIndex) {
      return 'failed';
    }
    
    if (stepIndex < currentStepIndex) {
      return 'completed';
    } else if (stepIndex === currentStepIndex && workflow.status === 'running') {
      return 'running';
    } else if (workflow.status === 'completed') {
      return 'completed';
    }
    
    return 'pending';
  };

  const getStepIcon = (status) => {
    switch (status) {
      case 'completed': return CheckCircle;
      case 'running': return Clock;
      case 'failed': return AlertCircle;
      default: return Clock;
    }
  };

  const getStepColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'running': return 'text-blue-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-400';
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/generate-pdf/${workflowId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectContext: {
            title: 'RFP Analysis Report',
            client: 'Client Name'
          }
        })
      });

      if (response.ok) {
        // Ensure we're getting the response as a blob
        const blob = await response.blob();
        
        // Verify the blob is not empty and has the right type
        if (blob.size === 0) {
          throw new Error('Received empty PDF file');
        }
        
        console.log('PDF blob received:', {
          size: blob.size,
          type: blob.type
        });
        
        // Create a proper PDF blob if the type is not set correctly
        const pdfBlob = new Blob([blob], { type: 'application/pdf' });
        
        const url = window.URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `rfp-analysis-${workflowId}.pdf`;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);
        
      } else {
        const errorText = await response.text();
        console.error('Failed to download PDF:', response.status, errorText);
        alert('Failed to download PDF. Please try again.');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Error downloading PDF: ' + error.message);
    }
  };

  const handleRetryWorkflow = async (fromStep = null) => {
    const stepText = fromStep ? `from ${fromStep.replace('_', ' ')}` : 'from the beginning';
    if (window.confirm(`Are you sure you want to retry this workflow ${stepText}? This will restart the processing.`)) {
      try {
        await retryMutation.mutateAsync({ workflowId, fromStep });
      } catch (error) {
        console.error('Retry failed:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!workflow || workflow.error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Workflow not found</h3>
        <p className="mt-1 text-sm text-gray-500">
          The workflow you're looking for doesn't exist or has been deleted.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflow Progress</h1>
          <p className="mt-1 text-sm text-gray-500">
            Workflow ID: {workflowId}
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          {(workflow.status === 'failed' || workflow.status === 'completed') && (
            <button
              onClick={() => handleRetryWorkflow(workflow.status === 'failed' ? 'clarification_questions' : null)}
              disabled={retryMutation.isLoading}
              className="inline-flex items-center px-4 py-2 border border-orange-300 shadow-sm text-sm font-medium rounded-md text-orange-700 bg-white hover:bg-orange-50 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {retryMutation.isLoading ? 'Retrying...' : 'Retry Workflow'}
            </button>
          )}
          {workflow.status === 'completed' && (
            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </button>
          )}
        </div>
      </div>

      {/* Status Card */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Status: {workflow.status?.charAt(0).toUpperCase() + workflow.status?.slice(1)}
            </h3>
            <p className="text-sm text-gray-500">
              Current Step: {workflow.currentStep?.replace('_', ' ')}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">
              {workflow.progress || 0}%
            </div>
            <div className="text-sm text-gray-500">Complete</div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${workflow.progress || 0}%` }}
            ></div>
          </div>
        </div>

        {/* Real-time Progress */}
        {progress && (
          <div className="mt-4 p-3 bg-blue-50 rounded-md">
            <p className="text-sm text-blue-800">{progress.message}</p>
            {progress.type === 'stream' && progress.chunk && (
              <div className="mt-2 text-xs text-blue-600 font-mono bg-white p-2 rounded border">
                {progress.chunk}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6">Processing Steps</h3>
        <div className="space-y-4">
          {steps.map((step, index) => {
            const status = getStepStatus(step.id);
            const Icon = getStepIcon(status);
            const color = getStepColor(status);
            
            return (
              <div key={step.id} className="flex items-start">
                <div className="flex-shrink-0">
                  <Icon className={`h-6 w-6 ${color}`} />
                </div>
                <div className="ml-4 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-900">
                      {step.name}
                    </h4>
                    <span className={`text-xs font-medium ${color}`}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{step.description}</p>
                  
                  {/* Step Progress */}
                  {status === 'running' && (
                    <div className="mt-2">
                      <div className="bg-gray-200 rounded-full h-1">
                        <div className="bg-blue-600 h-1 rounded-full animate-pulse w-1/2"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Results Preview */}
      {workflow.status === 'completed' && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Results Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <FileText className="mx-auto h-8 w-8 text-blue-600 mb-2" />
              <div className="text-2xl font-bold text-gray-900">{summary.documentsProcessed}</div>
              <div className="text-sm text-gray-500">Documents Processed</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <CheckCircle className="mx-auto h-8 w-8 text-green-600 mb-2" />
              <div className="text-2xl font-bold text-gray-900">{summary.requirementsFound}</div>
              <div className="text-sm text-gray-500">Requirements Found</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <AlertCircle className="mx-auto h-8 w-8 text-yellow-600 mb-2" />
              <div className="text-2xl font-bold text-gray-900">{summary.questionsGenerated}</div>
              <div className="text-sm text-gray-500">Questions Generated</div>
            </div>
          </div>
          
          <div className="mt-6 flex justify-center space-x-4">
            <Link
              to={`/results/${workflowId}`}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              View Detailed Results
            </Link>
          </div>
        </div>
      )}

      {/* Error Display */}
      {workflow.status === 'failed' && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Workflow Failed</h3>
              <p className="mt-1 text-sm text-red-700">
                {workflow.error || 'An error occurred during processing'}
              </p>
              <div className="mt-4">
                <button
                  onClick={() => {/* Implement retry logic */}}
                  className="text-sm bg-red-100 text-red-800 px-3 py-1 rounded-md hover:bg-red-200"
                >
                  Retry Workflow
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Workflow;