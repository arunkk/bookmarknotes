/**
 * Deterministic group assignment from signals an importer already has:
 * GitHub topics, language, and words in the description.
 *
 * Why this exists alongside the LLM pass (SPEC.md 4): most repos carry topics
 * that map to a shelf unambiguously, and spending an LLM call on
 * `topics: ["postgres","database"]` is waste. This handles the obvious cases
 * for free and deterministically; `enrich.mjs` sends only what is left.
 *
 * Rules are intentionally boring and inspectable. When a signal is ambiguous
 * it contributes nothing rather than guessing, because a wrong group is worse
 * than an empty one: ungrouped records surface in the Ungrouped facet and get
 * fixed, wrong ones hide.
 */

// topic or keyword -> groups it implies. A signal may imply several.
const RULES = [
  [['llm', 'llms', 'large-language-models', 'machine-learning', 'deep-learning', 'ai', 'artificial-intelligence',
    'neural-network', 'neural-networks', 'transformers', 'transformer', 'nlp', 'computer-vision', 'pytorch',
    'tensorflow', 'diffusion', 'generative-ai', 'genai', 'embeddings', 'fine-tuning', 'rag', 'llmops',
    'reinforcement-learning', 'speech-recognition', 'text-to-speech', 'stable-diffusion', 'gpt', 'chatgpt',
    'openai', 'anthropic', 'claude', 'gemini', 'llama', 'mistral', 'ollama', 'inference', 'quantization'],
    ['AI/ML']],

  [['agent', 'agents', 'ai-agents', 'agentic', 'agentic-ai', 'agentic-workflow', 'multi-agent',
    'multi-agent-systems', 'autonomous-agents', 'mcp', 'model-context-protocol', 'claude-code',
    'agent-skills', 'coding-agents', 'codex', 'copilot', 'ai-coding', 'llm-agent', 'tool-use',
    'function-calling', 'prompt-engineering', 'prompt', 'agent-framework'],
    ['Agents & Tooling']],

  [['database', 'databases', 'postgres', 'postgresql', 'mysql', 'sqlite', 'duckdb', 'clickhouse',
    'mongodb', 'redis', 'sql', 'vector-database', 'vector-search', 'vectordb', 'etl', 'data-engineering',
    'dataframe', 'pandas', 'spark', 'analytics', 'data-pipeline', 'olap', 'search-engine', 'elasticsearch'],
    ['Data & Databases']],

  [['kubernetes', 'k8s', 'docker', 'containers', 'terraform', 'devops', 'ci-cd', 'aws', 'gcp', 'azure',
    'cloud', 'serverless', 'infrastructure-as-code', 'helm', 'ansible', 'observability', 'monitoring',
    'prometheus', 'grafana', 'sre', 'deployment', 'github-actions'],
    ['DevOps & Cloud']],

  [['security', 'infosec', 'cybersecurity', 'pentesting', 'cryptography', 'encryption', 'authentication',
    'oauth', 'vulnerability', 'appsec', 'malware', 'reverse-engineering', 'privacy', 'zero-trust',
    'secrets-management'],
    ['Security']],

  [['react', 'vue', 'svelte', 'nextjs', 'frontend', 'css', 'tailwind', 'tailwindcss', 'web-components',
    'webgl', 'browser', 'html', 'ui', 'ux', 'design-system', 'component-library', 'web', 'webassembly',
    'wasm', 'spa', 'website'],
    ['Web & Frontend']],

  [['operating-system', 'kernel', 'linux', 'systems-programming', 'compiler', 'compilers', 'interpreter',
    'virtual-machine', 'distributed-systems', 'networking', 'performance', 'concurrency', 'embedded',
    'low-level', 'memory-management', 'runtime'],
    ['Systems & Infrastructure']],

  [['programming-language', 'language-design', 'type-system', 'functional-programming', 'metaprogramming',
    'parser', 'lexer', 'static-analysis', 'formal-verification'],
    ['Programming Languages']],

  [['cli', 'command-line', 'terminal', 'developer-tools', 'devtools', 'productivity', 'editor', 'neovim',
    'vim', 'emacs', 'vscode', 'tui', 'automation', 'shell', 'dotfiles', 'tmux', 'git', 'utility',
    'formatter', 'linter'],
    ['Tools & Utilities']],

  [['awesome', 'awesome-list', 'awesome-lists', 'tutorial', 'tutorials', 'course', 'learning', 'education',
    'book', 'books', 'roadmap', 'interview', 'interview-questions', 'cheatsheet', 'guide', 'documentation',
    'learn', 'study'],
    ['Career & Learning']],

  [['research', 'paper', 'papers', 'science', 'scientific-computing', 'physics', 'biology', 'chemistry',
    'mathematics', 'statistics', 'bioinformatics', 'simulation', 'numerical'],
    ['Science']],

  [['startup', 'saas', 'business', 'marketing', 'finance', 'trading', 'fintech', 'e-commerce',
    'product-management', 'growth', 'pricing', 'billing'],
    ['Business & Strategy']],

  [['design', 'figma', 'typography', 'icons', 'animation', 'illustration', 'prototyping', 'accessibility',
    'a11y'],
    ['Product & Design']],

  [['video', 'audio', 'podcast', 'youtube', 'streaming', 'music', 'ffmpeg', 'media', 'talk', 'conference'],
    ['Media & Talks']],
];

