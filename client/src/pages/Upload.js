import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { 
  Upload as UploadIcon, 
  File, 
  X, 
  AlertCircle, 
  CheckCircle,
  Loader
} from 'lucide-react';

const Upload = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [projectContext, setProjectContext] = useState({
    title: '',
    client: '',
    deadline: '',
    description: ''
  });
  const [companyDocuments, setCompanyDocuments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    // Handle accepted files
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'ready'
    }));
    
    setFiles(prev => [...prev, ...newFiles]);

    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles.map(({ file, errors }) => 
        `${file.name}: ${errors.map(e => e.message).join(', ')}`
      );
      setUploadError(`Some files were rejected: ${errors.join('; ')}`);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    maxFiles: 10
  });

  const removeFile = (fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleProjectContextChange = (field, value) => {
    setProjectContext(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addCompanyDocument = () => {
    setCompanyDocuments(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      type: 'company_profile',
      description: ''
    }]);
  };

  const updateCompanyDocument = (id, field, value) => {
    setCompanyDocuments(prev => prev.map(doc => 
      doc.id === id ? { ...doc, [field]: value } : doc
    ));
  };

  const removeCompanyDocument = (id) => {
    setCompanyDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (files.length === 0) {
      setUploadError('Please select at least one RFP document');
      return;
    }

    if (!projectContext.title.trim()) {
      setUploadError('Please provide a project title');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      
      // Add files
      files.forEach(({ file }) => {
        formData.append('documents', file);
      });

      // Add project context
      formData.append('projectContext', JSON.stringify(projectContext));
      
      // Add company documents
      formData.append('companyDocuments', JSON.stringify(companyDocuments));

      const response = await fetch('/api/process-rfp', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        navigate(`/workflow/${result.workflowId}`);
      } else {
        setUploadError(result.error || 'Upload failed');
      }
    } catch (error) {
      setUploadError('Network error: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload RFP Documents</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload your RFP documents to start the automated analysis process
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Project Context */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Project Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Project Title *
              </label>
              <input
                type="text"
                value={projectContext.title}
                onChange={(e) => handleProjectContextChange('title', e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter project title"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Client Name
              </label>
              <input
                type="text"
                value={projectContext.client}
                onChange={(e) => handleProjectContextChange('client', e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter client name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Deadline
              </label>
              <input
                type="date"
                value={projectContext.deadline}
                onChange={(e) => handleProjectContextChange('deadline', e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                Project Description
              </label>
              <textarea
                value={projectContext.description}
                onChange={(e) => handleProjectContextChange('description', e.target.value)}
                rows={3}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Brief description of the project"
              />
            </div>
          </div>
        </div>

        {/* File Upload */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">RFP Documents</h2>
          
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDragActive 
                ? 'border-blue-400 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <UploadIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              {isDragActive
                ? 'Drop the files here...'
                : 'Drag & drop files here, or click to select files'
              }
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Supports PDF, DOCX, TXT, CSV, XLSX files up to 50MB each
            </p>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-medium text-gray-900">Selected Files</h3>
              {files.map(({ file, id, status }) => (
                <div key={id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <File className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {status === 'ready' && <CheckCircle className="h-4 w-4 text-green-500" />}
                    <button
                      type="button"
                      onClick={() => removeFile(id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Company Documents */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Company Documents</h2>
            <button
              type="button"
              onClick={addCompanyDocument}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              + Add Document Reference
            </button>
          </div>
          
          {companyDocuments.length === 0 ? (
            <p className="text-sm text-gray-500">
              Add references to company documents that should be used for answer extraction
            </p>
          ) : (
            <div className="space-y-4">
              {companyDocuments.map((doc) => (
                <div key={doc.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Document Name
                      </label>
                      <input
                        type="text"
                        value={doc.name}
                        onChange={(e) => updateCompanyDocument(doc.id, 'name', e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Company Profile"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Document Type
                      </label>
                      <select
                        value={doc.type}
                        onChange={(e) => updateCompanyDocument(doc.id, 'type', e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="company_profile">Company Profile</option>
                        <option value="case_study">Case Study</option>
                        <option value="technical_docs">Technical Documentation</option>
                        <option value="past_proposal">Past Proposal</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeCompanyDocument(doc.id)}
                        className="text-red-500 hover:text-red-700 p-2"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <textarea
                      value={doc.description}
                      onChange={(e) => updateCompanyDocument(doc.id, 'description', e.target.value)}
                      rows={2}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Brief description of the document content"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error Display */}
        {uploadError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Upload Error</h3>
                <p className="mt-1 text-sm text-red-700">{uploadError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isUploading || files.length === 0}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <Loader className="animate-spin -ml-1 mr-3 h-5 w-5" />
                Processing...
              </>
            ) : (
              <>
                <UploadIcon className="-ml-1 mr-3 h-5 w-5" />
                Start Processing
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Upload;