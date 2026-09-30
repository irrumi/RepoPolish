import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import GithubSlugger from 'github-slugger';
import type { Root, RootContent } from 'mdast';

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter);
export interface Link {
  url: string;
  line: number;
  start?: number;
  end?: number;
  source: string;
}
export interface Snippet {
  value: string;
  line: number;
  shell: boolean;
}
export interface Markdown {
  links: Link[];
  anchors: Set<string>;
  headings: { text: string; line: number }[];
  snippets: Snippet[];
  prose: { value: string; line: number }[];
  html: boolean;
}
function plain(node: RootContent): string {
  if ('value' in node) return node.type === 'html' ? '' : node.value;
  if (node.type === 'image') return node.alt ?? '';
  return 'children' in node
    ? node.children.map((c) => plain(c as RootContent)).join('')
    : '';
}
export function markdown(source: string): Markdown {
  const root = parser.parse(source) as Root;
  const result: Markdown = {
    links: [],
    anchors: new Set(),
    headings: [],
    snippets: [],
    prose: [],
    html: false,
  };
  const slugger = new GithubSlugger();
  const stack: RootContent[] = [...root.children].reverse();
  let visited = 0;
  while (stack.length) {
    if (++visited > 100000) throw new Error('Markdown node budget exceeded.');
    const node = stack.pop()!;
    const line = node.position?.start.line ?? 1;
    if (
      node.type === 'link' ||
      node.type === 'image' ||
      node.type === 'definition'
    )
      result.links.push({
        url: node.url,
        line,
        start: node.position?.start.offset,
        end: node.position?.end.offset,
        source: node.type,
      });
    if (node.type === 'heading') {
      const text = plain(node);
      result.headings.push({ text, line });
      result.anchors.add(slugger.slug(text));
    }
    if (node.type === 'code')
      result.snippets.push({
        value: node.value,
        line:
          line +
          (/^(?:`{3,}|~{3,})/.test(
            source.slice(node.position?.start.offset ?? 0),
          )
            ? 1
            : 0),
        shell: [
          'sh',
          'shell',
          'bash',
          'console',
          'zsh',
          'powershell',
          'ps1',
          '',
        ].includes(node.lang ?? ''),
      });
    if (node.type === 'inlineCode')
      result.snippets.push({ value: node.value, line, shell: true });
    if (node.type === 'paragraph')
      result.prose.push({ value: plain(node), line });
    if (node.type === 'html') result.html = true;
    if ('children' in node)
      stack.push(...([...node.children].reverse() as RootContent[]));
  }
  return result;
}
