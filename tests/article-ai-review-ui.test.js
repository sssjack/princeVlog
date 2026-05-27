import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const mainSource = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

describe('article AI review UI', () => {
  it('renders AI review between article markdown and public comments', () => {
    expect(mainSource).toContain('function AiReviewBlock');
    expect(mainSource).toContain('<AiReviewBlock review={article.aiReview} />');
    expect(mainSource.indexOf('<Markdown content={article.content} />')).toBeLessThan(
      mainSource.indexOf('<AiReviewBlock review={article.aiReview} />')
    );
    expect(mainSource.indexOf('<AiReviewBlock review={article.aiReview} />')).toBeLessThan(
      mainSource.indexOf('<section className="comment-section">')
    );
    expect(mainSource).toContain('AI 点评');
    expect(styles).toContain('.ai-review-block');
  });
});
