import React, { useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  Upload,
  Activity,
  Trash2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard = () => {
  const [selectedWorkflows, setSelectedWorkflows] = useState(new Set());

  // Cleanup workflow mutation
  const cleanupMutation = useMutation(
    (workflowId) => fetch(`/api/rfp/workflow/${workflowId}/cleanup`, { method: 'DELETE' }).then(res => res.json()),
    {
      onSuccess: () => {
        refetchStats();
        refetchWorkflows();
        setSelectedWorkflows(new Set());
      }
    }
  );

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
  // Fetch dashboard statistics
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery(
    'dashboard-statistics',
    () => fetch('/api/rfp/dashboard/statistics').then(res => res.json()),
    { refetchInterval: 30000 }
  );

  // Fetch recent workflows
  const { data: workflows, isLoading: workflowsLoading, refetch: refetchWorkflows } = useQuery(
    'recent-workflows',
    () => fetch('/api/rfp/workflows').then(res => res.json()),
    { refetchInterval: 10000 }
  );

  const recentWorkflows = workflows?.workflows?.slice(0, 5) || [];
  const statistics = stats?.statistics || {};
  const chartData = statistics.weeklyActivity || [];

  const StatCard = ({ title, value, icon: Icon, color, change }) => (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <Icon className={`h-6 w-6 ${color}`} />
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
              <dd className="flex items-baseline">
                <div className="text-2xl font-semibold text-gray-900">{value}</div>
                {change && (
                  <div className={`ml-2 flex items-baseline text-sm font-semibold ${
                    change > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    <TrendingUp className="self-center flex-shrink-0 h-4 w-4" />
                    <span className="ml-1">{Math.abs(change)}%</span>
                  </div>
                )}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );

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

  if (statsLoading || workflowsLoading) {
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
            Dashboard
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Overview of your RFP processing workflows
          </p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <Link
            to="/upload"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Upload className="mr-2 h-4 w-4" />
            New RFP
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Workflows"
          value={statistics.total || 0}
          icon={Activity}
          color="text-blue-600"
          change={12}
        />
        <StatCard
          title="Completed"
          value={statistics.byStatus?.completed || 0}
          icon={CheckCircle}
          color="text-green-600"
          change={8}
        />
        <StatCard
          title="Running"
          value={statistics.byStatus?.running || 0}
          icon={Clock}
          color="text-yellow-600"
        />
        <StatCard
          title="Documents Processed"
          value={statistics.totalDocumentsProcessed || 0}
          icon={FileText}
          color="text-purple-600"
          change={15}
        />
      </div>

      {/* Charts and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workflow Activity Chart */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Weekly Activity</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="workflows" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Workflows */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Recent Workflows</h3>
              {selectedWorkflows.size > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">
                    {selectedWorkflows.size} selected
                  </span>
                  <button
                    onClick={handleCleanupSelected}
                    disabled={cleanupMutation.isLoading}
                    className="inline-flex items-center px-3 py-1 border border-red-300 shadow-sm text-xs font-medium rounded-md text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    {cleanupMutation.isLoading ? 'Deleting...' : 'Delete Selected'}
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {recentWorkflows.length > 0 ? (
              recentWorkflows.map((workflow) => {
                const StatusIcon = getStatusIcon(workflow.status);
                const workflowId = workflow.workflowId || workflow.id;
                const isSelected = selectedWorkflows.has(workflowId);
                
                return (
                  <div key={workflowId} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleWorkflowSelect(workflowId)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-3"
                        />
                        <StatusIcon className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {workflowId}
                          </p>
                          <p className="text-sm text-gray-500">
                            {workflow.currentStep?.replace('_', ' ') || 'Processing'}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(workflow.startTime || workflow.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(workflow.status)}`}>
                          {workflow.status}
                        </span>
                        <Link
                          to={`/workflow/${workflowId}`}
                          className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                    {workflow.progress !== undefined && (
                      <div className="mt-2 ml-7">
                        <div className="bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${workflow.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="px-6 py-8 text-center">
                <Activity className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No workflows yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Get started by uploading your first RFP document.
                </p>
                <div className="mt-6">
                  <Link
                    to="/upload"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload RFP
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/upload"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Upload className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <p className="font-medium text-gray-900">Upload New RFP</p>
              <p className="text-sm text-gray-500">Start processing a new RFP document</p>
            </div>
          </Link>
          
          <Link
            to="/workflows"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Activity className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <p className="font-medium text-gray-900">View All Workflows</p>
              <p className="text-sm text-gray-500">Monitor all processing workflows</p>
            </div>
          </Link>
          
          <Link
            to="/documents"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileText className="h-8 w-8 text-purple-600 mr-3" />
            <div>
              <p className="font-medium text-gray-900">Manage Documents</p>
              <p className="text-sm text-gray-500">View and organize your documents</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;