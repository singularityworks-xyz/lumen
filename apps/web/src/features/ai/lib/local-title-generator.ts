const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "can",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "at",
  "by",
  "from",
  "as",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "under",
  "again",
  "further",
  "then",
  "once",
  "here",
  "there",
  "when",
  "where",
  "why",
  "how",
  "all",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "just",
  "and",
  "but",
  "if",
  "or",
  "because",
  "until",
  "while",
  "about",
  "against",
  "i",
  "me",
  "my",
  "myself",
  "we",
  "our",
  "ours",
  "ourselves",
  "you",
  "your",
  "yours",
  "yourself",
  "yourselves",
  "he",
  "him",
  "his",
  "himself",
  "she",
  "her",
  "hers",
  "herself",
  "it",
  "its",
  "itself",
  "they",
  "them",
  "their",
  "theirs",
  "themselves",
  "what",
  "which",
  "who",
  "whom",
  "this",
  "that",
  "these",
  "those",
  "am",
  "please",
  "help",
  "want",
  "need",
  "like",
  "hey",
  "hi",
  "hello",
]);

const ACTION_PATTERNS: Array<{ pattern: RegExp; prefix: string }> = [
  { pattern: /^create\s+/i, prefix: "Creating" },
  { pattern: /^add\s+/i, prefix: "Adding" },
  { pattern: /^make\s+/i, prefix: "Making" },
  { pattern: /^build\s+/i, prefix: "Building" },
  { pattern: /^delete\s+/i, prefix: "Deleting" },
  { pattern: /^remove\s+/i, prefix: "Removing" },
  { pattern: /^update\s+/i, prefix: "Updating" },
  { pattern: /^edit\s+/i, prefix: "Editing" },
  { pattern: /^change\s+/i, prefix: "Changing" },
  { pattern: /^move\s+/i, prefix: "Moving" },
  { pattern: /^organize\s+/i, prefix: "Organizing" },
  { pattern: /^sort\s+/i, prefix: "Sorting" },
  { pattern: /^find\s+/i, prefix: "Finding" },
  { pattern: /^search\s+/i, prefix: "Searching" },
  { pattern: /^show\s+/i, prefix: "Showing" },
  { pattern: /^list\s+/i, prefix: "Listing" },
  { pattern: /^get\s+/i, prefix: "Getting" },
];

// Pre-compiled regex patterns for performance
const PUNCTUATION_REGEX = /[^\w\s]/g;
const WHITESPACE_REGEX = /\s+/;

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word, index) => {
      // Don't capitalize stop words unless it's the first word
      if (index > 0 && STOP_WORDS.has(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function extractKeywords(text: string): string[] {
  // Remove punctuation and split into words
  const words = text
    .toLowerCase()
    .replace(PUNCTUATION_REGEX, " ")
    .split(WHITESPACE_REGEX)
    .filter((word) => word.length > 1);

  // Filter out stop words and keep meaningful words
  return words.filter((word) => !STOP_WORDS.has(word));
}

export function generateLocalTitle(firstUserMessage: string): string {
  const message = firstUserMessage.trim();

  if (!message) {
    return "New Conversation";
  }

  // Check for action patterns
  for (const { pattern, prefix } of ACTION_PATTERNS) {
    if (pattern.test(message)) {
      const rest = message.replace(pattern, "").trim();
      const keywords = extractKeywords(rest);
      if (keywords.length > 0) {
        const subject = keywords.slice(0, 3).join(" ");
        return toTitleCase(`${prefix} ${subject}`);
      }
    }
  }

  // Extract keywords from the message
  const keywords = extractKeywords(message);

  if (keywords.length === 0) {
    // Fallback: use first few words of original message
    const words = message.split(WHITESPACE_REGEX).slice(0, 4);
    return toTitleCase(words.join(" "));
  }

  // Take first 3-5 meaningful keywords
  const titleWords = keywords.slice(0, 5);
  const title = toTitleCase(titleWords.join(" "));

  // Truncate if too long
  if (title.length > 40) {
    return `${title.slice(0, 37)}...`;
  }

  return title;
}

export function shouldGenerateLocalTitle(
  messageCount: number,
  currentTitle: string | null
): boolean {
  if (currentTitle === "") {
    return false;
  }
  return !currentTitle && messageCount >= 2;
}