// Language alone is weak evidence: it says how something was built, not what it
// is for. It contributes only a Programming Languages shelf for the languages
// people actually browse by, and never on its own (see classify()).
const LANGUAGE_HINT = {
  Rust: 'Programming Languages',
  Zig: 'Programming Languages',
  Haskell: 'Programming Languages',
  OCaml: 'Programming Languages',
  Elixir: 'Programming Languages',
};

const INDEX = new Map();
for (const [signals, groups] of RULES) {
  for (const s of signals) {
    INDEX.set(s, [...(INDEX.get(s) || []), ...groups]);
  }
}

const norm = (s) => String(s || '').toLowerCase();

/**
 * Returns { groups, tags, confident }.
 * `confident` is false when nothing matched, which is the signal to hand the
 * record to the LLM pass rather than shipping it ungrouped.
 */
export function classify({ topics = [], language = '', description = '', title = '', maxGroups = 3 }) {
  const score = new Map();
  const bump = (g, n) => score.set(g, (score.get(g) || 0) + n);

  // Topics are the strongest signal: a human deliberately tagged the repo.
  for (const t of topics) {
    for (const g of INDEX.get(norm(t)) || []) bump(g, 3);
  }

  // Description and title words are weaker: they can be marketing copy, and a
  // word may appear incidentally.
  const words = new Set(
    `${norm(title)} ${norm(description)}`.split(/[^a-z0-9+#-]+/).filter(Boolean),
  );
  for (const w of words) {
    for (const g of INDEX.get(w) || []) bump(g, 1);
  }

  const confident = score.size > 0;

  const hint = LANGUAGE_HINT[language];
  if (hint && confident) bump(hint, 1); // never the sole reason for a group

  const groups = [...score.entries()]
    .filter(([, n]) => n >= 2) // a single weak word is not a shelf
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, maxGroups)
    .map(([g]) => g);

  return { groups, confident: confident && groups.length > 0 };
}

/** Topics worth keeping as tags: identifying, not organizational noise. */
const TAG_NOISE = new Set([
  'awesome', 'awesome-list', 'awesome-lists', 'hacktoberfest', 'open-source', 'opensource',
  'github', 'list', 'lists', 'collection', 'resources', 'free', 'community', 'library', 'framework',
]);

export function tagsFromTopics(topics = [], language = '', max = 8) {
  const out = [];
  for (const t of topics) {
    const s = norm(t);
    if (!s || TAG_NOISE.has(s)) continue;
    if (s === norm(language)) continue; // language is its own field
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}
