"use client";

import { useRef, useState, useTransition } from "react";
import { addImageAction, removeImageAction } from "@/app/owner/actions";
import { Alert } from "@/components/ui/controls";
import { createClient } from "@/lib/supabase/client";
import { IMAGE_BUCKET, imageUrl } from "@/lib/supabase/env";
import type { VenueImage } from "@/lib/types";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES } from "@/lib/validation";

/** PB08 - Tải ảnh sân lên Supabase Storage (tối đa 5 ảnh, JPG/PNG, mỗi ảnh ≤ 2 MB). */
export function ImageManager({ venueId, images }: { venueId: number; images: VenueImage[] }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  function onFile(file: File | undefined) {
    if (fileInput.current) fileInput.current.value = "";
    if (!file) return;
    setError(null);
    if (!IMAGE_TYPES.includes(file.type)) return setError("Chỉ nhận ảnh JPG hoặc PNG.");
    if (file.size > MAX_IMAGE_BYTES) return setError("Ảnh vượt quá 2 MB.");
    if (images.length >= MAX_IMAGES) return setError(`Mỗi sân tối đa ${MAX_IMAGES} ảnh.`);

    startTransition(async () => {
      const ext = file.type === "image/png" ? "png" : "jpg";
      const path = `${venueId}/${crypto.randomUUID()}.${ext}`;
      const upload = await createClient().storage.from(IMAGE_BUCKET).upload(path, file, { contentType: file.type });
      if (upload.error) return setError("Không tải được ảnh lên. Vui lòng thử lại.");
      const saved = await addImageAction(venueId, path);
      if (saved.error) setError(saved.error);
    });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-base font-bold">Hình ảnh</h2>
      <p className="mb-3 text-xs text-slate-500">Tối đa {MAX_IMAGES} ảnh, mỗi ảnh ≤ 2 MB, định dạng JPG hoặc PNG.</p>
      <div className="flex flex-wrap gap-2">
        {images.map((img) => (
          <div key={img.id} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl(img.storage_path) ?? ""} alt="Ảnh sân" className="h-20 w-28 rounded-lg object-cover" />
            <button
              type="button"
              aria-label="Xóa ảnh"
              disabled={busy}
              onClick={() =>
                startTransition(async () => {
                  const res = await removeImageAction(venueId, img.id);
                  setError(res.error ?? null);
                })
              }
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-xs text-red-600 shadow"
            >
              ✕
            </button>
          </div>
        ))}
        {images.length < MAX_IMAGES ? (
          <label className="flex h-20 w-28 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-2xl text-slate-400 hover:border-brand-700 hover:text-brand-700">
            {busy ? <span className="text-xs">Đang tải...</span> : "+"}
            <input ref={fileInput} type="file" accept="image/jpeg,image/png" className="sr-only" disabled={busy} onChange={(ev) => onFile(ev.target.files?.[0])} />
          </label>
        ) : null}
      </div>
      {error ? (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      ) : null}
    </section>
  );
}
