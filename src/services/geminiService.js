const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');
const logger = require('../utils/logger');

class GeminiService {
  constructor() {
    if (!config.google.apiKey) {
      throw new Error('Google API key not configured. Please set GOOGLE_API_KEY environment variable.');
    }
    
    this.genAI = new GoogleGenerativeAI(config.google.apiKey);
    
    // Use the configured model or fall back to available models
    this.modelName = config.google.geminiModelId;
    
    this.model = this.genAI.getGenerativeModel({ 
      model: this.modelName,
      generationConfig: {
        temperature: 0.1,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 16384, // Increased for detailed NotebookLM-style output
      }
    });
    
    logger.info('Gemini service initialized', { 
      modelId: this.modelName 
    });
  }

  async generateMindmap(prompt) {
    try {
      logger.info('Generating mindmap with Gemini (NotebookLM-style)', {
        modelId: this.modelName,
        promptLength: prompt.length
      });

      const startTime = Date.now();
      
      // Try different models if the current one fails
      let result;
      const modelsToTry = [
        'models/gemini-2.5-flash',
        'models/gemini-flash-latest',
        'models/gemini-2.5-flash-lite',
        'models/gemini-pro-latest'
      ];
      
      for (const modelName of modelsToTry) {
        try {
          const model = this.genAI.getGenerativeModel({ 
            model: modelName,
            generationConfig: {
              temperature: 0.1,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 16384, // Increased for detailed NotebookLM-style output
            }
          });
          
          result = await model.generateContent(prompt);
          this.modelName = modelName; // Update successful model
          logger.info(`Successfully used model: ${modelName}`);
          break;
        } catch (modelError) {
          logger.warn(`Model ${modelName} failed: ${modelError.message}`);
          continue;
        }
      }
      
      if (!result) {
        throw new Error('All Gemini models failed');
      }
      
      const response = await result.response;
      const text = response.text();
      
      const endTime = Date.now();
      
      logger.info('Gemini mindmap generation completed', {
        responseLength: text.length,
        processingTime: `${endTime - startTime}ms`,
        modelId: this.modelName
      });

      // Validate that we got a reasonable response
      if (!text || text.length < 100) {
        throw new Error('Gemini returned empty or very short response');
      }

      // Check if response contains expected mindmap structure
      if (!text.includes('central') && !text.includes('nodes')) {
        logger.warn('Gemini response may not contain valid mindmap structure');
        logger.debug('Response preview:', text.substring(0, 500));
      }

      return text;
      
    } catch (error) {
      logger.error('Error generating mindmap with Gemini:', error);
      throw new Error(`Gemini mindmap generation failed: ${error.message}`);
    }
  }

  async generateContent(prompt, options = {}) {
    try {
      const generationConfig = {
        temperature: options.temperature || 0.1,
        topK: options.topK || 40,
        topP: options.topP || 0.95,
        maxOutputTokens: options.maxOutputTokens || 4096,
      };

      const model = this.genAI.getGenerativeModel({ 
        model: config.google.geminiModelId,
        generationConfig
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      
      logger.info('Gemini content generated successfully', {
        modelId: config.google.geminiModelId,
        responseLength: response.text().length
      });

      return response.text();
      
    } catch (error) {
      logger.error('Error generating content with Gemini:', error);
      throw new Error(`Gemini content generation failed: ${error.message}`);
    }
  }

  getModelInfo() {
    return {
      provider: 'Google',
      modelId: config.google.geminiModelId,
      apiKey: config.google.apiKey ? 'configured' : 'not configured'
    };
  }
}

module.exports = new GeminiService();