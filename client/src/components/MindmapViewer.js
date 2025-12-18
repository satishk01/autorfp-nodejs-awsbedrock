import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Download, 
  RefreshCw, 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  FileText,
  Share2,
  Settings,
  AlertCircle,
  Loader,
  ChevronRight,
  ChevronDown,
  Plus,
  Minus
} from 'lucide-react';

const MindmapViewer = ({ workflowId, onError }) => {
  const [mindmapData, setMindmapData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(0.8);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set(['root']));
  const [nodePositions, setNodePositions] = useState(new Map());
  const [isToggling, setIsToggling] = useState(false);
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  // Load existing mindmap on component mount
  useEffect(() => {
    if (workflowId) {
      loadMindmap();
    }
  }, [workflowId]);

  // Calculate node positions when mindmap data changes
  useEffect(() => {
    if (mindmapData) {
      // Add a small delay to make the transition smoother
      const timeoutId = setTimeout(() => {
        calculateNodePositions();
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [mindmapData, expandedNodes]);

  const loadMindmap = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Loading mindmap for workflow: ${workflowId}`);
      const response = await fetch(`/api/rfp/workflow/${workflowId}/mindmap`);
      const result = await response.json();
      
      console.log('Mindmap API response:', result);
      
      if (result.success) {
        setMindmapData(result.mindmap);
        // Initialize expanded nodes
        const initialExpanded = new Set(['root']);
        if (result.mindmap.nodes) {
          result.mindmap.nodes.forEach(node => {
            if (node.expanded) {
              initialExpanded.add(node.id);
            }
          });
        }
        setExpandedNodes(initialExpanded);
        console.log('Mindmap loaded successfully');
      } else {
        const errorMessage = result.error || 'Failed to load mindmap';
        console.error('Mindmap API error:', errorMessage);
        setError(errorMessage);
        
        // If workflow not found, provide helpful message
        if (result.error === 'Workflow not found') {
          setError(`Workflow ${workflowId} not found. Please check if the workflow exists or try refreshing the page.`);
        }
      }
    } catch (err) {
      const errorMessage = 'Failed to load mindmap: ' + err.message;
      console.error('Mindmap fetch error:', err);
      setError(errorMessage);
      if (onError) onError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const generateMindmap = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      console.log(`Generating mindmap for workflow: ${workflowId}`);
      const response = await fetch(`/api/rfp/workflow/${workflowId}/generate-mindmap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      console.log('Generate mindmap response:', result);
      
      if (result.success) {
        setMindmapData(result.mindmap);
        console.log('Mindmap generated successfully');
      } else {
        const errorMessage = result.error || 'Failed to generate mindmap';
        console.error('Generate mindmap error:', errorMessage);
        setError(errorMessage);
        
        // Provide specific error messages
        if (result.error === 'No documents found for this workflow') {
          setError('Cannot generate mindmap: No documents have been uploaded for this workflow. Please upload documents first.');
        }
      }
    } catch (err) {
      const errorMessage = 'Failed to generate mindmap: ' + err.message;
      console.error('Generate mindmap fetch error:', err);
      setError(errorMessage);
      if (onError) onError(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const exportMindmap = async (format) => {
    try {
      const response = await fetch(`/api/rfp/workflow/${workflowId}/mindmap/export/${format}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mindmap-${workflowId}.${format === 'mermaid' ? 'mmd' : format === 'graphviz' ? 'dot' : format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to export mindmap');
      }
    } catch (err) {
      setError('Failed to export mindmap: ' + err.message);
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.3));
  };

  const resetView = () => {
    setZoom(0.8);
    setPan({ x: 0, y: 0 });
  };

  const fitToScreen = useCallback(() => {
    if (!nodePositions.size || !containerRef.current) return;
    
    // Calculate bounds of all positioned nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    nodePositions.forEach((pos, nodeId) => {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + 300); // Account for node width
      maxY = Math.max(maxY, pos.y + 40);  // Account for node height
    });
    
    const contentWidth = maxX - minX + 100; // Add padding
    const contentHeight = maxY - minY + 100;
    
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    
    // Calculate optimal zoom to fit all content
    const scaleX = containerWidth / contentWidth;
    const scaleY = containerHeight / contentHeight;
    const optimalZoom = Math.min(scaleX, scaleY, 1) * 0.9; // 90% to add margin
    
    // Center the content
    const centerX = (containerWidth - contentWidth * optimalZoom) / 2;
    const centerY = (containerHeight - contentHeight * optimalZoom) / 2;
    
    setZoom(optimalZoom);
    setPan({ 
      x: centerX / optimalZoom - minX + 50, 
      y: centerY / optimalZoom - minY + 50 
    });
  }, [nodePositions]);

  const calculateNodePositions = useCallback(() => {
    if (!mindmapData) return;

    const positions = new Map();
    
    // Dynamic sizing based on container
    const containerWidth = containerRef.current?.clientWidth || 1200;
    const containerHeight = containerRef.current?.clientHeight || 700;
    
    const startX = 50;
    const startY = 50;
    const levelIndent = Math.min(250, containerWidth / 6); // Responsive level spacing
    const nodeSpacing = 50;

    // Position central node at top-left with some margin
    positions.set('root', { x: startX, y: startY });

    // Get all nodes that should be visible based on expanded state
    const getVisibleNodes = () => {
      const visibleNodes = [];
      const processNode = (nodeId, level) => {
        const children = mindmapData.nodes.filter(node => node.parentId === nodeId);
        
        children.forEach(child => {
          visibleNodes.push({ ...child, level });
          
          // If this node is expanded, process its children
          if (expandedNodes.has(child.id)) {
            processNode(child.id, level + 1);
          }
        });
      };
      
      // Start from root if it's expanded
      if (expandedNodes.has('root')) {
        processNode('root', 1);
      }
      
      return visibleNodes;
    };

    // Position all visible nodes with bounds checking
    const visibleNodes = getVisibleNodes();
    let currentY = startY + nodeSpacing;
    let maxX = startX;
    let maxY = startY;
    
    visibleNodes.forEach((node, index) => {
      const x = startX + (node.level * levelIndent);
      const y = currentY;
      
      positions.set(node.id, { x, y });
      currentY += nodeSpacing;
      
      // Track bounds
      maxX = Math.max(maxX, x + 300); // Account for node width
      maxY = Math.max(maxY, y + 40);  // Account for node height
    });

    console.log('Positioned nodes:', Array.from(positions.keys()));
    setNodePositions(positions);
  }, [mindmapData, expandedNodes]);

  const toggleNodeExpansion = useCallback((nodeId) => {
    console.log(`toggleNodeExpansion called for: ${nodeId}`);
    
    // Prevent rapid clicking with a more robust check
    if (isToggling) {
      console.log('Already toggling, ignoring click');
      return;
    }
    
    setIsToggling(true);
    
    // Use functional update to ensure we have the latest state
    setExpandedNodes(prev => {
      const newExpanded = new Set(prev);
      const wasExpanded = newExpanded.has(nodeId);
      
      if (wasExpanded) {
        newExpanded.delete(nodeId);
        console.log(`Collapsed node: ${nodeId}`);
        
        // Also collapse all children recursively
        if (mindmapData?.nodes) {
          const collapseChildren = (parentId) => {
            mindmapData.nodes.forEach(node => {
              if (node.parentId === parentId) {
                newExpanded.delete(node.id);
                collapseChildren(node.id); // Recursive collapse
              }
            });
          };
          collapseChildren(nodeId);
        }
      } else {
        newExpanded.add(nodeId);
        console.log(`Expanded node: ${nodeId}`);
      }
      
      console.log('New expanded nodes:', Array.from(newExpanded));
      return newExpanded;
    });
    
    // Reset toggling state after a shorter delay for better responsiveness
    setTimeout(() => {
      setIsToggling(false);
    }, 150);
  }, [isToggling, mindmapData]);

  const renderNode = (node) => {
    const position = nodePositions.get(node.id);
    if (!position) return null;

    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedNode?.id === node.id;
    const hasChildren = mindmapData.nodes && mindmapData.nodes.some(n => n.parentId === node.id);
    
    // NotebookLM-style dimensions
    const getNodeDimensions = (type, label) => {
      const textLength = label.length;
      const baseWidth = Math.max(textLength * 8, 120);
      
      switch (type) {
        case 'main': return { width: Math.min(baseWidth + 40, 350), height: 40 };
        case 'section': return { width: Math.min(baseWidth + 30, 320), height: 36 };
        case 'subsection': return { width: Math.min(baseWidth + 20, 300), height: 32 };
        default: return { width: Math.min(baseWidth + 10, 280), height: 28 };
      }
    };

    const { width, height } = getNodeDimensions(node.type, node.label);
    const nodeColor = node.color || '#E8F4FD';
    const textColor = node.textColor || '#1E40AF';
    const borderColor = isSelected ? '#2563EB' : '#D1D5DB';
    
    return (
      <g key={node.id}>
        {/* Node background - NotebookLM style rectangle */}
        <rect
          x={position.x}
          y={position.y}
          width={width}
          height={height}
          rx="8"
          fill={nodeColor}
          stroke={borderColor}
          strokeWidth={isSelected ? 2 : 1}
          className="cursor-pointer transition-all duration-300 hover:shadow-md"
          onClick={() => setSelectedNode(node)}
          style={{
            transition: 'all 0.3s ease-in-out',
            opacity: 1
          }}
        />
        
        {/* Expand/collapse button */}
        {hasChildren && (
          <g>
            {/* Invisible larger click area for better UX */}
            <rect
              x={position.x + width - 30}
              y={position.y + height/2 - 15}
              width="30"
              height="30"
              fill="transparent"
              className="cursor-pointer"
              style={{ 
                pointerEvents: isToggling ? 'none' : 'all'
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isToggling) {
                  console.log(`Toggling node: ${node.id}, current state: ${isExpanded}`);
                  toggleNodeExpansion(node.id);
                }
              }}
            />
            {/* Visual button with hover effect */}
            <circle
              cx={position.x + width - 15}
              cy={position.y + height/2}
              r="9"
              fill={isToggling ? '#F3F4F6' : 'white'}
              stroke={textColor}
              strokeWidth="1.5"
              className="pointer-events-none transition-all duration-150"
              style={{
                filter: isToggling ? 'brightness(0.9)' : 'none'
              }}
            />
            {/* Plus/Minus icon with smooth transition */}
            <g className="pointer-events-none">
              {/* Horizontal line (always present) */}
              <line
                x1={position.x + width - 20}
                y1={position.y + height/2}
                x2={position.x + width - 10}
                y2={position.y + height/2}
                stroke={textColor}
                strokeWidth="2"
                strokeLinecap="round"
                className="transition-all duration-150"
              />
              {/* Vertical line (only when collapsed) */}
              {!isExpanded && (
                <line
                  x1={position.x + width - 15}
                  y1={position.y + height/2 - 5}
                  x2={position.x + width - 15}
                  y2={position.y + height/2 + 5}
                  stroke={textColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="transition-all duration-150"
                />
              )}
            </g>
          </g>
        )}
        
        {/* Node label */}
        <text
          x={position.x + 12}
          y={position.y + height/2}
          dominantBaseline="middle"
          fill={textColor}
          fontSize="13"
          fontWeight="500"
          className="pointer-events-none"
        >
          {node.label.length > (width/8) ? node.label.substring(0, width/8) + '...' : node.label}
        </text>

        {/* Section number badge */}
        {node.sectionNumber && (
          <rect
            x={position.x + width - 45}
            y={position.y + 4}
            width="30"
            height="16"
            rx="8"
            fill="rgba(59, 130, 246, 0.1)"
            stroke="rgba(59, 130, 246, 0.3)"
            strokeWidth="1"
          />
        )}
        {node.sectionNumber && (
          <text
            x={position.x + width - 30}
            y={position.y + 12}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={textColor}
            fontSize="9"
            fontWeight="500"
            className="pointer-events-none"
          >
            {node.sectionNumber}
          </text>
        )}
      </g>
    );
  };

  const renderCentralNode = (central) => {
    const position = nodePositions.get('root') || { x: 100, y: 100 };
    const isSelected = selectedNode?.id === central.id;
    const isExpanded = expandedNodes.has('root');
    
    const width = 400;
    const height = 50;
    
    return (
      <g key={central.id}>
        {/* Central node background - NotebookLM style */}
        <rect
          x={position.x}
          y={position.y}
          width={width}
          height={height}
          rx="12"
          fill="#1E40AF"
          stroke={isSelected ? '#1D4ED8' : '#3B82F6'}
          strokeWidth="2"
          className="cursor-pointer transition-all duration-300 hover:brightness-110 drop-shadow-lg"
          onClick={() => setSelectedNode(central)}
        />
        
        {/* Central node label */}
        <text
          x={position.x + 20}
          y={position.y + height/2}
          dominantBaseline="middle"
          fill="white"
          fontSize="16"
          fontWeight="600"
          className="pointer-events-none"
        >
          {central.label}
        </text>

        {/* Description */}
        {central.description && (
          <text
            x={position.x + 20}
            y={position.y + height + 20}
            dominantBaseline="middle"
            fill="#6B7280"
            fontSize="12"
            className="pointer-events-none"
          >
            {central.description}
          </text>
        )}

        {/* Expand/collapse button for central node */}
        <g>
          {/* Invisible larger click area for better UX */}
          <rect
            x={position.x + width - 40}
            y={position.y + height/2 - 18}
            width="36"
            height="36"
            fill="transparent"
            className="cursor-pointer"
            style={{ 
              pointerEvents: isToggling ? 'none' : 'all'
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isToggling) {
                console.log(`Toggling root node, current state: ${isExpanded}`);
                toggleNodeExpansion('root');
              }
            }}
          />
          {/* Visual button */}
          <circle
            cx={position.x + width - 22}
            cy={position.y + height/2}
            r="12"
            fill={isToggling ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.95)'}
            stroke="white"
            strokeWidth="2"
            className="pointer-events-none transition-all duration-150"
            style={{
              filter: isToggling ? 'brightness(0.9)' : 'none'
            }}
          />
          {/* Plus/Minus icon */}
          <g className="pointer-events-none">
            {/* Horizontal line (always present) */}
            <line
              x1={position.x + width - 28}
              y1={position.y + height/2}
              x2={position.x + width - 16}
              y2={position.y + height/2}
              stroke="#1E40AF"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="transition-all duration-150"
            />
            {/* Vertical line (only when collapsed) */}
            {!isExpanded && (
              <line
                x1={position.x + width - 22}
                y1={position.y + height/2 - 6}
                x2={position.x + width - 22}
                y2={position.y + height/2 + 6}
                stroke="#1E40AF"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="transition-all duration-150"
              />
            )}
          </g>
        </g>
      </g>
    );
  };

  const renderConnections = () => {
    if (!mindmapData?.connections || !nodePositions.size) return null;
    
    return mindmapData.connections.map((conn) => {
      const fromPos = nodePositions.get(conn.from);
      const toPos = nodePositions.get(conn.to);
      
      // Only render connections where both nodes are positioned (visible)
      if (!fromPos || !toPos) return null;
      
      // NotebookLM-style connections (straight lines from right edge to left edge)
      const fromX = conn.from === 'root' ? fromPos.x + 400 : fromPos.x + 280; // Adjust based on node width
      const fromY = conn.from === 'root' ? fromPos.y + 25 : fromPos.y + 20; // Center of node height
      const toX = toPos.x;
      const toY = toPos.y + 20; // Center of target node height
      
      // Create L-shaped connection like NotebookLM
      const midX = fromX + 20;
      
      return (
        <g key={`${conn.from}-${conn.to}`} className="pointer-events-none">
          {/* Horizontal line from parent */}
          <line
            x1={fromX}
            y1={fromY}
            x2={midX}
            y2={fromY}
            stroke="#CBD5E1"
            strokeWidth="1.5"
            opacity="0.8"
          />
          {/* Vertical line */}
          <line
            x1={midX}
            y1={fromY}
            x2={midX}
            y2={toY}
            stroke="#CBD5E1"
            strokeWidth="1.5"
            opacity="0.8"
          />
          {/* Horizontal line to child */}
          <line
            x1={midX}
            y1={toY}
            x2={toX}
            y2={toY}
            stroke="#CBD5E1"
            strokeWidth="1.5"
            opacity="0.8"
          />
        </g>
      );
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader className="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-2 text-sm text-gray-600">Loading mindmap...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Project Mindmap</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={generateMindmap}
            disabled={isGenerating}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Generating...' : mindmapData ? 'Regenerate' : 'Generate'}
          </button>
          
          {mindmapData && (
            <div className="relative group">
              <button className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                <Download className="h-4 w-4 mr-2" />
                Export
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <button
                  onClick={() => exportMindmap('json')}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Export as JSON
                </button>
                <button
                  onClick={() => exportMindmap('mermaid')}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Export as Mermaid
                </button>
                <button
                  onClick={() => exportMindmap('graphviz')}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Export as Graphviz
                </button>
              </div>
            </div>
          )}
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

      {/* Mindmap Content */}
      <div className="relative bg-white" style={{ height: '700px' }}>
        {mindmapData ? (
          <div ref={containerRef} className="w-full h-full overflow-hidden">
            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              viewBox="0 0 1400 1000"
              preserveAspectRatio="xMidYMid meet"
              className="cursor-move w-full h-full"
              style={{
                transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                transformOrigin: 'center center',
                minWidth: '100%',
                minHeight: '100%'
              }}
              onMouseDown={(e) => {
                // Only pan if clicking on empty space (not on nodes)
                if (e.target.tagName === 'svg' || (e.target.tagName === 'rect' && e.target.getAttribute('width') === '100%')) {
                  const startX = e.clientX - pan.x;
                  const startY = e.clientY - pan.y;
                  
                  const handleMouseMove = (e) => {
                    setPan({
                      x: e.clientX - startX,
                      y: e.clientY - startY
                    });
                  };
                  
                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                  };
                  
                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                }
              }}
            >
              {/* Clean white background */}
              <rect width="100%" height="100%" fill="white" />
              
              {/* Render connections first (behind nodes) */}
              {renderConnections()}
              
              {/* Render central node */}
              {mindmapData.central && renderCentralNode(mindmapData.central)}
              
              {/* Render visible nodes only */}
              {mindmapData.nodes && mindmapData.nodes
                .filter(node => {
                  // Only show nodes that have been positioned (i.e., are visible)
                  return nodePositions.has(node.id);
                })
                .map(node => renderNode(node))
              }
            </svg>
            
            {/* Floating controls */}
            <div className="absolute top-4 right-4 flex flex-col space-y-2">
              <button
                onClick={handleZoomIn}
                className="p-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200"
                title="Zoom In"
              >
                <ZoomIn className="h-4 w-4 text-gray-600" />
              </button>
              <button
                onClick={handleZoomOut}
                className="p-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200"
                title="Zoom Out"
              >
                <ZoomOut className="h-4 w-4 text-gray-600" />
              </button>
              <button
                onClick={fitToScreen}
                className="p-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200"
                title="Fit to Screen"
              >
                <Maximize2 className="h-4 w-4 text-gray-600" />
              </button>
              <button
                onClick={resetView}
                className="p-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200"
                title="Reset View"
              >
                <RefreshCw className="h-4 w-4 text-gray-600" />
              </button>
              
              {/* Zoom indicator */}
              <div className="px-2 py-1 bg-white rounded-lg shadow-md border border-gray-200 text-xs text-gray-600 text-center min-w-[60px]">
                {Math.round(zoom * 100)}%
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No mindmap available</h3>
              <p className="mt-1 text-sm text-gray-500">
                Generate a mindmap to visualize the project structure and relationships.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Node Details Panel */}
      {selectedNode && (
        <div className="border-t border-gray-200 p-6 bg-gradient-to-r from-gray-50 to-blue-50">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-gray-900 mb-1">{selectedNode.label}</h4>
              {(selectedNode.section || selectedNode.subsection) && (
                <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full mb-2">
                  {selectedNode.section || selectedNode.subsection}
                </span>
              )}
            </div>
            <div 
              className="w-6 h-6 rounded-full border-2 border-white shadow-sm" 
              style={{ backgroundColor: selectedNode.color }}
            ></div>
          </div>
          
          {selectedNode.description && (
            <p className="text-sm text-gray-700 mb-3 leading-relaxed">{selectedNode.description}</p>
          )}
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-500">Type:</span>
              <span className="ml-2 capitalize">{selectedNode.type}</span>
            </div>
            <div>
              <span className="font-medium text-gray-500">Priority:</span>
              <span className={`ml-2 capitalize ${
                selectedNode.priority === 'high' ? 'text-red-600 font-medium' :
                selectedNode.priority === 'medium' ? 'text-yellow-600' :
                'text-green-600'
              }`}>
                {selectedNode.priority}
              </span>
            </div>
            {selectedNode.hasChildren && (
              <div>
                <span className="font-medium text-gray-500">Expandable:</span>
                <span className="ml-2">{expandedNodes.has(selectedNode.id) ? 'Expanded' : 'Collapsed'}</span>
              </div>
            )}
            {selectedNode.parentId && (
              <div>
                <span className="font-medium text-gray-500">Parent:</span>
                <span className="ml-2">
                  {selectedNode.parentId === 'root' ? 'Root' : 
                   mindmapData.nodes?.find(n => n.id === selectedNode.parentId)?.label || 'Unknown'}
                </span>
              </div>
            )}
          </div>
          
          {selectedNode.hasChildren && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <button
                onClick={() => toggleNodeExpansion(selectedNode.id)}
                className="inline-flex items-center px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                {expandedNodes.has(selectedNode.id) ? (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Collapse
                  </>
                ) : (
                  <>
                    <ChevronRight className="h-4 w-4 mr-1" />
                    Expand
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mindmap Stats */}
      {mindmapData && mindmapData.metadata && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-gray-900">
                {mindmapData.metadata.nodeCount || 0}
              </div>
              <div className="text-sm text-gray-500">Nodes</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">
                {mindmapData.metadata.connectionCount || 0}
              </div>
              <div className="text-sm text-gray-500">Connections</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">
                {mindmapData.metadata.version || '1.0'}
              </div>
              <div className="text-sm text-gray-500">Version</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MindmapViewer;