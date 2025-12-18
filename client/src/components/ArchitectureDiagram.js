import React, { useState, useRef } from 'react';
import { 
  Layers, 
  Download, 
  Loader, 
  AlertCircle, 
  FileImage,
  FileText,
  Copy,
  RefreshCw,
  Zap,
  Eye
} from 'lucide-react';

const ArchitectureDiagram = ({ workflowId }) => {
  const [diagramData, setDiagramData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [architectureAnalysis, setArchitectureAnalysis] = useState('');
  const [previewMode, setPreviewMode] = useState('drawio'); // 'drawio', 'mermaid', 'svg'
  const canvasRef = useRef(null);

  const handleGenerateDiagram = async () => {
    if (!architectureAnalysis.trim()) {
      setError('Please provide architecture analysis or generate it first from the Architecture Analysis tab');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setDiagramData(null);

    try {
      console.log('Generating architecture diagram...');
      
      const response = await fetch(`/api/rfp/workflow/${workflowId}/generate-architecture-diagram`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          architectureAnalysis: architectureAnalysis.trim()
        })
      });

      const result = await response.json();
      console.log('Architecture diagram response:', result);

      if (result.success) {
        setDiagramData(result.diagram);
      } else {
        setError(result.error || 'Failed to generate architecture diagram');
      }
    } catch (err) {
      console.error('Architecture diagram generation error:', err);
      setError('Failed to generate architecture diagram: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLoadFromAnalysis = async () => {
    try {
      // Try to fetch existing architecture analysis
      const response = await fetch(`/api/rfp/workflow/${workflowId}/architecture-analysis`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.analysis) {
          setArchitectureAnalysis(result.analysis);
        } else {
          setError('No architecture analysis found. Please generate it first in the Architecture Analysis tab.');
        }
      } else {
        setError('No architecture analysis found. Please generate it first in the Architecture Analysis tab.');
      }
    } catch (err) {
      setError('Failed to load architecture analysis: ' + err.message);
    }
  };

  const handleExportDrawIO = () => {
    if (!diagramData?.drawio) return;
    
    const blob = new Blob([diagramData.drawio], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `architecture-diagram-${workflowId}.drawio`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportSVG = () => {
    if (!diagramData?.svg) return;
    
    const blob = new Blob([diagramData.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `architecture-diagram-${workflowId}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportPNG = async () => {
    if (!diagramData?.svg) return;

    try {
      // Convert SVG to PNG using canvas
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        canvas.width = img.width || 800;
        canvas.height = img.height || 600;
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `architecture-diagram-${workflowId}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 'image/png');
      };
      
      const svgBlob = new Blob([diagramData.svg], { type: 'image/svg+xml' });
      const svgUrl = URL.createObjectURL(svgBlob);
      img.src = svgUrl;
    } catch (err) {
      console.error('PNG export error:', err);
      setError('Failed to export PNG: ' + err.message);
    }
  };

  const handleCopyDrawIO = () => {
    if (!diagramData?.drawio) return;
    navigator.clipboard.writeText(diagramData.drawio);
  };

  const renderPreview = () => {
    if (!diagramData) return null;

    switch (previewMode) {
      case 'drawio':
        return (
          <div className="bg-gray-50 rounded-lg p-4 border">
            <div className="text-sm text-gray-600 mb-2">Draw.io XML Format</div>
            <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-96 whitespace-pre-wrap">
              {diagramData.drawio}
            </pre>
          </div>
        );
      case 'mermaid':
        return (
          <div className="bg-gray-50 rounded-lg p-4 border">
            <div className="text-sm text-gray-600 mb-2">Mermaid Diagram Code</div>
            <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-96 whitespace-pre-wrap">
              {diagramData.mermaid}
            </pre>
          </div>
        );
      case 'svg':
        return (
          <div className="bg-gray-50 rounded-lg p-4 border">
            <div className="text-sm text-gray-600 mb-2">SVG Preview</div>
            <div 
              className="bg-white p-3 rounded border overflow-auto max-h-96"
              dangerouslySetInnerHTML={{ __html: diagramData.svg }}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <Layers className="h-5 w-5 text-purple-600" />
          <h3 className="text-lg font-medium text-gray-900">Architecture Diagram</h3>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            Google Gemini
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleLoadFromAnalysis}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Load Analysis
          </button>
        </div>
      </div>

      {/* Input Section */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <label htmlFor="architecture-analysis" className="block text-sm font-medium text-gray-700 mb-2">
          Architecture Analysis (from Architecture Analysis tab):
        </label>
        <div className="relative">
          <textarea
            id="architecture-analysis"
            value={architectureAnalysis}
            onChange={(e) => setArchitectureAnalysis(e.target.value)}
            placeholder="Paste your architecture analysis here or click 'Load Analysis' to fetch from the Architecture Analysis tab..."
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 resize-none"
            disabled={isGenerating}
          />
          <div className="absolute bottom-2 right-2 text-xs text-gray-500">
            {architectureAnalysis.length}/10000
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Zap className="h-4 w-4" />
            <span>Generates Draw.io, Mermaid, and SVG formats</span>
          </div>
          <button
            onClick={handleGenerateDiagram}
            disabled={isGenerating || !architectureAnalysis.trim()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Layers className="h-4 w-4 mr-2" />
                Generate Diagram
              </>
            )}
          </button>
        </div>
      </div>

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

      {/* Diagram Results */}
      {diagramData && (
        <div className="p-4">
          {/* Format Selection */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Eye className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Preview Format:</span>
              <div className="flex space-x-1">
                {[
                  { id: 'drawio', name: 'Draw.io XML' },
                  { id: 'mermaid', name: 'Mermaid' },
                  { id: 'svg', name: 'SVG' }
                ].map((format) => (
                  <button
                    key={format.id}
                    onClick={() => setPreviewMode(format.id)}
                    className={`px-3 py-1 text-xs font-medium rounded-md ${
                      previewMode === format.id
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {format.name}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Export Buttons */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCopyDrawIO}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800"
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy XML
              </button>
              <button
                onClick={handleExportDrawIO}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <FileText className="h-4 w-4 mr-2" />
                Export Draw.io
              </button>
              <button
                onClick={handleExportSVG}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <FileImage className="h-4 w-4 mr-2" />
                Export SVG
              </button>
              <button
                onClick={handleExportPNG}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Export PNG
              </button>
            </div>
          </div>

          {/* Preview */}
          {renderPreview()}

          {/* Diagram Description */}
          {diagramData.description && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Diagram Description:</h4>
              <p className="text-sm text-blue-800">{diagramData.description}</p>
            </div>
          )}

          {/* Technical Writeups */}
          {diagramData.technicalWriteups && (
            <div className="mt-6 space-y-6">
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Technical Architecture Analysis</h3>
                
                {/* Architecture Summary */}
                {diagramData.technicalWriteups.summary && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                    <h4 className="text-md font-medium text-gray-900 mb-3">{diagramData.technicalWriteups.summary.title}</h4>
                    <p className="text-sm text-gray-700 mb-4">{diagramData.technicalWriteups.summary.description}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="text-sm font-medium text-gray-800 mb-2">Key Components:</h5>
                        <ul className="text-xs text-gray-600 space-y-1">
                          {diagramData.technicalWriteups.summary.keyComponents?.map((component, index) => (
                            <li key={index} className="flex justify-between">
                              <span className="font-medium">{component.service}:</span>
                              <span className="text-right ml-2">{component.purpose}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h5 className="text-sm font-medium text-gray-800 mb-2">Architecture Patterns:</h5>
                        <ul className="text-xs text-gray-600 space-y-1">
                          {diagramData.technicalWriteups.summary.architecturePatterns?.map((pattern, index) => (
                            <li key={index}>• {pattern}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Connection Details */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">Numbered Connection Details:</h4>
                  {diagramData.technicalWriteups.connections?.map((connection, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gradient-to-r from-purple-50 to-blue-50 px-4 py-3 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <h5 className="text-sm font-semibold text-gray-900">
                            <span className="inline-flex items-center justify-center w-6 h-6 bg-purple-600 text-white text-xs font-bold rounded-full mr-2">
                              {connection.stepNumber}
                            </span>
                            {connection.title}
                          </h5>
                          <div className="flex items-center space-x-2 text-xs">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">{connection.protocol}</span>
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded">{connection.type}</span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 mt-1">{connection.description}</p>
                      </div>
                      
                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div>
                            <h6 className="text-sm font-medium text-gray-800 mb-2 flex items-center">
                              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                              Technical Details
                            </h6>
                            <ul className="text-xs text-gray-600 space-y-1">
                              {connection.technicalDetails?.map((detail, idx) => (
                                <li key={idx}>{detail}</li>
                              ))}
                            </ul>
                          </div>
                          
                          <div>
                            <h6 className="text-sm font-medium text-gray-800 mb-2 flex items-center">
                              <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                              Security Considerations
                            </h6>
                            <ul className="text-xs text-gray-600 space-y-1">
                              {connection.securityConsiderations?.map((security, idx) => (
                                <li key={idx}>{security}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div>
                            <h6 className="text-sm font-medium text-gray-800 mb-2 flex items-center">
                              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                              Performance Optimizations
                            </h6>
                            <ul className="text-xs text-gray-600 space-y-1">
                              {connection.performanceOptimizations?.map((optimization, idx) => (
                                <li key={idx}>{optimization}</li>
                              ))}
                            </ul>
                          </div>
                          
                          <div>
                            <h6 className="text-sm font-medium text-gray-800 mb-2 flex items-center">
                              <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                              Monitoring Metrics
                            </h6>
                            <ul className="text-xs text-gray-600 space-y-1">
                              {connection.monitoringMetrics?.map((metric, idx) => (
                                <li key={idx}>{metric}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Additional Architecture Considerations */}
                {diagramData.technicalWriteups.summary && (
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <h5 className="text-sm font-medium text-green-900 mb-2">Scalability Considerations:</h5>
                      <ul className="text-xs text-green-800 space-y-1">
                        {diagramData.technicalWriteups.summary.scalabilityConsiderations?.map((consideration, index) => (
                          <li key={index}>• {consideration}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <h5 className="text-sm font-medium text-yellow-900 mb-2">Cost Optimization:</h5>
                      <ul className="text-xs text-yellow-800 space-y-1">
                        {diagramData.technicalWriteups.summary.costOptimization?.map((optimization, index) => (
                          <li key={index}>• {optimization}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!diagramData && !isGenerating && !error && (
        <div className="p-8 text-center">
          <Layers className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No diagram generated yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Load your architecture analysis and generate a visual diagram with AWS components.
          </p>
        </div>
      )}

      {/* Hidden canvas for PNG export */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default ArchitectureDiagram;