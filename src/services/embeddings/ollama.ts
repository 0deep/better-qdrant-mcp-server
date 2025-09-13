import axios from 'axios';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { BaseEmbeddingService } from './base.js';

export class OllamaEmbeddingService extends BaseEmbeddingService {
  // Vector size depends on the model
  // nomic-embed-text produces 768-dimensional embeddings
  readonly vectorSize = 768;

  constructor(endpoint?: string, model?: string) {
    super(undefined, endpoint || 'http://localhost:11434', model || 'nomic-embed-text');
    this.validateConfig();
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const concurrencyLimit = 5; // Limit concurrent requests to avoid overwhelming the server
    const embeddingPromises: Promise<number[]>[] = [];

    for (let i = 0; i < texts.length; i += concurrencyLimit) {
      const batch = texts.slice(i, i + concurrencyLimit);
      const batchPromises = batch.map(async (text) => {
        const response = await axios.post(
          `${this.endpoint}/api/embeddings`,
          {
            model: this.model,
            prompt: text,
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.data.embedding || !Array.isArray(response.data.embedding)) {
          throw new McpError(ErrorCode.InternalError, 'Invalid response from Ollama API');
        }
        return response.data.embedding;
      });
      embeddingPromises.push(...batchPromises);
      await Promise.all(batchPromises); // Wait for the current batch to complete before starting the next
    }

    return Promise.all(embeddingPromises);
  }

  protected requiresApiKey(): boolean {
    return false;
  }

  protected validateConfig(): void {
    if (!this.endpoint) {
      throw new McpError(ErrorCode.InvalidParams, 'Ollama endpoint is required');
    }
  }
}
