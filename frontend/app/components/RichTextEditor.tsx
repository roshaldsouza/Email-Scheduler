"use client";

import React, { useEffect, useState } from "react"; // Add useState
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";

type Props = {
  value: string;
  onChange: (html: string) => void;
  onReady?: (editor: Editor) => void;
  onImageInsertReady?: (fn: (file: File) => Promise<void>) => void;
};

export default function RichTextEditor({
  value,
  onChange,
  onReady,
  onImageInsertReady,
}: Props) {
  const [isUploading, setIsUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          HTMLAttributes: {
            class: "list-disc pl-4",
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: "list-decimal pl-4",
          },
        },
        listItem: {
          HTMLAttributes: {
            class: "leading-relaxed",
          },
        },
      }),
      Underline,
      Link.configure({ openOnClick: false }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
    ],
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "w-full min-h-[260px] p-3 text-sm text-gray-900 outline-none bg-transparent prose max-w-none",
      },
    },
  });

  // give editor instance to parent
  useEffect(() => {
    if (editor && onReady) onReady(editor);
  }, [editor, onReady]);

  // function to insert base64 image
  useEffect(() => {
    if (!editor) return;

    const insertImage = async (file: File) => {
      if (!file.type || !file.type.startsWith("image/")) {
        alert("Please select an image file");
        return;
      }

      setIsUploading(true);
      try {
        const toBase64 = (file: File) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

        const base64 = await toBase64(file);
        editor.chain().focus().setImage({ src: base64 }).run();
      } catch (error) {
        console.error("Failed to insert image:", error);
        alert(`Failed to upload image: ${file.name}`);
      } finally {
        setIsUploading(false);
      }
    };

    onImageInsertReady?.(insertImage);
  }, [editor, onImageInsertReady]);

  // sync external value -> editor
  useEffect(() => {
    if (!editor) return;
    const incoming = value || "";
    if (editor.getHTML() !== incoming) {
      editor.commands.setContent(incoming);
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {isUploading && (
        <div className="p-2 bg-blue-50 text-blue-600 text-sm text-center">
          Uploading image...
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}