#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { createQdrantService } from './services/qdrant.js';
import { createEmbeddingService } from './services/embeddings/index.js';
import { TextProcessor } from './services/text-processing.js';
import { v4 as uuidv4 } from 'uuid';
import { promises as fsPromises } from 'fs';
import path from 'path';
import appConfig from './config.js';
import logger from './logger.js';
import { EmbeddingService } from './types.js';

interface AddDocumentsArgs {
  filePath: string;
  collection: string;
  embeddingService?: 'openai' | 'openrouter' | 'fastembed' | 'ollama';
  chunkSize?: number;
  chunkOverlap?: number;
}

interface SearchArgs {
  query: string;
  collection: string;
  embeddingService?: 'openai' | 'openrouter' | 'fastembed' | 'ollama';
  limit?: number;
}

interface DeleteCollectionArgs {
  collection: string;
}

class BetterQdrantServer {
  private server: Server;
  private qdrantService;
  private textProcessor;


  constructor() {
    this.server = new Server(
      {
        name: 'better-qdrant',
        version: '0.1.1',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize services
    this.qdrantService = createQdrantService(
      appConfig.qdrantUrl,
      appConfig.qdrantApiKey
    );
    this.textProcessor = new TextProcessor();

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => logger.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private sanitizeFilePath(unsafePath: string): string {
    const BASE_UPLOAD_DIR = appConfig.mcpUploadDir;
    const resolvedPath = path.resolve(BASE_UPLOAD_DIR, unsafePath);

    // Ensure the resolved path is still within the base upload directory
    if (!resolvedPath.startsWith(BASE_UPLOAD_DIR)) {
      throw new McpError(ErrorCode.InvalidParams, 'File path attempts to access forbidden directory.');
    }
    return resolvedPath;
  }

  private isAddDocumentsArgs(args: unknown): args is AddDocumentsArgs {
    if (!args || typeof args !== 'object') return false;
    const a = args as Record<string, unknown>;
    return (
      typeof a.filePath === 'string' &&
      typeof a.collection === 'string' &&
      (a.embeddingService === undefined || (typeof a.embeddingService === 'string' && ['openai', 'openrouter', 'fastembed', 'ollama'].includes(a.embeddingService))) &&
      (a.chunkSize === undefined || typeof a.chunkSize === 'number') &&
      (a.chunkOverlap === undefined || typeof a.chunkOverlap === 'number')
    );
  }

  private isSearchArgs(args: unknown): args is SearchArgs {
    if (!args || typeof args !== 'object') return false;
    const a = args as Record<string, unknown>;
    return (
      typeof a.query === 'string' &&
      typeof a.collection === 'string' &&
      (a.embeddingService === undefined || (typeof a.embeddingService === 'string' && ['openai', 'openrouter', 'fastembed', 'ollama'].includes(a.embeddingService))) &&
      (a.limit === undefined || typeof a.limit === 'number')
    );
  }

  private isDeleteCollectionArgs(args: unknown): args is DeleteCollectionArgs {
    if (!args || typeof args !== 'object') return false;
    const a = args as Record<string, unknown>;
    return typeof a.collection === 'string';
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'list_collections',
          description: 'List all available Qdrant collections',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'add_documents',
          description: 'Add documents to a Qdrant collection with specified embedding service',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'Path to the file to process',
              },
              collection: {
                type: 'string',
                description: 'Name of the collection to add documents to',
              },
              embeddingService: {
                type: 'string',
                enum: ['openai', 'openrouter', 'fastembed', 'ollama'],
                description: 'Embedding service to use (optional)',
              },
              chunkSize: {
                type: 'number',
                description: 'Size of text chunks (optional)',
              },
              chunkOverlap: {
                type: 'number',
                description: 'Overlap between chunks (optional)',
              },
              model: {
                type: 'string',
                description: 'Specific model to use for embedding (optional)',
              },
            },
            required: ['filePath', 'collection'],
          },
        },
        {
          name: 'search',
          description: 'Search for similar documents in a collection',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query',
              },
              collection: {
                type: 'string',
                description: 'Name of the collection to search in',
              },
              embeddingService: {
                type: 'string',
                enum: ['openai', 'openrouter', 'fastembed', 'ollama'],
                description: 'Embedding service to use (optional)',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (optional)',
              },
              model: {
                type: 'string',
                description: 'Specific model to use for embedding (optional)',
              },
            },
            required: ['query', 'collection'],
          },
        },
        {
          name: 'delete_collection',
          description: 'Delete a Qdrant collection',
          inputSchema: {
            type: 'object',
            properties: {
              collection: {
                type: 'string',
                description: 'Name of the collection to delete',
              },
            },
            required: ['collection'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'list_collections':
          return this.handleListCollections();
        case 'add_documents':
          if (!this.isAddDocumentsArgs(request.params.arguments)) {
            throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for add_documents');
          }
          return this.handleAddDocuments(request.params.arguments);
        case 'search':
          if (!this.isSearchArgs(request.params.arguments)) {
            throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for search');
          }
          return this.handleSearch(request.params.arguments);
        case 'delete_collection':
          if (!this.isDeleteCollectionArgs(request.params.arguments)) {
            throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for delete_collection');
          }
          return this.handleDeleteCollection(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  private async handleListCollections() {
    try {
      const collections = await this.qdrantService.listCollections();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(collections, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Error in handleListCollections:', error);
      return {
        content: [
          {
            type: 'text',
            text: 'Error listing collections. Please check server logs for details.',
          },
        ],
        isError: true,
      };
    }
  }

  private async handleAddDocuments(args: AddDocumentsArgs) {
    try {
      // Configure text processor if custom settings provided
      if (args.chunkSize) {
        this.textProcessor.setChunkSize(args.chunkSize);
      }
      if (args.chunkOverlap) {
        this.textProcessor.setChunkOverlap(args.chunkOverlap);
      }

      // Read and process the file
      let content: string;
      let sanitizedFilePath: string;
      try {
        sanitizedFilePath = this.sanitizeFilePath(args.filePath);
        content = await fsPromises.readFile(sanitizedFilePath, 'utf-8');
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(ErrorCode.InvalidParams, `Error reading file: ${error instanceof Error ? error.message : String(error)}`);
      }
      const chunks = await this.textProcessor.processFile(content, sanitizedFilePath);

      const embeddingServiceType = appConfig.embeddingProvider || args.embeddingService;
      if (!embeddingServiceType) {
        throw new McpError(ErrorCode.InvalidParams, 'Embedding service not specified in config or arguments.');
      }
      const allowedEmbeddingServices: EmbeddingService[] = ['openai', 'openrouter', 'fastembed', 'ollama'];
      if (!allowedEmbeddingServices.includes(embeddingServiceType as EmbeddingService)) {
        throw new McpError(ErrorCode.InvalidParams, `Unsupported embedding service: ${embeddingServiceType}. Allowed services are: ${allowedEmbeddingServices.join(', ')}`);
      }
      const embeddingService = createEmbeddingService({
        type: embeddingServiceType as EmbeddingService,
        apiKey: (appConfig as any)[`${embeddingServiceType}ApiKey`],
        endpoint: (appConfig as any)[`${embeddingServiceType}Endpoint`],
        model: appConfig.embeddingModel,
      });

      // Generate embeddings
      const embeddings = await embeddingService.generateEmbeddings(
        chunks.map(chunk => chunk.text)
      );

      // Create collection if it doesn't exist
      const collections = await this.qdrantService.listCollections();
      if (!collections.includes(args.collection)) {
        await this.qdrantService.createCollection(args.collection, embeddingService.vectorSize);
      }

      // Add documents to collection
      await this.qdrantService.addDocuments(
        args.collection,
        chunks.map((chunk, i) => ({
          id: uuidv4(),
          vector: embeddings[i],
          payload: {
            text: chunk.text,
            ...chunk.metadata,
          },
        }))
      );

      return {
        content: [
          {
            type: 'text',
            text: `Successfully processed and added ${chunks.length} chunks to collection ${args.collection}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error in handleAddDocuments:', error);
      return {
        content: [
          {
            type: 'text',
            text: 'Error adding documents. Please check server logs for details.',
          },
        ],
        isError: true,
      };
    }
  }

  private async handleSearch(args: SearchArgs) {
    try {

      const embeddingServiceType = appConfig.embeddingProvider || args.embeddingService;
      if (!embeddingServiceType) {
        throw new McpError(ErrorCode.InvalidParams, 'Embedding service not specified in config or arguments.');
      }
      const allowedEmbeddingServices: EmbeddingService[] = ['openai', 'openrouter', 'fastembed', 'ollama'];
      if (!allowedEmbeddingServices.includes(embeddingServiceType as EmbeddingService)) {
        throw new McpError(ErrorCode.InvalidParams, `Unsupported embedding service: ${embeddingServiceType}. Allowed services are: ${allowedEmbeddingServices.join(', ')}`);
      }
      const embeddingService = createEmbeddingService({
        type: embeddingServiceType as EmbeddingService,
        apiKey: (appConfig as any)[`${embeddingServiceType}ApiKey`],
        endpoint: (appConfig as any)[`${embeddingServiceType}Endpoint`],
        model: appConfig.embeddingModel,
      });

      // Generate query embedding
      const [queryEmbedding] = await embeddingService.generateEmbeddings([args.query]);

      // Search collection
      const results = await this.qdrantService.search(
        args.collection,
        queryEmbedding,
        args.limit
      );

      // Format the results to only include the payload text
      let responseText = '';
      
      results.forEach((result, index) => {
        // For documents collection, the text is in result.payload.text
        // For other collections, it might be in different fields
        const text = result.payload.text || result.payload.content || JSON.stringify(result.payload);
        const source = result.payload.source || result.payload.metadata?.source || '';
        const score = result.score.toFixed(2);
        
        responseText += `Result ${index + 1} (Score: ${score}):\n${text}\n`;
        if (source) {
          responseText += `Source: ${source}\n`;
        }
        responseText += '\n';
      });
      
      if (responseText === '') {
        responseText = 'No results found.';
      }

      return {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      };
    } catch (error) {
      logger.error('Error in handleSearch:', error);
      return {
        content: [
          {
            type: 'text',
            text: 'Error searching. Please check server logs for details.',
          },
        ],
        isError: true,
      };
    }
  }

  private async handleDeleteCollection(args: DeleteCollectionArgs) {
    try {
      // Delete the collection
      await this.qdrantService.deleteCollection(args.collection);
      
      return {
        content: [
          {
            type: 'text',
            text: `Successfully deleted collection: ${args.collection}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error in handleDeleteCollection:', error);
      return {
        content: [
          {
            type: 'text',
            text: 'Error deleting collection. Please check server logs for details.',
          },
        ],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('Better Qdrant MCP server running on stdio');
  }
}

const server = new BetterQdrantServer();
server.run().catch((error) => {
  logger.error('Server error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
