import { DefaultQdrantService, createQdrantService } from '../services/qdrant.js';
import { QdrantClient } from '@qdrant/js-client-rest';
import appConfig from '../config.js';

// Mock QdrantClient
const mockQdrantClient = {
  getCollections: jest.fn(),
  createCollection: jest.fn(),
  deleteCollection: jest.fn(),
  upsert: jest.fn(),
  search: jest.fn(),
} as unknown as QdrantClient;

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('DefaultQdrantService', () => {
  const QDRANT_URL = appConfig.qdrantUrl;
  const QDRANT_HTTPS_URL = 'https://localhost:6333';
  const QDRANT_API_KEY = 'test-api-key';
  let qdrantService: DefaultQdrantService;

  beforeEach(() => {
    jest.clearAllMocks();
    qdrantService = new DefaultQdrantService(mockQdrantClient, QDRANT_URL, QDRANT_API_KEY);
  });

  describe('createQdrantService', () => {
    it('should create a QdrantService instance with correct config', () => {
      const service = createQdrantService(QDRANT_URL, QDRANT_API_KEY);
      expect(service).toBeInstanceOf(DefaultQdrantService);
      // Further checks on the client config can be added if needed
    });

    it('should handle URL without port correctly', () => {
      const service = createQdrantService(QDRANT_URL.replace(':6333', ''), QDRANT_API_KEY);
      expect(service).toBeInstanceOf(DefaultQdrantService);
    });

    it('should handle HTTPS URL correctly', () => {
      const service = createQdrantService(QDRANT_HTTPS_URL, QDRANT_API_KEY);
      expect(service).toBeInstanceOf(DefaultQdrantService);
    });

    it('should handle URL with path prefix correctly', () => {
      const service = createQdrantService(`${QDRANT_URL}/prefix`, QDRANT_API_KEY);
      expect(service).toBeInstanceOf(DefaultQdrantService);
    });

    it('should throw an error if API key is used with non-local HTTP URL', () => {
      const nonLocalHttpUrl = 'http://remote-qdrant:6333';
      expect(() => createQdrantService(nonLocalHttpUrl, QDRANT_API_KEY)).toThrow('Insecure Qdrant API key usage detected for non-local connection. Server will not start.');
    });

    it('should not throw an error if API key is used with local HTTP URL', () => {
      expect(() => createQdrantService(QDRANT_URL, QDRANT_API_KEY)).not.toThrow();
    });

    it('should not throw an error if no API key is used with HTTP URL', () => {
      expect(() => createQdrantService(QDRANT_URL, undefined)).not.toThrow();
    });
  });

  describe('listCollections', () => {
    it('should return a list of collection names', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: { collections: [{ name: 'col1' }, { name: 'col2' }] } }),
      });

      const collections = await qdrantService.listCollections();
      expect(collections).toEqual(['col1', 'col2']);
      expect(mockFetch).toHaveBeenCalledWith(
        `${QDRANT_URL}/collections`,
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'api-key': QDRANT_API_KEY,
          },
        })
      );
    });

    it('should throw an error if fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(qdrantService.listCollections()).rejects.toThrow('HTTP error! Status: 500');
    });
  });

  describe('createCollection', () => {
    const collectionName = 'new-collection';
    const vectorSize = 1536;

    it('should create a collection successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: true }),
      });

      await qdrantService.createCollection(collectionName, vectorSize);
      expect(mockFetch).toHaveBeenCalledWith(
        `${QDRANT_URL}/collections/${collectionName}`,
        expect.objectContaining({
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'api-key': QDRANT_API_KEY,
          },
          body: JSON.stringify({
            vectors: {
              size: vectorSize,
              distance: 'Cosine',
            },
          }),
        })
      );
    });

    it('should throw an error if creation fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      await expect(qdrantService.createCollection(collectionName, vectorSize)).rejects.toThrow('HTTP error! Status: 400');
    });
  });

  describe('addDocuments', () => {
    const collectionName = 'test-collection';
    const documents = [
      { id: '1', vector: [0.1, 0.2], payload: { text: 'doc1' } },
      { id: '2', vector: [0.3, 0.4], payload: { text: 'doc2' } },
    ];

    it('should add documents successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: { operation_id: 1 } }),
      });

      await qdrantService.addDocuments(collectionName, documents);
      expect(mockFetch).toHaveBeenCalledWith(
        `${QDRANT_URL}/collections/${collectionName}/points`,
        expect.objectContaining({
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'api-key': QDRANT_API_KEY,
          },
          body: JSON.stringify({
            points: documents.map(doc => ({
              id: doc.id,
              vector: doc.vector,
              payload: doc.payload,
            })),
          }),
        })
      );
    });

    it('should throw an error if adding documents fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(qdrantService.addDocuments(collectionName, documents)).rejects.toThrow('HTTP error! Status: 500');
    });
  });

  describe('deleteCollection', () => {
    const collectionName = 'collection-to-delete';

    it('should delete a collection successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: true }),
      });

      await qdrantService.deleteCollection(collectionName);
      expect(mockFetch).toHaveBeenCalledWith(
        `${QDRANT_URL}/collections/${collectionName}`,
        expect.objectContaining({
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'api-key': QDRANT_API_KEY,
          },
        })
      );
    });

    it('should throw an error if deletion fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(qdrantService.deleteCollection(collectionName)).rejects.toThrow('HTTP error! Status: 404');
    });
  });

  describe('search', () => {
    const collectionName = 'search-collection';
    const vector = [0.5, 0.6];
    const limit = 5;

    it('should return search results successfully', async () => {
      const mockResults = [
        { id: 'doc1', score: 0.9, payload: { text: 'result1' } },
        { id: 'doc2', score: 0.8, payload: { text: 'result2' } },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: mockResults }),
      });

      const results = await qdrantService.search(collectionName, vector, limit);
      expect(results).toEqual(mockResults.map(r => ({ ...r, vector: undefined }))); // vector is not included by default
      expect(mockFetch).toHaveBeenCalledWith(
        `${QDRANT_URL}/collections/${collectionName}/points/search`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': QDRANT_API_KEY,
          },
          body: JSON.stringify({
            vector,
            limit,
            with_payload: true,
            with_vector: true,
          }),
        })
      );
    });

    it('should throw an error if search fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(qdrantService.search(collectionName, vector, limit)).rejects.toThrow('HTTP error! Status: 401');
    });

    it('should include vector in results if present in Qdrant response', async () => {
      const mockResultsWithVector = [
        { id: 'doc1', score: 0.9, payload: { text: 'result1' }, vector: [0.1, 0.2] },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: mockResultsWithVector }),
      });

      const results = await qdrantService.search(collectionName, vector, limit);
      expect(results).toEqual(mockResultsWithVector);
    });
  });
});