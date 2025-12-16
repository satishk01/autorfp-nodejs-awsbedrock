const bedrockService = require('../services/bedrock');
const logger = require('../utils/logger');

class BaseAgent {
  constructor(name, systemPrompt) {
    this.name = name;
    this.systemPrompt = systemPrompt;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
  }

  async execute(input, context = {}) {
    logger.info(`Executing agent: ${this.name}`, { context });
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const prompt = this.buildPrompt(input, context);
        const result = await bedrockService.invokeModel(prompt);
        
        const processedResult = await this.processResult(result, context);
        
        logger.info(`Agent ${this.name} completed successfully`, {
          attempt,
          resultLength: result.length
        });
        
        return processedResult;
      } catch (error) {
        logger.warn(`Agent ${this.name} attempt ${attempt} failed:`, error);
        
        if (attempt === this.retryAttempts) {
          logger.error(`Agent ${this.name} failed after ${this.retryAttempts} attempts`);
          throw error;
        }
        
        await this.delay(this.retryDelay * attempt);
      }
    }
  }

  async executeStreaming(input, context = {}, onChunk) {
    logger.info(`Executing streaming agent: ${this.name}`, { context });
    
    const prompt = this.buildPrompt(input, context);
    return await bedrockService.streamModel(prompt, onChunk);
  }

  buildPrompt(input, context) {
    let prompt = this.systemPrompt + '\n\n';
    
    if (context.previousResults) {
      prompt += 'Previous Analysis Results:\n';
      Object.entries(context.previousResults).forEach(([key, value]) => {
        prompt += `${key}: ${JSON.stringify(value, null, 2)}\n`;
      });
      prompt += '\n';
    }
    
    prompt += 'Current Input:\n' + input;
    
    return prompt;
  }

  async processResult(result, context) {
    // Base implementation - can be overridden by specific agents
    try {
      // Try to parse as JSON first
      return JSON.parse(result);
    } catch {
      // If not JSON, return as structured text
      return {
        content: result,
        timestamp: new Date().toISOString(),
        agent: this.name
      };
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  validateInput(input) {
    if (!input || typeof input !== 'string') {
      throw new Error('Input must be a non-empty string');
    }
    return true;
  }

  getMetrics() {
    return {
      name: this.name,
      lastExecuted: this.lastExecuted,
      executionCount: this.executionCount || 0,
      averageExecutionTime: this.averageExecutionTime || 0
    };
  }
}

module.exports = { BaseAgent };