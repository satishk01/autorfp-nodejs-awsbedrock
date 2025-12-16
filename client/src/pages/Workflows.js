import React, { useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import { Link } from 'react-router-dom';
import { 
  Activity,
  Clock, 
  CheckCircle, 
  AlertCircle,
  FileText,
  Eye,
  Trash2,
  RefreshCw,
  Upload,
  Calendar
} from 'lucide-react';

const Workflows = () => {
  const [selectedWorkflows, setSelectedWorkflows] = useState(new Set());
  const [statusFilter, setStatusFilter] = useState('all');

  // Fetch workflows
  const { data: workflows, isLoading, refetch } = useQuery(
    'workflows-list',
    () => fetch('/api/rfp/workflows').then(res => res.json()),
    { refetchInterval: 10000 }
  );

  // Cleanup workflow mutation
  const cleanupMutation = useMutation(
    (workflowId) => fetch(`/api/rfp/workflow/${workflowId}/cleanup`, { method: 'DELETE' }).then(res => res.json()),
    {
      onSuccess: () => {
        refetch();
        setSelectedWorkflows(new Set());
      }
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
      onSuccess: (data, variables) => {
        console.log(`Workflow ${variables.workflowId} retry initiated`);
        refetch();
      },
      onError: (error, variables) => {
        console.error(`Failed to retry workflow ${variables.workflowId}:`, error);
      }
    }
  );

  const workflowsList = workflows?.workflows || [];
  
  // Filter workflows by status
  const filteredWorkflows = workflowsList.filter(workflow => {
    if (statusFilter === 'all') return true;
    return workflow.status === statusFilter;
  });

  const handleWorkflowSelect = (workflowId) => {
    const newSelected = new Set(selectedWorkflows);
    if (newSelected.has(workflowId)) {
      newSelected.delete(workflowId);
    } else {
      newSelected.add(workflowId);
    }
    setSelectedWorkflows(newSelected);
  };

  const handleCleanupSelected = async () => {
    if (selectedWorkflows.size === 0) return;
    
    if (window.confirm(`Are you sure you want to delete ${selectedWorkflows.size} workflow(s)? This action cannot be undone.`)) {
      for (const workflowId of selectedWorkflows) {
        await cleanupMutation.mutateAsync(workflowId);
      }
    }
  };

  const handleRetryWorkflow = async (workflowId, fromStep = null) => {
    if (window.confirm(`Are you sure you want to retry this workflow? This will restart the processing from ${fromStep || 'the beginning'}.`)) {
      try {
        await retryMutation.mutateAsync({ workflowId, fromStep });
      } catch (error) {
        console.error('Retry failed:', error);
      }
    }
  };

  const handleRetrySelected = async () => {
    if (selectedWorkflows.size === 0) return;
    
    if (window.confirm(`Are you sure you want to retry ${selectedWorkflows.size} workflow(s)? This will restart the processing for all selected workflows.`)) {
      for (const workflowId of selectedWorkflows) {
        try {
          await retryMutation.mutateAsync({ workflowId, fromStep: null });
        } catch (error) {
          console.error(`Failed to retry workflow ${workflowId}:`, error);
        }
      }
      setSelectedWorkflows(new Set());
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'running': return 'text-blue-600 bg-blue-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'cancelled': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return CheckCircle;
      case 'running': return Clock;
      case 'failed': return AlertCircle;
      default: return Clock;
    }
  };

  const statusCounts = {
    all: workflowsList.length,
    running: workflowsList.filter(w => w.status === 'running').length,
    completed: workflowsList.filter(w => w.status === 'completed').length,
    failed: workflowsList.filter(w => w.status === 'failed').length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            Workflows
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage and monitor your RFP processing workflows
          </p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4 space-x-3">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <Link
            to="/upload"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Upload className="mr-2 h-4 w-4" />
            New RFP
          </Link>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'all', label: 'All', count: statusCounts.all },
            { key: 'running', label: 'Running', count: statusCounts.running },
            { key: 'completed', label: 'Completed', count: statusCounts.completed },
            { key: 'failed', label: 'Failed', count: statusCounts.failed },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                statusFilter === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                  statusFilter === tab.key
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-900'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Bulk Actions */}
      {selectedWorkflows.size > 0 && (
        <div className="bg-blue-50 px-4 py-3 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-sm text-blue-700">
                {selectedWorkflows.size} workflow{selectedWorkflows.size > 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSelectedWorkflows(new Set())}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear selection
              </button>
              <button
                onClick={handleRetrySelected}
                disabled={retryMutation.isLoading}
                className="inline-flex items-center px-3 py-1 border border-orange-300 shadow-sm text-sm font-medium rounded-md text-orange-700 bg-white hover:bg-orange-50 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                {retryMutation.isLoading ? 'Retrying...' : 'Retry Selected'}
              </button>
              <button
                onClick={handleCleanupSelected}
                disabled={cleanupMutation.isLoading}
                className="inline-flex items-center px-3 py-1 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {cleanupMutation.isLoading ? 'Deleting...' : 'Delete Selected'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workflows List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {filteredWorkflows.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {filteredWorkflows.map((workflow) => {
              const StatusIcon = getStatusIcon(workflow.status);
              const workflowId = workflow.workflowId || workflow.id;
              const isSelected = selectedWorkflows.has(workflowId);
              
              return (
                <li key={workflowId} className="hover:bg-gray-50">
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleWorkflowSelect(workflowId)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-4"
                        />
                        <StatusIcon className="h-5 w-5 text-gray-400 mr-3" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-blue-600 truncate">
                              {workflowId}
                            </p>
                            <div className="ml-2 flex-shrink-0 flex">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(workflow.status)}`}>
                                {workflow.status}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 sm:flex sm:justify-between">
                            <div className="sm:flex">
                              <p className="flex items-center text-sm text-gray-500">
                                <FileText className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                                {workflow.currentStep?.replace('_', ' ') || 'Processing'}
                              </p>
                              <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                                <Calendar className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                                {new Date(workflow.startTime || workflow.created_at).toLocaleString()}
                              </p>
                            </div>
                            <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                              <div className="flex space-x-2">
                                <Link
                                  to={`/workflow/${workflowId}`}
                                  className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                                >
                                  <Activity className="h-3 w-3 mr-1" />
                                  Progress
                                </Link>
                                {workflow.status === 'completed' && (
                                  <Link
                                    to={`/results/${workflowId}`}
                                    className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    Results
                                  </Link>
                                )}
                                {(workflow.status === 'failed' || workflow.status === 'completed') && (
                                  <button
                                    onClick={() => handleRetryWorkflow(workflowId, workflow.status === 'failed' ? 'clarification_questions' : null)}
                                    disabled={retryMutation.isLoading}
                                    className="inline-flex items-center px-2.5 py-1.5 border border-orange-300 shadow-sm text-xs font-medium rounded text-orange-700 bg-white hover:bg-orange-50 disabled:opacity-50"
                                    title={workflow.status === 'failed' ? 'Retry failed workflow' : 'Retry workflow from beginning'}
                                  >
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    {retryMutation.isLoading ? 'Retrying...' : 'Retry'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                          {/* Progress Bar */}
                          {workflow.progress !== undefined && workflow.status === 'running' && (
                            <div className="mt-3">
                              <div className="bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${workflow.progress}%` }}
                                ></div>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">{workflow.progress}% complete</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-center py-12">
            <Activity className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {statusFilter === 'all' ? 'No workflows yet' : `No ${statusFilter} workflows`}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {statusFilter === 'all' 
                ? 'Get started by uploading your first RFP document.'
                : `There are no workflows with ${statusFilter} status.`
              }
            </p>
            {statusFilter === 'all' && (
              <div className="mt-6">
                <Link
                  to="/upload"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload RFP
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {workflowsList.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Workflow Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{statusCounts.all}</div>
              <div className="text-sm text-gray-500">Total Workflows</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{statusCounts.completed}</div>
              <div className="text-sm text-gray-500">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{statusCounts.running}</div>
              <div className="text-sm text-gray-500">Running</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{statusCounts.failed}</div>
              <div className="text-sm text-gray-500">Failed</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Workflows;