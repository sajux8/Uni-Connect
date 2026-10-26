"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { inputClass } from "@/components/forms/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * The post/reply editor (Tiptap). Emits HTML; the server sanitises it before storing
 * (lib/rich-text.ts), so the toolbar here and the allow-list there must match.
 */
export function RichTextEditor({
  id,
  initialHtml = "",
  onChange,
  placeholder,
  minHeight = "min-h-40",
  invalid,
  describedBy,
  autoFocus,
  onEditorReady,
}: {
  id: string;
  initialHtml?: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  invalid?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
  onEditorReady?: (editor: Editor) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    autofocus: autoFocus ? "end" : false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "Write something…" }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(invalid ? { "aria-invalid": "true" } : {}),
        class: cn("rich-text px-3.5 py-3 outline-none", minHeight),
      },
    },
    onCreate: ({ editor }) => onEditorReady?.(editor),
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
  });

  return (
    <div
      className={cn(
        inputClass,
        "h-auto overflow-hidden p-0 focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/30",
        invalid && "border-destructive",
      )}
    >
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
      {!editor && (
        <div className={cn("px-3.5 py-3 text-muted-foreground", minHeight)}>Loading editor…</div>
      )}
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      heading: e.isActive("heading", { level: 2 }),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      blockquote: e.isActive("blockquote"),
      codeBlock: e.isActive("codeBlock"),
      link: e.isActive("link"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-wrap items-center gap-0.5 border-b bg-surface-tint px-1.5 py-1"
    >
      <ToolButton
        icon={Bold}
        label="Bold"
        active={state.bold}
        onClick={() => chain().toggleBold().run()}
      />
      <ToolButton
        icon={Italic}
        label="Italic"
        active={state.italic}
        onClick={() => chain().toggleItalic().run()}
      />
      <ToolButton
        icon={Strikethrough}
        label="Strikethrough"
        active={state.strike}
        onClick={() => chain().toggleStrike().run()}
      />
      <ToolButton
        icon={Code}
        label="Inline code"
        active={state.code}
        onClick={() => chain().toggleCode().run()}
      />
      <Divider />
      <ToolButton
        icon={Heading2}
        label="Heading"
        active={state.heading}
        onClick={() => chain().toggleHeading({ level: 2 }).run()}
      />
      <ToolButton
        icon={List}
        label="Bulleted list"
        active={state.bulletList}
        onClick={() => chain().toggleBulletList().run()}
      />
      <ToolButton
        icon={ListOrdered}
        label="Numbered list"
        active={state.orderedList}
        onClick={() => chain().toggleOrderedList().run()}
      />
      <ToolButton
        icon={Quote}
        label="Quote"
        active={state.blockquote}
        onClick={() => chain().toggleBlockquote().run()}
      />
      <ToolButton
        icon={SquareCode}
        label="Code block"
        active={state.codeBlock}
        onClick={() => chain().toggleCodeBlock().run()}
      />
      <LinkButton editor={editor} active={state.link} />
      <span className="ml-auto flex">
        <ToolButton
          icon={Undo2}
          label="Undo"
          disabled={!state.canUndo}
          onClick={() => chain().undo().run()}
        />
        <ToolButton
          icon={Redo2}
          label="Redo"
          disabled={!state.canRedo}
          onClick={() => chain().redo().run()}
        />
      </span>
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-border" />;
}

function ToolButton({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-35 sm:size-8",
        active && "bg-accent text-primary dark:text-accent-foreground",
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

function LinkButton({ editor, active }: { editor: Editor; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  function apply() {
    const href = url.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (!href) chain.unsetLink().run();
    else chain.setLink({ href: /^(https?:|mailto:)/i.test(href) ? href : `https://${href}` }).run();
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setUrl((editor.getAttributes("link").href as string | undefined) ?? "");
        setOpen(next);
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Link"
            title="Link"
            aria-pressed={active}
            onMouseDown={(event) => event.preventDefault()}
            className={cn(
              "grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring sm:size-8",
              active && "bg-accent text-primary dark:text-accent-foreground",
            )}
          />
        }
      >
        <Link2 className="size-4" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2">
        <label htmlFor="link-url" className="block text-xs font-bold">
          Link address
        </label>
        <input
          id="link-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              apply();
            }
          }}
          placeholder="https://"
          className={cn(inputClass, "h-9")}
        />
        <div className="flex justify-end gap-2">
          {active && (
            <button
              type="button"
              onClick={() => {
                setUrl("");
                editor.chain().focus().extendMarkRange("link").unsetLink().run();
                setOpen(false);
              }}
              className="h-8 rounded-full px-3 text-xs font-bold text-destructive hover:bg-destructive/10"
            >
              Remove
            </button>
          )}
          <button
            type="button"
            onClick={apply}
            className="h-8 rounded-full bg-primary px-3.5 text-xs font-bold text-primary-foreground"
          >
            Apply
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
