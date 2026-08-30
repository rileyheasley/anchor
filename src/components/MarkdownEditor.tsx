import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Markdown } from 'tiptap-markdown'
import { clickSound } from '../sounds'

interface ContextMenuState {
  x: number
  y: number
}

interface MenuItem {
  label: string
  action: (editor: Editor) => void
  isActive?: (editor: Editor) => boolean
}

const MENU_ITEMS: (MenuItem | 'separator')[] = [
  { label: 'Heading 1', action: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(), isActive: (e) => e.isActive('heading', { level: 1 }) },
  { label: 'Heading 2', action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), isActive: (e) => e.isActive('heading', { level: 2 }) },
  { label: 'Heading 3', action: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(), isActive: (e) => e.isActive('heading', { level: 3 }) },
  { label: 'Paragraph', action: (e) => e.chain().focus().setParagraph().run(), isActive: (e) => e.isActive('paragraph') },
  'separator',
  { label: 'Bold', action: (e) => e.chain().focus().toggleBold().run(), isActive: (e) => e.isActive('bold') },
  { label: 'Italic', action: (e) => e.chain().focus().toggleItalic().run(), isActive: (e) => e.isActive('italic') },
  { label: 'Strikethrough', action: (e) => e.chain().focus().toggleStrike().run(), isActive: (e) => e.isActive('strike') },
  { label: 'Inline Code', action: (e) => e.chain().focus().toggleCode().run(), isActive: (e) => e.isActive('code') },
  'separator',
  { label: 'Bullet List', action: (e) => e.chain().focus().toggleBulletList().run(), isActive: (e) => e.isActive('bulletList') },
  { label: 'Numbered List', action: (e) => e.chain().focus().toggleOrderedList().run(), isActive: (e) => e.isActive('orderedList') },
  { label: 'Task List', action: (e) => e.chain().focus().toggleTaskList().run(), isActive: (e) => e.isActive('taskList') },
  'separator',
  { label: 'Quote', action: (e) => e.chain().focus().toggleBlockquote().run(), isActive: (e) => e.isActive('blockquote') },
  { label: 'Code Block', action: (e) => e.chain().focus().toggleCodeBlock().run(), isActive: (e) => e.isActive('codeBlock') },
  { label: 'Divider', action: (e) => e.chain().focus().setHorizontalRule().run() },
]

export default function MarkdownEditor({
  content,
  onChange,
  onBlur,
  placeholder = 'Start writing…',
}: {
  content: string
  onChange: (markdown: string) => void
  onBlur?: () => void
  placeholder?: string
}) {
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef(content)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Markdown.configure({ html: false, transformPastedText: true }),
    ],
    content,
    onUpdate: ({ editor }) => {
      const markdown = (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown()
      contentRef.current = markdown
      onChange(markdown)
    },
    onBlur: () => onBlur?.(),
  })

  // Keep editor content in sync when switching notes externally
  useEffect(() => {
    if (editor && content !== contentRef.current) {
      contentRef.current = content
      editor.commands.setContent(content)
    }
  }, [content, editor])

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [menu])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY })
  }

  if (!editor) return null

  return (
    <div className="flex-1 overflow-y-auto bg-surface relative" onContextMenu={handleContextMenu}>
      <EditorContent editor={editor} className="markdown-editor h-full p-6" />

      {menu && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-surface border border-border rounded-lg shadow-lg py-1 min-w-[170px] text-sm"
          style={{ top: menu.y, left: menu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {MENU_ITEMS.map((item, i) =>
            item === 'separator' ? (
              <div key={i} className="my-1 border-t border-border-subtle" />
            ) : (
              <button
                key={item.label}
                onClick={() => {
                  clickSound()
                  item.action(editor)
                  setMenu(null)
                }}
                className={`w-full text-left px-3 py-1.5 hover:bg-surface-sunken cursor-pointer transition-colors ${
                  item.isActive?.(editor) ? 'text-accent-hover font-medium' : 'text-ink-secondary'
                }`}
              >
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}
