"use client";

import { useRef, useState, useCallback } from "react";
import Papa from "papaparse";
import { api } from "../lib/api";
import {
  ChevronLeft,
  Paperclip,
  Image as ImageIcon,
  Smile,
  Edit,
  Calendar,
  X,
} from "lucide-react";
import RichTextEditor from "./RichTextEditor";
import type { Editor } from "@tiptap/react";
import imageCompression from 'browser-image-compression';

type Props = {
  open: boolean;
  onClose: () => void;
  onScheduled: () => void;
  userEmail: string;
};

export default function ComposeModal({
  open,
  onClose,
  onScheduled,
  userEmail,
}: Props) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fromEmail, setFromEmail] = useState("oliver.brown@domain.io");
  const [startTime, setStartTime] = useState("");
  const [delayBetweenMs, setDelayBetweenMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(0);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // TipTap editor instance
  const [editor, setEditor] = useState<Editor | null>(null);

  // hidden image input
  const [insertImageFn, setInsertImageFn] = useState<
    ((file: File) => Promise<void>) | null
  >(null);

  const imageInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const handleFile = (file: File) => {
    Papa.parse(file, {
      complete: (results) => {
        const emails = (results.data as any[])
          .flat()
          .map((x) => String(x || "").trim())
          .filter((x) => x.includes("@"));

        const unique = Array.from(new Set(emails));
        setRecipients(unique);
      },
    });
  };

  // Image compression function
  const compressImage = async (file: File): Promise<File> => {
    try {
      // Only compress images, skip for other files
      if (!file.type.startsWith('image/')) {
        return file;
      }

      // Check if file is already small enough (less than 500KB)
      if (file.size < 500 * 1024) {
        return file;
      }

      const options = {
        maxSizeMB: 0.5, // Compress to max 0.5MB (500KB)
        maxWidthOrHeight: 1024, // Resize to max 1024px width or height
        useWebWorker: true,
        fileType: file.type,
        initialQuality: 0.8, // 80% quality
      };
      
      const compressedFile = await imageCompression(file, options);
      
      // Convert back to File object with original name
      return new File([compressedFile], file.name, {
        type: file.type,
        lastModified: Date.now(),
      });
    } catch (error) {
      console.error('Error compressing image:', error);
      return file; // Return original if compression fails
    }
  };

  // Use useCallback to memoize these functions
  const handleEditorReady = useCallback((editorInstance: Editor) => {
    setEditor(editorInstance);
  }, []);

  const handleImageInsertReady = useCallback((fn: (file: File) => Promise<void>) => {
    setInsertImageFn(() => fn);
  }, []);
   
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
  
    if (!insertImageFn) {
      alert("Editor is not ready yet. Please wait a moment and try again.");
      e.target.value = "";
      return;
    }
  
    // Process each file
    for (const file of Array.from(files)) {
      try {
        // Compress image before inserting
        const compressedFile = await compressImage(file);
        await insertImageFn(compressedFile);
      } catch (error) {
        console.error("Failed to insert image:", error);
        alert(`Failed to insert image: ${file.name}. Please try again.`);
      }
    }
    
    // Reset file input
    e.target.value = "";
  };

  const schedule = async () => {
    if (!subject || !body || recipients.length === 0 || !startTime) {
      alert(
        "Please fill in all required fields:\n- Subject\n- Body\n- Recipients (upload CSV)\n- Start Time"
      );
      return;
    }

    if (delayBetweenMs < 0) {
      alert("Delay between emails must be a positive number");
      return;
    }

    if (hourlyLimit < 0) {
      alert("Hourly limit must be a positive number");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        userEmail,
        fromEmail,
        subject,
        body, // HTML from TipTap
        startTime: new Date(startTime).toISOString(),
        delayBetweenMs: Number(delayBetweenMs),
        hourlyLimit: Number(hourlyLimit),
        recipients,
      };

      await api.post("/emails/schedule", payload);

      alert("Scheduled successfully ✅");

      // Reset form
      setSubject("");
      setBody("");
      setStartTime("");
      setRecipients([]);

      onClose();
      setTimeout(() => {
        onScheduled();
      }, 500);
    } catch (err: any) {
      console.log(err);
      alert(err?.response?.data?.message || "Failed to schedule");
    } finally {
      setLoading(false);
    }
  };

  const removeRecipient = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-gray-900"
              type="button"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-lg font-medium text-gray-900">
              Compose New Email
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-gray-100 rounded" type="button">
              <Edit size={18} className="text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded" type="button">
              <Calendar size={18} className="text-gray-600" />
            </button>
            <button
              onClick={schedule}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium disabled:opacity-60"
              type="button"
            >
              {loading ? "Sending..." : "Send"}
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden bg-white">
          {/* Main Compose Area */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200 bg-white">
            <div className="p-6 space-y-4 border-b border-gray-100 flex-shrink-0 bg-white">
              {/* From */}
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 w-20 flex-shrink-0">
                  From
                </span>
                <input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  className="flex-1 text-sm text-gray-900 border-none focus:outline-none bg-transparent"
                />
              </div>

              {/* To */}
              <div className="flex items-start gap-4">
                <span className="text-sm text-gray-600 w-20 flex-shrink-0 pt-1">
                  To
                </span>
                <div className="flex-1 min-w-0">
                  {recipients.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {recipients.slice(0, 3).map((email, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 bg-green-50 border border-green-200 text-green-700 rounded-full text-sm flex items-center gap-2"
                        >
                          {email}
                          <button
                            onClick={() => removeRecipient(i)}
                            className="hover:text-green-900"
                            type="button"
                          >
                            <X size={14} />
                          </button>
                        </span>
                      ))}
                      {recipients.length > 3 && (
                        <span className="px-3 py-1 bg-green-50 border border-green-200 text-green-700 rounded-full text-sm">
                          +{recipients.length - 3}
                        </span>
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="recipient@example.com"
                      className="w-full text-sm text-gray-400 border-none focus:outline-none bg-transparent"
                    />
                  )}
                </div>

                <label className="text-sm text-green-600 hover:text-green-700 cursor-pointer flex items-center gap-1 flex-shrink-0">
                  <span>↑</span> Upload List
                  <input
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                    }}
                  />
                </label>
              </div>

              {/* Subject */}
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 w-20 flex-shrink-0">
                  Subject
                </span>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject"
                  className="flex-1 text-sm text-gray-900 placeholder-gray-400 border-none focus:outline-none bg-transparent"
                />
              </div>

              {/* Delay Settings */}
              <div className="flex items-center gap-6 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <label className="text-gray-700">
                    Delay between 2 emails
                  </label>
                  <input
                    type="number"
                    value={delayBetweenMs}
                    onChange={(e) => setDelayBetweenMs(Number(e.target.value))}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-gray-700">Hourly Limit</label>
                  <input
                    type="number"
                    value={hourlyLimit}
                    onChange={(e) => setHourlyLimit(Number(e.target.value))}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            </div>

            {/* Text Editor */}
            <div className="flex-1 p-6 overflow-auto bg-gray-50">
              {/* Toolbar (CONNECTED) - FIXED: Removed duplicate div */}
              <div className="mb-3 flex items-center gap-1 pb-3 border-b border-gray-200 flex-shrink-0">
                {/* Undo */}
                <button
                  onClick={() => editor?.chain().focus().undo().run()}
                  className="p-1.5 hover:bg-gray-200 rounded text-gray-700 disabled:opacity-50"
                  disabled={!editor?.can().undo()}
                  title="Undo"
                  type="button"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M3 8h10M3 8l3-3M3 8l3 3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                {/* Redo */}
                <button
                  onClick={() => editor?.chain().focus().redo().run()}
                  className="p-1.5 hover:bg-gray-200 rounded text-gray-700 disabled:opacity-50"
                  disabled={!editor?.can().redo()}
                  title="Redo"
                  type="button"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M13 8H3M13 8l-3-3M13 8l-3 3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                <div className="w-px h-4 bg-gray-300 mx-1" />

                {/* Bold */}
                <button
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  className={`px-2 py-1.5 hover:bg-gray-200 rounded font-bold text-sm text-gray-700 ${
                    editor?.isActive("bold") ? "bg-gray-300" : ""
                  }`}
                  title="Bold"
                  type="button"
                >
                  B
                </button>

                {/* Italic */}
                <button
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  className={`px-2 py-1.5 hover:bg-gray-200 rounded italic text-sm text-gray-700 ${
                    editor?.isActive("italic") ? "bg-gray-300" : ""
                  }`}
                  title="Italic"
                  type="button"
                >
                  I
                </button>

                {/* Underline */}
                <button
                  onClick={() => editor?.chain().focus().toggleUnderline().run()}
                  className={`px-2 py-1.5 hover:bg-gray-200 rounded underline text-sm text-gray-700 ${
                    editor?.isActive("underline") ? "bg-gray-300" : ""
                  }`}
                  title="Underline"
                  type="button"
                >
                  U
                </button>

                <div className="w-px h-4 bg-gray-300 mx-1" />

                {/* Bullet List - Improved */}
                <button
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                  className={`p-1.5 hover:bg-gray-200 rounded text-gray-700 ${
                    editor?.isActive("bulletList") ? "bg-gray-300" : ""
                  }`}
                  title="Bullet List"
                  type="button"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="3" cy="4" r="1.5" fill="currentColor" />
                    <circle cx="3" cy="8" r="1.5" fill="currentColor" />
                    <circle cx="3" cy="12" r="1.5" fill="currentColor" />
                    <path d="M6 4h8M6 8h8M6 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>

                {/* Ordered List - Improved */}
                <button
                  onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                  className={`p-1.5 hover:bg-gray-200 rounded text-gray-700 ${
                    editor?.isActive("orderedList") ? "bg-gray-300" : ""
                  }`}
                  title="Numbered List"
                  type="button"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2.5 3.5h1V2h-1v1.5zM2.5 7.5h1V6h-1v1.5zM2.5 11.5h1V10h-1v1.5z" fill="currentColor" />
                    <path d="M6 4h8M6 8h8M6 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>

                <div className="w-px h-4 bg-gray-300 mx-1" />

                {/* Link */}
                <button
                  onClick={() => {
                    if (!editor) return;
                    const url = prompt("Enter link URL:");
                    if (!url) return;

                    editor
                      .chain()
                      .focus()
                      .extendMarkRange("link")
                      .setLink({ href: url })
                      .run();
                  }}
                  className={`p-1.5 hover:bg-gray-200 rounded text-gray-700 ${
                    editor?.isActive("link") ? "bg-gray-300" : ""
                  }`}
                  title="Insert Link"
                  type="button"
                >
                  <Paperclip size={16} />
                </button>

                {/* Image Upload */}
                <button
                  type="button"
                  onClick={() => {
                    // Check if editor is ready FIRST
                    if (!insertImageFn) {
                      alert("Editor not ready yet. Please wait a moment.");
                      return;
                    }
                    // Only then open file picker
                    imageInputRef.current?.click();
                  }}
                  className="p-1.5 hover:bg-gray-200 rounded text-gray-700"
                  title="Insert Image"
                >
                  <ImageIcon size={16} />
                </button>

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  multiple
                />

                {/* Emoji placeholder */}
                <button
                  className="p-1.5 hover:bg-gray-200 rounded text-gray-700"
                  title="Emoji"
                  type="button"
                  onClick={() => alert("Emoji picker next 😄")}
                >
                  <Smile size={16} />
                </button>
              </div>

              {/* Editor */}
              <RichTextEditor
                value={body}
                onChange={setBody}
                onReady={handleEditorReady}
                onImageInsertReady={handleImageInsertReady}
              />
            </div>
          </div>

          {/* Send Later Sidebar */}
          <div className="w-72 p-6 bg-white flex-shrink-0 overflow-y-auto">
            <h3 className="font-medium text-gray-900 mb-4">Send Later</h3>

            <div className="mb-4">
              <label className="text-sm text-gray-700 mb-2 block">
                Pick date & time
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div className="space-y-2 mb-6">
              {[
                { label: "Tomorrow", hours: 24 },
                { label: "Tomorrow, 10:00 AM", hours: 34 },
                { label: "Tomorrow, 11:00 AM", hours: 35 },
                { label: "Tomorrow, 3:00 PM", hours: 39 },
              ].map((option) => (
                <button
                  key={option.label}
                  onClick={() => {
                    const date = new Date();
                    date.setHours(date.getHours() + option.hours);
                    setStartTime(date.toISOString().slice(0, 16));
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={schedule}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-60"
                type="button"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}