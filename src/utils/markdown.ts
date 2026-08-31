// Flattens markdown to plain text for short previews (card faces, list rows).
export function stripMarkdownPreview(content: string): string {
  return content
    .split('\n')
    .map((line) =>
      line
        .replace(/^#{1,6}\s+/, '')
        .replace(/^[-*+]\s+/, '')
        .replace(/^\d+\.\s+/, '')
        .replace(/^>\s+/, '')
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        .replace(/(\*|_)(.*?)\1/g, '$2')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/~~(.*?)~~/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim()
    )
    .filter(Boolean)
    .join(' ')
}
