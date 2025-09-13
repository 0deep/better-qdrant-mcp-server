import { TextProcessor } from '../services/text-processing.js';
import appConfig from '../config.js';

describe('TextProcessor', () => {
  let textProcessor: TextProcessor;

  beforeEach(() => {
    textProcessor = new TextProcessor(10, 0); // Small chunk size for testing
  });

  it('should chunk a simple text correctly', async () => {
    const text = 'This is a short sentence to test chunking.';
    const chunks = await textProcessor.processText(text);

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].text).toBeDefined();
    expect(chunks[0].metadata.index).toBe(0);
    expect(chunks[0].metadata.source).toBeUndefined();
  });

  it('should handle an empty string', async () => {
    const text = '';
    const chunks = await textProcessor.processText(text);
    expect(chunks.length).toBe(0);
  });

  it('should set chunk size and overlap correctly', async () => {
    textProcessor.setChunkSize(20);
    textProcessor.setChunkOverlap(5);
    const text = 'This is a longer sentence to test chunking with custom sizes.';
    const chunks = await textProcessor.processText(text);

    expect(chunks.length).toBeGreaterThan(0);
    // Further assertions could check chunk content and overlap if needed
  });
});