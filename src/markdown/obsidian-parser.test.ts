import { ObsidianParser } from './obsidian-parser';

describe('ObsidianParser', () => {
  describe('parse', () => {
    it('should parse frontmatter correctly', () => {
      const content = `---
title: Test Article
author: Test Author
description: Test description
---
# Test Content`;

      const parser = new ObsidianParser(content, 'test.md');
      const result = parser.parse();

      expect(result.metadata.title).toBe('Test Article');
      expect(result.metadata.author).toBe('Test Author');
      expect(result.metadata.description).toBe('Test description');
    });

    it('should handle missing frontmatter', () => {
      const content = '# Test Content\n\nSome text here.';
      const parser = new ObsidianParser(content, 'test-article.md');
      const result = parser.parse();

      expect(result.metadata.title).toBe('test-article');
      expect(result.content).toContain('Test Content');
    });
  });

  describe('processObsidianSyntax', () => {
    it('should convert ==highlight== to <mark>', () => {
      const content = 'This is ==highlighted== text.';
      const parser = new ObsidianParser(content, 'test.md');
      const result = parser.parse();

      expect(result.content).toContain('<mark>highlighted</mark>');
    });

    it('should convert ~~strikethrough~~ to <s>', () => {
      const content = 'This is ~~deleted~~ text.';
      const parser = new ObsidianParser(content, 'test.md');
      const result = parser.parse();

      expect(result.content).toContain('<s>deleted</s>');
    });

    it('should convert [[WikiLink]] to plain text', () => {
      const content = 'Link to [[Some Page]] here.';
      const parser = new ObsidianParser(content, 'test.md');
      const result = parser.parse();

      expect(result.content).toContain('Some Page');
      expect(result.content).not.toContain('[[');
    });

    it('should convert [[WikiLink|alias]] to alias', () => {
      const content = 'Link to [[Some Page|My Alias]] here.';
      const parser = new ObsidianParser(content, 'test.md');
      const result = parser.parse();

      expect(result.content).toContain('My Alias');
      expect(result.content).not.toContain('Some Page');
    });

    it('should remove %%comments%%', () => {
      const content = 'Visible text %%this is hidden%% more text.';
      const parser = new ObsidianParser(content, 'test.md');
      const result = parser.parse();

      expect(result.content).not.toContain('%%');
      expect(result.content).not.toContain('this is hidden');
      expect(result.content).toContain('Visible text');
      expect(result.content).toContain('more text');
    });
  });

  describe('extractMermaidBlocks', () => {
    it('should extract mermaid blocks and replace with placeholders', () => {
      const content = `# Title

\`\`\`mermaid
graph TD
    A --> B
\`\`\`

Some text.`;

      const parser = new ObsidianParser(content, 'test.md');
      const parsed = parser.parse();
      const result = parser.extractMermaidBlocks(parsed.content);

      expect(result.mermaidBlocks.size).toBe(1);
      expect(result.mermaidBlocks.get('MERMAID_0')).toBe('graph TD\n    A --> B');
      expect(result.content).toContain('<!-- MERMAID_0 -->');
      expect(result.content).not.toContain('```mermaid');
    });

    it('should handle multiple mermaid blocks', () => {
      const content = `
\`\`\`mermaid
graph LR
    A --> B
\`\`\`

Text between.

\`\`\`mermaid
sequenceDiagram
    A->>B: Hello
\`\`\`
`;

      const parser = new ObsidianParser(content, 'test.md');
      const parsed = parser.parse();
      const result = parser.extractMermaidBlocks(parsed.content);

      expect(result.mermaidBlocks.size).toBe(2);
      expect(result.mermaidBlocks.has('MERMAID_0')).toBe(true);
      expect(result.mermaidBlocks.has('MERMAID_1')).toBe(true);
    });
  });

  describe('extractLocalImages', () => {
    it('should extract standard markdown images', () => {
      const content = '![Alt text](images/photo.png) and ![Another](assets/icon.svg)';
      const parser = new ObsidianParser(content, 'test.md');
      const parsed = parser.parse();
      const result = parser.extractLocalImages(parsed.content);

      expect(result.images.size).toBe(2);
      expect(result.images.get('IMAGE_0')).toEqual({ alt: 'Alt text', path: 'images/photo.png' });
      expect(result.images.get('IMAGE_1')).toEqual({ alt: 'Another', path: 'assets/icon.svg' });
    });

    it('should ignore remote URLs', () => {
      const content = '![Remote](https://example.com/image.png)';
      const parser = new ObsidianParser(content, 'test.md');
      const parsed = parser.parse();
      const result = parser.extractLocalImages(parsed.content);

      expect(result.images.size).toBe(0);
    });

    it('should extract Obsidian embed format ![[filename]]', () => {
      const content = 'See <!-- EMBED:Pasted image 20260522230204.png --> for reference.';
      const parser = new ObsidianParser(content, 'test.md');
      const parsed = parser.parse();
      const result = parser.extractLocalImages(parsed.content);

      expect(result.images.size).toBe(1);
      expect(result.images.get('IMAGE_0')).toEqual({
        alt: 'Pasted image 20260522230204.png',
        path: 'Pasted image 20260522230204.png'
      });
      expect(result.content).toContain('<!-- IMAGE_0 -->');
    });
  });
});
