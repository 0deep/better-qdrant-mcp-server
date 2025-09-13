import { QdrantClient } from '@qdrant/js-client-rest';
import { QdrantService, SearchResult } from '../types.js';
import logger from '../logger.js';

export class DefaultQdrantService implements QdrantService {
  private url: string;
  private apiKey?: string;

  constructor(public client: QdrantClient, url: string, apiKey?: string) {
    this.url = url;
    this.apiKey = apiKey;
  }

  async listCollections(): Promise<string[]> {
    try {
      logger.debug('Attempting to connect to Qdrant server using direct fetch...');
      
      // Use direct fetch instead of the client
      const collectionsUrl = `${this.url}/collections`;
      logger.debug(`Fetching from: ${collectionsUrl}`);
      
      const response = await fetch(collectionsUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { 'api-key': this.apiKey } : {})
        },
        // @ts-ignore - node-fetch supports timeout
        timeout: 5000 // 5 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json() as { 
        result: { 
          collections: Array<{ name: string }> 
        } 
      };
      logger.info('Successfully retrieved collections:', data);
      
      return data.result.collections.map(c => c.name);
    } catch (error) {
      logger.error('Error in listCollections:', error);
      if (error instanceof Error) {
        logger.error(`${error.name}: ${error.message}`);
        logger.error('Stack:', error.stack);
      }
      throw error;
    }
  }

  async createCollection(name: string, vectorSize: number): Promise<void> {
    try {
      logger.debug('Attempting to create Qdrant collection using direct fetch...');
      
      // Use direct fetch instead of the client
      const createUrl = `${this.url}/collections/${name}`;
      logger.debug(`Fetching from: ${createUrl}`);
      
      const response = await fetch(createUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { 'api-key': this.apiKey } : {})
        },
        // @ts-ignore - node-fetch supports timeout
        timeout: 5000, // 5 second timeout
        body: JSON.stringify({
          vectors: {
            size: vectorSize,
            distance: 'Cosine',
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      logger.info('Successfully created collection:', data);
    } catch (error) {
      logger.error('Error in createCollection:', error);
      if (error instanceof Error) {
        logger.error(`${error.name}: ${error.message}`);
        logger.error('Stack:', error.stack);
      }
      throw error;
    }
  }

  async addDocuments(
    collection: string,
    documents: { id: string; vector: number[]; payload: Record<string, any> }[]
  ): Promise<void> {
    try {
      logger.debug('Attempting to add documents to Qdrant collection using direct fetch...');
      
      // Use direct fetch instead of the client
      const upsertUrl = `${this.url}/collections/${collection}/points`;
      logger.debug(`Fetching from: ${upsertUrl}`);
      
      const points = documents.map(doc => ({
        id: doc.id,
        vector: doc.vector,
        payload: doc.payload,
      }));
      
      const response = await fetch(upsertUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { 'api-key': this.apiKey } : {})
        },
        // @ts-ignore - node-fetch supports timeout
        timeout: 10000, // 10 second timeout for potentially larger uploads
        body: JSON.stringify({
          points
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      logger.info('Successfully added documents:', data);
    } catch (error) {
      logger.error('Error in addDocuments:', error);
      if (error instanceof Error) {
        logger.error(`${error.name}: ${error.message}`);
        logger.error('Stack:', error.stack);
      }
      throw error;
    }
  }

  async deleteCollection(name: string): Promise<void> {
    try {
      logger.debug('Attempting to delete Qdrant collection using direct fetch...');
      
      // Use direct fetch instead of the client
      const deleteUrl = `${this.url}/collections/${name}`;
      logger.debug(`Fetching from: ${deleteUrl}`);
      
      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { 'api-key': this.apiKey } : {})
        },
        // @ts-ignore - node-fetch supports timeout
        timeout: 5000 // 5 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      logger.info('Successfully deleted collection:', data);
    } catch (error) {
      logger.error('Error in deleteCollection:', error);
      if (error instanceof Error) {
        logger.error(`${error.name}: ${error.message}`);
        logger.error('Stack:', error.stack);
      }
      throw error;
    }
  }

  async search(
    collection: string,
    vector: number[],
    limit: number = 10
  ): Promise<SearchResult[]> {
    try {
      logger.debug('Attempting to search Qdrant collection using direct fetch...');
      
      // Use direct fetch instead of the client
      const searchUrl = `${this.url}/collections/${collection}/points/search`;
      logger.debug(`Fetching from: ${searchUrl}`);
      
      const response = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { 'api-key': this.apiKey } : {})
        },
        // @ts-ignore - node-fetch supports timeout
        timeout: 5000, // 5 second timeout
        body: JSON.stringify({
          vector,
          limit,
          with_payload: true,
          with_vector: true
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json() as { 
        result: Array<{
          id: string;
          score: number;
          payload: Record<string, any>;
          vector?: number[];
        }> 
      };
      
      logger.info('Successfully retrieved search results:', data);
      
      return data.result.map(result => {
        const searchResult: SearchResult = {
          id: result.id,
          score: result.score,
          payload: result.payload,
        };
        
        // Only include vector if it's a number array
        if (Array.isArray(result.vector) && result.vector.every(v => typeof v === 'number')) {
          searchResult.vector = result.vector;
        }
        
        return searchResult;
      });
    } catch (error) {
      logger.error('Error in search:', error);
      if (error instanceof Error) {
        logger.error(`${error.name}: ${error.message}`);
        logger.error('Stack:', error.stack);
      }
      throw error;
    }
  }
}

export function createQdrantService(url: string, apiKey?: string): QdrantService {
  // Parse the URL to handle port correctly
  const urlObj = new URL(url);
  logger.debug(`createQdrantService - URL: ${url}, Hostname: ${urlObj.hostname}, Protocol: ${urlObj.protocol}`);

  // Security Check: Handle API key usage based on connection type
  const isLocalhost = urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1' || urlObj.hostname === 'host.container.internal'; // Added host.docker.internal for common Docker setups
  logger.debug(`createQdrantService - isLocalhost: ${isLocalhost}`);

  if (apiKey) {
    if (urlObj.protocol !== 'https:') {
      if (!isLocalhost) {
        // CRITICAL: API key over HTTP for non-local connection
        logger.error('CRITICAL SECURITY ALERT: QDRANT_API_KEY is provided but QDRANT_URL is not HTTPS for a non-local connection. This exposes your API key to eavesdropping. Please use an HTTPS URL (e.g., "https://your-qdrant-host") or remove the API key if using an unsecure connection.');
        throw new Error('Insecure Qdrant API key usage detected for non-local connection. Server will not start.');
      } else {
        // WARNING: API key over HTTP for local connection (not strictly necessary, but good to flag)
        logger.warn('WARNING: QDRANT_API_KEY is provided for a local HTTP Qdrant connection. Qdrant typically does not require an API key for local connections. Consider removing the API key or using HTTPS for consistency.');
      }
    }
  }
  
  // Create client with explicit host and port if provided
  const clientConfig: any = {
    host: urlObj.hostname,
    apiKey,
    checkCompatibility: false,
    https: urlObj.protocol === 'https:',
  };
  
  // Only set port if it's explicitly in the URL
  if (urlObj.port) {
    clientConfig.port = parseInt(urlObj.port, 10);
  }
  
  // Add path if present
  if (urlObj.pathname !== '/' && urlObj.pathname !== '') {
    clientConfig.prefix = urlObj.pathname;
  }
  
  logger.info('Creating Qdrant client with config:', clientConfig);
  const client = new QdrantClient(clientConfig);

  return new DefaultQdrantService(client, url, apiKey);


}
