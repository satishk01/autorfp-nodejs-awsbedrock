const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const config = require('../config');
const logger = require('../utils/logger');

class BedrockService {
  constructor() {
    this.client = new BedrockRuntimeClient({
      region: config.aws.region,
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey
      }
    });
    this.defaultModelId = config.aws.bedrockModelId;
    this.mindmapModelId = config.aws.bedrockMindmapModelId;
  }

  async invokeModel(prompt, maxTokens = 4000, temperature = 0.1, modelId = null) {
    try {
      // Use specified model or default to the standard model
      const selectedModelId = modelId || this.defaultModelId;
      
      const body = JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: maxTokens,
        temperature: temperature,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      });

      const command = new InvokeModelCommand({
        modelId: selectedModelId,
        body: body,
        contentType: 'application/json',
        accept: 'application/json'
      });

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Bedrock request timeout after 60 seconds')), 60000);
      });

      const response = await Promise.race([
        this.client.send(command),
        timeoutPromise
      ]);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      logger.info('Bedrock model invoked successfully', {
        modelId: selectedModelId,
        inputTokens: responseBody.usage?.input_tokens,
        outputTokens: responseBody.usage?.output_tokens
      });

      return responseBody.content[0].text;
    } catch (error) {
      logger.error('Error invoking Bedrock model:', error);
      throw new Error(`Bedrock invocation failed: ${error.message}`);
    }
  }

  async streamModel(prompt, onChunk, maxTokens = 4000, temperature = 0.1, modelId = null) {
    try {
      // Use specified model or default to the standard model
      const selectedModelId = modelId || this.defaultModelId;
      
      const body = JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: maxTokens,
        temperature: temperature,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      });

      const command = new InvokeModelCommand({
        modelId: selectedModelId,
        body: body,
        contentType: 'application/json',
        accept: 'application/json'
      });

      // For streaming, we'll simulate chunks for now
      // AWS Bedrock streaming would require different setup
      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const fullText = responseBody.content[0].text;
      
      // Simulate streaming by sending chunks
      const chunkSize = 50;
      for (let i = 0; i < fullText.length; i += chunkSize) {
        const chunk = fullText.slice(i, i + chunkSize);
        onChunk(chunk);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      return fullText;
    } catch (error) {
      logger.error('Error streaming Bedrock model:', error);
      throw new Error(`Bedrock streaming failed: ${error.message}`);
    }
  }

  /**
   * Invoke the high-performance model specifically for mindmap generation
   */
  async invokeMindmapModel(prompt, maxTokens = 8000, temperature = 0.1) {
    logger.info('Using high-performance model for mindmap generation', { 
      modelId: this.mindmapModelId,
      maxTokens,
      temperature
    });
    return this.invokeModel(prompt, maxTokens, temperature, this.mindmapModelId);
  }

  /**
   * Get the model IDs for reference
   */
  getModelIds() {
    return {
      default: this.defaultModelId,
      mindmap: this.mindmapModelId
    };
  }
}

module.exports = new BedrockService();