import { config } from 'dotenv';

// Load environment variables from .env file
config({ quiet: true });

interface AppConfig {
  qdrantUrl: string;
  qdrantApiKey?: string;
  mcpUploadDir: string;
  openaiApiKey?: string;
  openaiEndpoint?: string;
  openrouterApiKey?: string;
  openrouterEndpoint?: string;
  ollamaApiKey?: string;
  ollamaEndpoint?: string;
  fastembedApiKey?: string;
  fastembedEndpoint?: string; // FastEmbed typically runs locally, but an endpoint might be useful for remote FastEmbed services
  embeddingModel?: string;
  embeddingProvider: string;
}

const appConfig: AppConfig = {
  qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
  qdrantApiKey: process.env.QDRANT_API_KEY,
  mcpUploadDir: process.env.MCP_UPLOAD_DIR || '/tmp/mcp-uploads',
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiEndpoint: process.env.OPENAI_ENDPOINT,
  openrouterApiKey: process.env.OPENROUTER_API_KEY,
  openrouterEndpoint: process.env.OPENROUTER_ENDPOINT,
  ollamaApiKey: process.env.OLLAMA_API_KEY,
  ollamaEndpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',
  fastembedApiKey: process.env.FASTEMBED_API_KEY,
  fastembedEndpoint: process.env.FASTEMBED_ENDPOINT,
  embeddingModel: process.env.EMBEDDING_MODEL,
  embeddingProvider: process.env.EMBEDDING_PROVIDER || 'ollama'
};

// Basic validation (can be expanded with a validation library like zod or joi)
function validateConfig(config: AppConfig): void {
  if (!config.qdrantUrl) {
    throw new Error('Configuration Error: QDRANT_URL is required.');
  }
  // Add more validation as needed, e.g., for API keys if services are enabled
}

try {
  validateConfig(appConfig);
} catch (error) {
  console.error('Failed to load application configuration:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}

export default appConfig;
