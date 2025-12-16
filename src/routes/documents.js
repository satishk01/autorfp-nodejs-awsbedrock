const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const documentProcessor = require('../services/documentProcessor');
const logger = require('../utils/logger');
const config = require('../config');

const router = express.Router();

// Upload and process documents
router.post('/upload', async (req, res) => {
  try {
    const uploadedFiles = req.files || [];
    
    if (uploadedFiles.length === 0) {
      return res.status(400).json({
        error: 'No files uploaded'
      });
    }

    const results = [];
    
    for (const file of uploadedFiles) {
      try {
        // Validate document
        const validation = documentProcessor.validateDocument(file.path, file.originalname);
        
        if (!validation.valid) {
          results.push({
            fileName: file.originalname,
            success: false,
            error: validation.error
          });
          continue;
        }

        // Process document
        const processed = await documentProcessor.processDocument(file.path, file.originalname);
        
        results.push({
          fileName: file.originalname,
          success: true,
          fileId: file.filename,
          metadata: processed.metadata,
          preview: processed.content.substring(0, 500) + (processed.content.length > 500 ? '...' : ''),
          structuredData: processed.structuredData
        });

      } catch (error) {
        logger.error(`Error processing file ${file.originalname}:`, error);
        results.push({
          fileName: file.originalname,
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Processed ${results.length} files`,
      results,
      successCount: results.filter(r => r.success).length,
      errorCount: results.filter(r => !r.success).length
    });

  } catch (error) {
    logger.error('Error in document upload:', error);
    res.status(500).json({
      error: 'Failed to process uploaded documents',
      details: error.message
    });
  }
});

// Get document content
router.get('/:fileId/content', async (req, res) => {
  try {
    const { fileId } = req.params;
    const filePath = path.join(config.upload.uploadDir, fileId);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({
        error: 'Document not found',
        fileId
      });
    }

    // Get file stats
    const stats = await fs.stat(filePath);
    
    // Find original name (this would typically be stored in a database)
    const originalName = fileId; // Simplified - in production, store mapping
    
    // Process document
    const processed = await documentProcessor.processDocument(filePath, originalName);
    
    res.json({
      success: true,
      fileId,
      content: processed.content,
      metadata: processed.metadata,
      structuredData: processed.structuredData
    });

  } catch (error) {
    logger.error('Error fetching document content:', error);
    res.status(500).json({
      error: 'Failed to fetch document content',
      details: error.message
    });
  }
});

// Get document metadata
router.get('/:fileId/metadata', async (req, res) => {
  try {
    const { fileId } = req.params;
    const filePath = path.join(config.upload.uploadDir, fileId);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({
        error: 'Document not found',
        fileId
      });
    }

    // Get file stats
    const stats = await fs.stat(filePath);
    const originalName = fileId; // Simplified
    
    // Get basic metadata without full processing
    const extension = path.extname(originalName).toLowerCase().slice(1);
    
    res.json({
      success: true,
      fileId,
      metadata: {
        fileName: originalName,
        fileType: extension,
        size: stats.size,
        uploadedAt: stats.birthtime,
        modifiedAt: stats.mtime
      }
    });

  } catch (error) {
    logger.error('Error fetching document metadata:', error);
    res.status(500).json({
      error: 'Failed to fetch document metadata',
      details: error.message
    });
  }
});

// Delete document
router.delete('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const filePath = path.join(config.upload.uploadDir, fileId);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({
        error: 'Document not found',
        fileId
      });
    }

    // Delete file
    await fs.unlink(filePath);
    
    res.json({
      success: true,
      message: 'Document deleted successfully',
      fileId
    });

  } catch (error) {
    logger.error('Error deleting document:', error);
    res.status(500).json({
      error: 'Failed to delete document',
      details: error.message
    });
  }
});

// List uploaded documents
router.get('/', async (req, res) => {
  try {
    const uploadDir = config.upload.uploadDir;
    
    // Read directory
    const files = await fs.readdir(uploadDir);
    const documents = [];
    
    for (const file of files) {
      try {
        const filePath = path.join(uploadDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          documents.push({
            fileId: file,
            fileName: file, // In production, store original names
            size: stats.size,
            uploadedAt: stats.birthtime,
            modifiedAt: stats.mtime,
            extension: path.extname(file).toLowerCase().slice(1)
          });
        }
      } catch (error) {
        logger.warn(`Error reading file ${file}:`, error);
      }
    }

    res.json({
      success: true,
      documents,
      count: documents.length
    });

  } catch (error) {
    logger.error('Error listing documents:', error);
    res.status(500).json({
      error: 'Failed to list documents',
      details: error.message
    });
  }
});

// Validate document format
router.post('/validate', async (req, res) => {
  try {
    const uploadedFiles = req.files || [];
    
    if (uploadedFiles.length === 0) {
      return res.status(400).json({
        error: 'No files provided for validation'
      });
    }

    const validationResults = [];
    
    for (const file of uploadedFiles) {
      const validation = documentProcessor.validateDocument(file.path, file.originalname);
      
      validationResults.push({
        fileName: file.originalname,
        valid: validation.valid,
        error: validation.error,
        fileType: path.extname(file.originalname).toLowerCase().slice(1),
        size: file.size
      });
    }

    res.json({
      success: true,
      validationResults,
      validCount: validationResults.filter(r => r.valid).length,
      invalidCount: validationResults.filter(r => !r.valid).length
    });

  } catch (error) {
    logger.error('Error validating documents:', error);
    res.status(500).json({
      error: 'Failed to validate documents',
      details: error.message
    });
  }
});

// Extract text preview from document
router.get('/:fileId/preview', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { length = 1000 } = req.query;
    const filePath = path.join(config.upload.uploadDir, fileId);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({
        error: 'Document not found',
        fileId
      });
    }

    const originalName = fileId; // Simplified
    
    // Process document
    const processed = await documentProcessor.processDocument(filePath, originalName);
    
    // Create preview
    const previewLength = parseInt(length);
    const preview = processed.content.substring(0, previewLength);
    const truncated = processed.content.length > previewLength;
    
    res.json({
      success: true,
      fileId,
      preview,
      truncated,
      totalLength: processed.content.length,
      previewLength: preview.length,
      metadata: processed.metadata
    });

  } catch (error) {
    logger.error('Error generating document preview:', error);
    res.status(500).json({
      error: 'Failed to generate document preview',
      details: error.message
    });
  }
});

// Download document
router.get('/download/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const filePath = path.resolve(config.upload.uploadDir, fileId);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({
        error: 'Document not found',
        fileId
      });
    }

    // Get file stats
    const stats = await fs.stat(filePath);
    
    // Try to get original name from database (simplified for now)
    let originalName = fileId;
    
    // If we have database access, try to get the original name
    try {
      const dataService = require('../services/dataService');
      await dataService.initialize();
      
      // This is a simplified query - in production you'd have a proper document lookup
      const db = require('../database/database').db;
      const doc = await db.get('SELECT original_name FROM documents WHERE id = ?', [fileId]);
      if (doc && doc.original_name) {
        originalName = doc.original_name;
      }
    } catch (error) {
      logger.warn('Could not fetch original filename from database:', error.message);
    }

    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', stats.size);

    // Stream the file
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    logger.error('Error downloading document:', error);
    res.status(500).json({
      error: 'Failed to download document',
      details: error.message
    });
  }
});

// View document (for PDFs and other viewable formats)
router.get('/view/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const filePath = path.resolve(config.upload.uploadDir, fileId);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({
        error: 'Document not found',
        fileId
      });
    }

    // Get file stats and determine MIME type
    const stats = await fs.stat(filePath);
    const extension = path.extname(fileId).toLowerCase();
    
    let mimeType = 'application/octet-stream';
    switch (extension) {
      case '.pdf':
        mimeType = 'application/pdf';
        break;
      case '.txt':
        mimeType = 'text/plain';
        break;
      case '.html':
        mimeType = 'text/html';
        break;
      case '.json':
        mimeType = 'application/json';
        break;
      default:
        mimeType = 'application/octet-stream';
    }

    // Set headers for inline viewing
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', 'inline');

    // Stream the file
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    logger.error('Error viewing document:', error);
    res.status(500).json({
      error: 'Failed to view document',
      details: error.message
    });
  }
});

// Get supported file formats
router.get('/formats/supported', (req, res) => {
  res.json({
    success: true,
    supportedFormats: config.upload.allowedTypes,
    maxFileSize: config.upload.maxFileSize,
    description: {
      pdf: 'Portable Document Format',
      docx: 'Microsoft Word Document',
      txt: 'Plain Text File',
      csv: 'Comma Separated Values',
      xlsx: 'Microsoft Excel Spreadsheet',
      xls: 'Microsoft Excel Spreadsheet (Legacy)'
    }
  });
});

module.exports = router;