import { DiaryChapter, PaginatedPage } from '../types';

/**
 * Counts words in text or HTML string.
 * Handles English, Sinhala Unicode text, and strips HTML markup safely.
 */
export function countWords(textOrHtml: string): number {
  if (!textOrHtml) return 0;
  // Strip HTML tags and entities
  const clean = textOrHtml
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();

  if (!clean) return 0;

  // Split by whitespace (works for Latin, Sinhala, numbers, punctuation)
  const words = clean.split(/\s+/).filter(Boolean);
  return words.length;
}

/**
 * Splits continuous chapter HTML or plain text into discrete blocks.
 * If text contains block tags like <p>, <h3>, <blockquote>, <ul>, etc., splits by them.
 * Otherwise splits by newlines.
 */
function extractBlocks(rawHtml: string): string[] {
  const trimmed = (rawHtml || '').trim();
  if (!trimmed || trimmed === '<p></p>') {
    return [];
  }

  // If HTML contains standard block tags
  const blockRegex = /<(p|h1|h2|h3|h4|blockquote|ul|ol|div|figure|table)[^>]*>[\s\S]*?<\/\1>/gi;
  const matches = trimmed.match(blockRegex);

  if (matches && matches.length > 0) {
    return matches;
  }

  // Fallback: If no recognized block tags, split by double newlines or single newlines
  const lines = trimmed.split(/\n\s*\n/).filter(line => line.trim().length > 0);
  if (lines.length > 0) {
    return lines.map(line => `<p>${line.replace(/\n/g, '<br/>')}</p>`);
  }

  return [`<p>${trimmed}</p>`];
}

/**
 * Splits a single oversized block into smaller pieces if it exceeds wordsPerPage.
 */
function splitLargeBlock(blockHtml: string, maxWords: number): string[] {
  const words = countWords(blockHtml);
  if (words <= maxWords) {
    return [blockHtml];
  }

  // Extract raw text and tags
  const cleanText = blockHtml.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').trim();
  const wordTokens = cleanText.split(/\s+/).filter(Boolean);

  const chunks: string[] = [];
  let currentChunk: string[] = [];

  for (const token of wordTokens) {
    currentChunk.push(token);
    if (currentChunk.length >= maxWords) {
      chunks.push(`<p>${currentChunk.join(' ')}</p>`);
      currentChunk = [];
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(`<p>${currentChunk.join(' ')}</p>`);
  }

  return chunks.length > 0 ? chunks : [blockHtml];
}

/**
 * Splits a chapter's raw continuous content into an array of PaginatedPage objects.
 * Dynamic pagination is computed on the fly based on wordsPerPage.
 * 
 * @param chapter The DiaryChapter object
 * @param wordsPerPage Configurable word limit per page (default: 100)
 * @param startingGlobalPage Global book page index offset
 */
export function paginateChapter(
  chapter: DiaryChapter,
  wordsPerPage: number = 100,
  startingGlobalPage: number = 1
): PaginatedPage[] {
  const targetWords = wordsPerPage > 0 ? wordsPerPage : 100;
  const content = chapter.rawContent || '';
  const blocks = extractBlocks(content);

  // If chapter is empty, return one placeholder page
  if (blocks.length === 0) {
    return [
      {
        id: `${chapter.id}-p1`,
        chapterId: chapter.id,
        chapterTitle: chapter.chapterTitle || 'Untitled Chapter',
        pageIndex: 0,
        chapterPageNumber: 1,
        totalChapterPages: 1,
        globalPageNumber: startingGlobalPage,
        content: '<p class="opacity-60 italic font-serif-book">A quiet leaf waiting for thoughts…</p>',
        wordCount: 0,
        date: chapter.date || new Date().toISOString().split('T')[0],
        mood: chapter.mood,
        location: chapter.location,
        tags: chapter.tags || [],
        coverImage: chapter.coverImage,
        gallery: chapter.gallery || [],
        status: chapter.status || 'published',
        isSecret: chapter.isSecret,
        securityKey: chapter.securityKey,
        securityHint: chapter.securityHint
      }
    ];
  }

  // Split oversized blocks first
  const normalizedBlocks: string[] = [];
  for (const block of blocks) {
    if (countWords(block) > targetWords) {
      normalizedBlocks.push(...splitLargeBlock(block, targetWords));
    } else {
      normalizedBlocks.push(block);
    }
  }

  // Accumulate blocks into pages
  const pagesHtml: { html: string; wordCount: number }[] = [];
  let currentPageBlocks: string[] = [];
  let currentWords = 0;

  for (const block of normalizedBlocks) {
    const blockWords = countWords(block);

    // If adding this block exceeds targetWords and we already have blocks on this page:
    if (currentWords + blockWords > targetWords && currentPageBlocks.length > 0) {
      pagesHtml.push({
        html: currentPageBlocks.join('\n'),
        wordCount: currentWords
      });
      currentPageBlocks = [block];
      currentWords = blockWords;
    } else {
      currentPageBlocks.push(block);
      currentWords += blockWords;
    }
  }

  // Push remaining blocks
  if (currentPageBlocks.length > 0) {
    pagesHtml.push({
      html: currentPageBlocks.join('\n'),
      wordCount: currentWords
    });
  }

  const totalPages = Math.max(1, pagesHtml.length);

  return pagesHtml.map((page, idx) => ({
    id: `${chapter.id}-p${idx + 1}`,
    chapterId: chapter.id,
    chapterTitle: chapter.chapterTitle || 'Untitled Chapter',
    pageIndex: idx,
    chapterPageNumber: idx + 1,
    totalChapterPages: totalPages,
    globalPageNumber: startingGlobalPage + idx,
    content: page.html,
    wordCount: page.wordCount,
    date: chapter.date || new Date().toISOString().split('T')[0],
    mood: chapter.mood,
    location: chapter.location,
    tags: chapter.tags || [],
    coverImage: idx === 0 ? chapter.coverImage : undefined, // Hero cover image on first page of chapter
    gallery: idx === totalPages - 1 ? chapter.gallery : undefined, // Gallery attachments on last page
    status: chapter.status || 'published',
    isSecret: chapter.isSecret,
    securityKey: chapter.securityKey,
    securityHint: chapter.securityHint
  }));
}

/**
 * Paginates an entire collection of chapters into a continuous book sequence.
 */
export function paginateAllChapters(
  chapters: DiaryChapter[],
  wordsPerPage: number = 100
): {
  pages: PaginatedPage[];
  chapterMeta: {
    chapterId: string;
    chapterTitle: string;
    startPage: number;
    pageCount: number;
    totalWords: number;
  }[];
} {
  const targetWords = wordsPerPage > 0 ? wordsPerPage : 100;
  const allPages: PaginatedPage[] = [];
  const chapterMeta: {
    chapterId: string;
    chapterTitle: string;
    startPage: number;
    pageCount: number;
    totalWords: number;
  }[] = [];

  let currentGlobalPage = 1;

  for (const chapter of chapters) {
    const chapterPages = paginateChapter(chapter, targetWords, currentGlobalPage);
    const totalWords = countWords(chapter.rawContent);

    chapterMeta.push({
      chapterId: chapter.id,
      chapterTitle: chapter.chapterTitle || 'Untitled Chapter',
      startPage: currentGlobalPage,
      pageCount: chapterPages.length,
      totalWords
    });

    allPages.push(...chapterPages);
    currentGlobalPage += chapterPages.length;
  }

  return {
    pages: allPages,
    chapterMeta
  };
}
