import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

const KnowledgeGraph = ({ workflowId }) => {
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const svgRef = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });

  const fetchKnowledgeGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/graphrag/workflow/${workflowId}/knowledge-graph`);
      const data = await response.json();
      
      if (data.success) {
        setGraphData(data.knowledgeGraph);
      } else {
        setError(data.error || 'Failed to fetch knowledge graph');
      }
    } catch (err) {
      setError('Error fetching knowledge graph: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    if (workflowId) {
      fetchKnowledgeGraph();
    }
  }, [workflowId, fetchKnowledgeGraph]);

  const handleZoomIn = () => {
    setTransform(prev => ({ ...prev, scale: Math.min(prev.scale * 1.2, 3) }));
  };

  const handleZoomOut = () => {
    setTransform(prev => ({ ...prev, scale: Math.max(prev.scale / 1.2, 0.3) }));
  };

  const handleReset = () => {
    setTransform({ x: 0, y: 0, scale: 1 });
    setSelectedNode(null);
  };

  const handleNodeClick = (node) => {
    setSelectedNode(node);
  };

  const renderGraph = () => {
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <p className="mb-2">No knowledge graph data available</p>
            <p className="text-sm">
              {graphData?.message || 'This feature requires Neo4j to be enabled and configured.'}
            </p>
          </div>
        </div>
      );
    }

    const { nodes, edges } = graphData;
    const width = 800;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;

    // Simple force-directed layout simulation
    const positionedNodes = nodes.map((node, index) => {
      const angle = (index / nodes.length) * 2 * Math.PI;
      const radius = Math.min(width, height) * 0.3;
      
      return {
        ...node,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      };
    });

    return (
      <div className="relative border rounded-lg bg-gray-50">
        {/* Controls */}
        <div className="absolute top-2 right-2 z-10 flex gap-2">
          <button 
            className="px-3 py-1 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50"
            onClick={handleZoomIn}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button 
            className="px-3 py-1 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50"
            onClick={handleZoomOut}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button 
            className="px-3 py-1 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50"
            onClick={handleReset}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* SVG Graph */}
        <svg
          ref={svgRef}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`
          }}
        >
          {/* Edges */}
          {edges.map((edge, index) => {
            const sourceNode = positionedNodes.find(n => n.id === edge.source);
            const targetNode = positionedNodes.find(n => n.id === edge.target);
            
            if (!sourceNode || !targetNode) return null;
            
            return (
              <g key={`edge-${index}`}>
                <line
                  x1={sourceNode.x}
                  y1={sourceNode.y}
                  x2={targetNode.x}
                  y2={targetNode.y}
                  stroke="#94a3b8"
                  strokeWidth={Math.max(1, edge.weight * 3)}
                  opacity={0.6}
                />
                {edge.label && (
                  <text
                    x={(sourceNode.x + targetNode.x) / 2}
                    y={(sourceNode.y + targetNode.y) / 2}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#64748b"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {positionedNodes.map((node) => (
            <g
              key={node.id}
              onClick={() => handleNodeClick(node)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={node.x}
                cy={node.y}
                r={node.size || 15}
                fill={node.color || '#3b82f6'}
                stroke={selectedNode?.id === node.id ? '#1d4ed8' : '#ffffff'}
                strokeWidth={selectedNode?.id === node.id ? 3 : 2}
                opacity={0.8}
              />
              <text
                x={node.x}
                y={node.y + (node.size || 15) + 15}
                textAnchor="middle"
                fontSize="12"
                fill="#374151"
                fontWeight={selectedNode?.id === node.id ? 'bold' : 'normal'}
              >
                {node.label.length > 15 ? node.label.substring(0, 15) + '...' : node.label}
              </text>
            </g>
          ))}
        </svg>

        {/* Node Details Panel */}
        {selectedNode && (
          <div className="absolute bottom-4 left-4 bg-white p-4 rounded-lg shadow-lg border max-w-xs">
            <h4 className="font-semibold mb-2">{selectedNode.label}</h4>
            <div className="space-y-1 text-sm">
              <div>
                <span className="font-medium">Type:</span> 
                <span className="ml-2 px-2 py-1 text-xs bg-gray-100 border rounded">
                  {selectedNode.type}
                </span>
              </div>
              {selectedNode.size && (
                <div>
                  <span className="font-medium">Importance:</span> {selectedNode.size}
                </div>
              )}
              <div>
                <span className="font-medium">ID:</span> {selectedNode.id}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStats = () => {
    if (!graphData?.stats) return null;

    const { stats } = graphData;
    
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{stats.totalNodes}</div>
          <div className="text-sm text-blue-800">Total Nodes</div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{stats.totalEdges}</div>
          <div className="text-sm text-green-800">Relationships</div>
        </div>
        <div className="bg-purple-50 p-3 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">{stats.documentNodes}</div>
          <div className="text-sm text-purple-800">Documents</div>
        </div>
        <div className="bg-orange-50 p-3 rounded-lg">
          <div className="text-2xl font-bold text-orange-600">{stats.entityNodes}</div>
          <div className="text-sm text-orange-800">Entities</div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full border border-gray-200 rounded-lg bg-white shadow-sm">
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Knowledge Graph</h3>
          <div className="flex gap-2">
            <button
              onClick={fetchKnowledgeGraph}
              disabled={loading}
              className="px-3 py-1 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Refresh'
              )}
            </button>
          </div>
        </div>
      </div>
      <div className="p-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="ml-2">Loading knowledge graph...</span>
          </div>
        ) : (
          <>
            {renderStats()}
            {renderGraph()}
          </>
        )}

        {graphData && (
          <div className="mt-4 text-sm text-gray-600">
            <p>
              This knowledge graph shows the relationships between entities extracted from your documents.
              Click on nodes to see details. Use the controls to zoom and navigate.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeGraph;