import React, { useState, useRef } from 'react';
import { 
  FileText, 
  Send, 
  Loader, 
  AlertCircle, 
  BookOpen, 
  Cloud, 
  Settings,
  Copy,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Shield
} from 'lucide-react';

const ArchitectureAnalysis = ({ workflowId }) => {
  const [userInput, setUserInput] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [awsServices, setAwsServices] = useState([]);
  const [userSpecifiedComponents, setUserSpecifiedComponents] = useState([]);
  const [preservationStatus, setPreservationStatus] = useState(null);
  const [componentValidation, setComponentValidation] = useState(null);
  const textareaRef = useRef(null);

  const handleAnalyze = async () => {
    if (!userInput.trim()) {
      setError('Please enter some architecture details to analyze');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysis('');
    setAwsServices([]);
    setUserSpecifiedComponents([]);
    setPreservationStatus(null);
    setComponentValidation(null);

    try {
      console.log('Starting architecture analysis...');
      
      const response = await fetch(`/api/rfp/workflow/${workflowId}/analyze-architecture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          architectureDescription: userInput.trim()
        })
      });

      const result = await response.json();
      console.log('Architecture analysis response:', result);

      if (result.success) {
        setAnalysis(result.analysis);
        setAwsServices(result.awsServices || []);
        setUserSpecifiedComponents(result.userSpecifiedComponents || []);
        setPreservationStatus(result.preservationStatus || null);
        setComponentValidation(result.componentValidation || null);
      } else {
        setError(result.error || 'Failed to analyze architecture');
      }
    } catch (err) {
      console.error('Architecture analysis error:', err);
      setError('Failed to analyze architecture: ' + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyAnalysis = () => {
    navigator.clipboard.writeText(analysis);
  };

  const handleDownloadAnalysis = () => {
    const blob = new Blob([analysis], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `architecture-analysis-${workflowId}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearAll = () => {
    setUserInput('');
    setAnalysis('');
    setAwsServices([]);
    setUserSpecifiedComponents([]);
    setPreservationStatus(null);
    setComponentValidation(null);
    setError(null);
    textareaRef.current?.focus();
  };

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <Cloud className="h-5 w-5 text-orange-600" />
          <h3 className="text-lg font-medium text-gray-900">Architecture Analysis</h3>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            AWS Bedrock Haiku 3
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleClearAll}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Clear
          </button>
        </div>
      </div>

      {/* Input Section */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <label htmlFor="architecture-input" className="block text-sm font-medium text-gray-700 mb-2">
          Describe your architecture requirements, components, or existing setup:
        </label>
        <div className="relative">
          <textarea
            ref={textareaRef}
            id="architecture-input"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Example: I want a simple web portal with Angular deployed in S3 with CloudFront, Business tier as Lambda + API Gateway and database tier as Aurora PostgreSQL..."
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 resize-none"
            disabled={isAnalyzing}
          />
          <div className="absolute bottom-2 right-2 text-xs text-gray-500">
            {userInput.length}/2000
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Shield className="h-4 w-4" />
            <span>Your specified components will be preserved • Only additions suggested</span>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !userInput.trim()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Analyze Architecture
              </>
            )}
          </button>
        </div>
      </div>

      {/* Component Preservation Status */}
      {userSpecifiedComponents.length > 0 && (
        <div className="p-4 border-b border-gray-200 bg-green-50">
          <h4 className="text-sm font-medium text-green-900 mb-2 flex items-center">
            <Shield className="h-4 w-4 mr-2" />
            Your Specified Components (Preserved)
          </h4>
          <div className="flex flex-wrap gap-2 mb-3">
            {userSpecifiedComponents.map((component, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                {component}
              </span>
            ))}
          </div>
          
          {preservationStatus && (
            <div className="space-y-2">
              {preservationStatus.preserved.length > 0 && (
                <div className="flex items-center text-xs text-green-700">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  <span>{preservationStatus.preserved.length} components preserved in analysis</span>
                </div>
              )}
              
              {preservationStatus.missing.length > 0 && (
                <div className="flex items-center text-xs text-red-700">
                  <XCircle className="h-3 w-3 mr-1" />
                  <span>{preservationStatus.missing.length} components may need attention</span>
                </div>
              )}
              
              {preservationStatus.needsApproval && (
                <div className="flex items-center text-xs text-yellow-700">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  <span>Some changes may require your approval</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Component Validation Warnings */}
      {componentValidation && componentValidation.needsApproval.length > 0 && (
        <div className="p-4 border-b border-gray-200 bg-yellow-50">
          <h4 className="text-sm font-medium text-yellow-900 mb-2 flex items-center">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Approval Required for Component Changes
          </h4>
          <div className="space-y-2">
            {componentValidation.needsApproval.map((item, index) => (
              <div key={index} className="bg-yellow-100 rounded-md p-3">
                <div className="text-sm font-medium text-yellow-800">{item.component}</div>
                <div className="text-xs text-yellow-700 mt-1">{item.reason}</div>
                <div className="text-xs text-yellow-600 mt-1 italic">{item.action}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-400">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* AWS Services Recommendations */}
      {awsServices.length > 0 && (
        <div className="p-4 border-b border-gray-200 bg-blue-50">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Additional AWS Services Recommended:</h4>
          <div className="flex flex-wrap gap-2">
            {awsServices.map((service, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
              >
                + {service}
              </span>
            ))}
          </div>
          <div className="mt-2 text-xs text-blue-700">
            These services complement your specified components for better security, performance, and AWS best practices.
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && (
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-900">Architecture Analysis & Recommendations</h4>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCopyAnalysis}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800"
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </button>
              <button
                onClick={handleDownloadAnalysis}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800"
              >
                <Download className="h-3 w-3 mr-1" />
                Download
              </button>
            </div>
          </div>
          <div className="prose prose-sm max-w-none bg-gray-50 rounded-lg p-4 border">
            <div className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
              {analysis}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!analysis && !isAnalyzing && !error && (
        <div className="p-8 text-center">
          <Cloud className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No analysis yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Describe your architecture requirements above to get AWS-powered recommendations and best practices.
          </p>
        </div>
      )}
    </div>
  );
};

export default ArchitectureAnalysis;