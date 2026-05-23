// Mock juice module for testing
export default {
  inlineContent: (html: string, css: string) => {
    // Simple mock: just return the HTML as-is
    return html;
  },
};
