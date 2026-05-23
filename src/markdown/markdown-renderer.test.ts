import { MarkdownRenderer } from './markdown-renderer';

describe('MarkdownRenderer', () => {
  let renderer: MarkdownRenderer;

  beforeEach(() => {
    renderer = new MarkdownRenderer();
  });

  describe('render', () => {
    it('should render basic markdown to HTML', () => {
      const result = renderer.render('# Hello World');
      expect(result).toContain('<h1>Hello World</h1>');
      expect(result).toContain('<section id="wemd">');
    });

    it('should render paragraphs', () => {
      const result = renderer.render('First paragraph.\n\nSecond paragraph.');
      expect(result).toContain('<p>');
      expect(result).toContain('</p>');
    });

    it('should render links', () => {
      const result = renderer.render('[Example](https://example.com)');
      expect(result).toContain('<a href="https://example.com"');
      expect(result).toContain('Example</a>');
    });

    it('should render code blocks with syntax highlighting', () => {
      const result = renderer.render('```javascript\nconst x = 1;\n```');
      expect(result).toContain('<pre>');
      expect(result).toContain('<code');
      expect(result).toContain('language-javascript');
    });

    it('should render mermaid code blocks specially', () => {
      const result = renderer.render('```mermaid\ngraph TD\n    A --> B\n```');
      expect(result).toContain('class="mermaid"');
    });

    it('should render lists', () => {
      const result = renderer.render('- Item 1\n- Item 2\n- Item 3');
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>');
      expect(result).toContain('Item 1');
    });

    it('should render ordered lists', () => {
      const result = renderer.render('1. First\n2. Second\n3. Third');
      expect(result).toContain('<ol>');
      expect(result).toContain('<li>');
    });

    it('should render blockquotes', () => {
      const result = renderer.render('> This is a quote');
      expect(result).toContain('<blockquote>');
    });

    it('should render tables', () => {
      const markdown = `| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |`;
      const result = renderer.render(markdown);
      expect(result).toContain('<table>');
      expect(result).toContain('<th>');
      expect(result).toContain('<td>');
    });

    it('should render inline code', () => {
      const result = renderer.render('Use `console.log` for debugging');
      expect(result).toContain('<code>');
      expect(result).toContain('console.log');
    });

    it('should render bold and italic text', () => {
      const result = renderer.render('**bold** and *italic*');
      expect(result).toContain('<strong>bold</strong>');
      expect(result).toContain('<em>italic</em>');
    });
  });

  describe('processObsidianSyntax', () => {
    it('should convert ==highlight== to <mark>', () => {
      const result = renderer.render('This is ==highlighted== text');
      expect(result).toContain('<mark>highlighted</mark>');
    });

    it('should convert ~~strikethrough~~ to <del>', () => {
      const result = renderer.render('This is ~~deleted~~ text');
      expect(result).toContain('<del>deleted</del>');
    });

    it('should convert [[WikiLink]] to plain text', () => {
      const result = renderer.render('See [[Some Page]] for details');
      expect(result).toContain('Some Page');
      expect(result).not.toContain('[[');
    });

    it('should convert [[WikiLink|alias]] to alias', () => {
      const result = renderer.render('Check [[Target|display name]] here');
      expect(result).toContain('display name');
      expect(result).not.toContain('Target');
    });

    it('should remove %%comments%%', () => {
      const result = renderer.render('Visible %%hidden comment%% text');
      expect(result).not.toContain('%%');
      expect(result).not.toContain('hidden comment');
      expect(result).toContain('Visible');
      expect(result).toContain('text');
    });
  });

  describe('getWechatCss', () => {
    it('should return CSS styles for WeChat', () => {
      const css = renderer.getWechatCss();
      expect(css).toContain('#wemd');
      expect(css).toContain('font-size');
      expect(css).toContain('line-height');
    });
  });
});
