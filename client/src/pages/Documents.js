import React, { useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import { Link } from 'react-router-dom';

const WorkingDocuments = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocuments, setSelectedDocuments] = useState(new Set());
  const [typeFilter, setTypeFilter] = useState('all');

  // Fetch documents
  const { data: documents, isLoading, refetch } = useQuery(
    'documents-list',
    () => fetch('/api/documents').then(res => res.json()),
    { refetchInterval: 30000 }
  );

  // Delete document mutation
  const deleteMutation = useMutation(
    (documentId) => fetch(`/api/documents/${documentId}`, { method: 'DELETE' }).then(res => res.json()),
    {
      onSuccess: () => {
        refetch();
        setSelectedDocuments(new Set());
      }
    }
  );

  const documentsList = documents?.documents || [];
  
  // Filter documents
  const filteredDocuments = documentsList.filter(doc => {
    const matchesSearch = doc.fileName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.fileId?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || doc.extension === typeFilter;
    return matchesSearch && matchesType;
  });

  // Get unique file types for filter
  const fileTypes = [...new Set(documentsList.map(doc => doc.extension).filter(Boolean))];

  const handleDocumentSelect = (documentId) => {
    const newSelected = new Set(selectedDocuments);
    if (newSelected.has(documentId)) {
      newSelected.delete(documentId);
    } else {
      newSelected.add(documentId);
    }
    setSelectedDocuments(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selectedDocuments.size === 0) return;
    
    if (window.confirm(`Are you sure you want to delete ${selectedDocuments.size} document(s)? This action cannot be undone.`)) {
      for (const documentId of selectedDocuments) {
        await deleteMutation.mutateAsync(documentId);
      }
    }
  };

  const handleDownload = (documentId, fileName) => {
    const downloadUrl = `/api/documents/download/${documentId}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName || documentId;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleView = (documentId) => {
    window.open(`/api/documents/view/${documentId}`, '_blank');
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (extension) => {
    switch (extension?.toLowerCase()) {
      case 'pdf':
        return '📄';
      case 'docx':
      case 'doc':
        return '📝';
      case 'xlsx':
      case 'xls':
        return '📊';
      case 'txt':
        return '📃';
      case 'csv':
        return '📋';
      default:
        return '📁';
    }
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
            Documents
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage and organize your uploaded documents
          </p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4 space-x-3">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            🔄 Refresh
          </button>
          <Link
            to="/upload"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            📤 Upload Documents
          </Link>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="all">All Types</option>
                {fileTypes.map(type => (
                  <option key={type} value={type}>{type.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedDocuments.size > 0 && (
        <div className="bg-blue-50 px-4 py-3 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-sm text-blue-700">
                {selectedDocuments.size} document{selectedDocuments.size > 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSelectedDocuments(new Set())}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear selection
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={deleteMutation.isLoading}
                className="inline-flex items-center px-3 py-1 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
              >
                🗑️ {deleteMutation.isLoading ? 'Deleting...' : 'Delete Selected'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Documents List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {filteredDocuments.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {filteredDocuments.map((document) => {
              const isSelected = selectedDocuments.has(document.fileId);
              
              return (
                <li key={document.fileId} className="hover:bg-gray-50">
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleDocumentSelect(document.fileId)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-4"
                        />
                        <div className="flex items-center">
                          <span className="text-2xl mr-3">
                            {getFileIcon(document.extension)}
                          </span>
                          <div>
                            <div className="flex items-center">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {document.fileName || document.fileId}
                              </p>
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {document.extension?.toUpperCase() || 'Unknown'}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center text-sm text-gray-500">
                              <span className="mr-6">{formatFileSize(document.size)}</span>
                              <span>{new Date(document.uploadedAt).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleView(document.fileId)}
                          className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                        >
                          👁️ View
                        </button>
                        <button
                          onClick={() => handleDownload(document.fileId, document.fileName)}
                          className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                        >
                          💾 Download
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📄</div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {searchTerm || typeFilter !== 'all' ? 'No documents match your search' : 'No documents yet'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || typeFilter !== 'all' 
                ? 'Try adjusting your search terms or filters.'
                : 'Get started by uploading your first document.'
              }
            </p>
            {!searchTerm && typeFilter === 'all' && (
              <div className="mt-6">
                <Link
                  to="/upload"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  📤 Upload Documents
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {documentsList.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Document Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{documentsList.length}</div>
              <div className="text-sm text-gray-500">Total Documents</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formatFileSize(documentsList.reduce((sum, doc) => sum + (doc.size || 0), 0))}
              </div>
              <div className="text-sm text-gray-500">Total Size</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{fileTypes.length}</div>
              <div className="text-sm text-gray-500">File Types</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {documentsList.filter(doc => doc.uploadedAt && 
                  new Date(doc.uploadedAt) > new Date(Date.now() - 24*60*60*1000)).length}
              </div>
              <div className="text-sm text-gray-500">Uploaded Today</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkingDocuments;