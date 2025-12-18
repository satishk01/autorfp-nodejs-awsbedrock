# Cost Optimization - Dual Model Configuration

## Overview
The system now uses a dual-model approach to optimize costs while maintaining high quality for specific tasks.

## Model Configuration

### 🔹 **Default Model (Cost-Effective)**
- **Model**: `anthropic.claude-3-haiku-20240307-v1:0`
- **Used For**: 
  - General RFP processing
  - Requirements analysis
  - Question generation
  - Answer extraction
  - All other AI tasks
- **Cost**: ~$0.25 per 1M input tokens, ~$1.25 per 1M output tokens

### 🔸 **High-Performance Model (Premium)**
- **Model**: `us.anthropic.claude-3-5-sonnet-20241022-v2:0`
- **Used For**: 
  - Mindmap generation only
  - Document structure analysis
  - Complex hierarchical understanding
- **Cost**: ~$3.00 per 1M input tokens, ~$15.00 per 1M output tokens

## Configuration Files

### Environment Variables (.env)
```
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
BEDROCK_MINDMAP_MODEL_ID=us.anthropic.claude-3-5-sonnet-20241022-v2:0
```

### Config (src/config/index.js)
```javascript
aws: {
  bedrockModelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0',
  bedrockMindmapModelId: process.env.BEDROCK_MINDMAP_MODEL_ID || 'us.anthropic.claude-3-5-sonnet-20241022-v2:0'
}
```

## Usage Examples

### Default Model (Haiku) - Cost-Effective
```javascript
// Used by agents, general processing
const result = await bedrockService.invokeModel(prompt);
```

### High-Performance Model (Sonnet) - Premium Quality
```javascript
// Used only for mindmap generation
const result = await bedrockService.invokeMindmapModel(prompt);
```

## Cost Impact Analysis

### Typical Usage Pattern
- **Mindmap Generation**: ~1-2 calls per workflow (high-cost model)
- **Other Processing**: ~10-20 calls per workflow (low-cost model)

### Cost Savings
- **Before**: All calls using Sonnet = ~12x more expensive
- **After**: Only mindmap calls using Sonnet = ~90% cost reduction for non-mindmap tasks

### Example Cost Calculation (per workflow)
- **Mindmap (Sonnet)**: 1,500 input + 2,000 output tokens = ~$0.035
- **Other Tasks (Haiku)**: 15,000 input + 20,000 output tokens = ~$0.029
- **Total per workflow**: ~$0.064 vs ~$0.77 (if all Sonnet) = **92% savings**

## Quality vs Cost Trade-off
- **Mindmap Quality**: Maintained at NotebookLM level (Sonnet)
- **Other Tasks**: Excellent quality maintained (Haiku is very capable for these tasks)
- **Overall Cost**: Dramatically reduced while preserving quality where it matters most

## Monitoring
Check logs for model usage:
- `Using high-performance model for mindmap generation` = Sonnet
- Regular `Bedrock model invoked successfully` = Haiku