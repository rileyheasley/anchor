// Pure string logic shared by the renderer (optimistic UI while typing) and the main
// process (source of truth on save) — kept in one place so the two can't drift apart.

// Derives a plain-text title from the first non-empty markdown line
export function deriveTitleFromContent(content: string): string {
  const firstLine = content.split('\n').find((line) => line.trim().length > 0) ?? ''
  let text = firstLine.trim()
  text = text.replace(/^#{1,6}\s+/, '')
  text = text.replace(/^[-*+]\s+/, '')
  text = text.replace(/^\d+\.\s+/, '')
  text = text.replace(/^>\s+/, '')
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2')
  text = text.replace(/(\*|_)(.*?)\1/g, '$2')
  text = text.replace(/`([^`]+)`/g, '$1')
  text = text.replace(/~~(.*?)~~/g, '$1')
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  return text.trim() || 'Untitled'
}
