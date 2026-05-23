import { WechatFormatter } from './wechat-formatter';

describe('WechatFormatter', () => {
  let formatter: WechatFormatter;

  beforeEach(() => {
    formatter = new WechatFormatter();
  });

  describe('format', () => {
    it('should format markdown to WeChat HTML', () => {
      const markdown = '# Title\n\nParagraph text.';
      const result = formatter.format(markdown, new Map());

      expect(result).toContain('Title');
      expect(result).toContain('Paragraph text');
      expect(result).toContain('<section');
    });

    it('should replace image placeholders', () => {
      const markdown = 'Text <!-- IMAGE_0 --> more text.';
      const imageMap = new Map([['IMAGE_0', 'https://example.com/image.png']]);
      const result = formatter.format(markdown, imageMap);

      expect(result).toContain('<img src="https://example.com/image.png"');
      expect(result).not.toContain('<!-- IMAGE_0 -->');
    });

    it('should handle image placeholders wrapped in <p> tags', () => {
      const markdown = 'Text\n\n<!-- IMAGE_0 -->\n\nMore text.';
      const imageMap = new Map([['IMAGE_0', 'https://example.com/img.png']]);
      const result = formatter.format(markdown, imageMap);

      expect(result).toContain('<img src="https://example.com/img.png"');
    });

    it('should handle multiple image placeholders', () => {
      const markdown = 'First <!-- IMAGE_0 --> second <!-- IMAGE_1 --> third.';
      const imageMap = new Map([
        ['IMAGE_0', 'https://example.com/a.png'],
        ['IMAGE_1', 'https://example.com/b.png'],
      ]);
      const result = formatter.format(markdown, imageMap);

      expect(result).toContain('https://example.com/a.png');
      expect(result).toContain('https://example.com/b.png');
      expect(result).not.toContain('<!-- IMAGE_0 -->');
      expect(result).not.toContain('<!-- IMAGE_1 -->');
    });

    it('should convert lists to sections', () => {
      const markdown = '- Item 1\n- Item 2\n- Item 3';
      const result = formatter.format(markdown, new Map());

      expect(result).toContain('<section');
      expect(result).not.toContain('<ul>');
      expect(result).not.toContain('<li>');
    });

    it('should convert ordered lists to numbered sections', () => {
      const markdown = '1. First\n2. Second\n3. Third';
      const result = formatter.format(markdown, new Map());

      expect(result).toContain('1.');
      expect(result).toContain('2.');
      expect(result).toContain('3.');
    });

    it('should style code blocks', () => {
      const markdown = '```javascript\nconst x = 1;\n```';
      const result = formatter.format(markdown, new Map());

      expect(result).toContain('<code');
      expect(result).toContain('hljs');
    });
  });

  describe('formatForCopy', () => {
    it('should preserve list elements for copy', () => {
      const markdown = '- Item 1\n- Item 2';
      const result = formatter.formatForCopy(markdown, new Map());

      expect(result).toContain('<ul>');
      expect(result).toContain('<li>');
    });

    it('should replace image placeholders', () => {
      const markdown = 'Text <!-- IMAGE_0 -->';
      const imageMap = new Map([['IMAGE_0', 'https://example.com/img.png']]);
      const result = formatter.formatForCopy(markdown, imageMap);

      expect(result).toContain('<img src="https://example.com/img.png"');
    });
  });

  describe('generateDigest', () => {
    it('should generate digest from HTML content', () => {
      const html = '<p>This is a long paragraph that should be truncated to a short digest for the article summary.</p>';
      const result = formatter.generateDigest(html);

      expect(result.length).toBeLessThanOrEqual(57); // 54 chars + "..."
      expect(result).toContain('...');
    });

    it('should return full text if shorter than max length', () => {
      const html = '<p>Short text.</p>';
      const result = formatter.generateDigest(html);

      expect(result).toBe('Short text.');
      expect(result.length).toBeLessThanOrEqual(54);
    });

    it('should strip HTML tags', () => {
      const html = '<p><strong>Bold</strong> <em>italic</em> text.</p>';
      const result = formatter.generateDigest(html);

      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });
  });
});