"use client";

import { Check, ImagePlus, Shirt, Sparkles, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const positionOptions = [
  "GK",
  "LB",
  "CB",
  "RB",
  "LWB",
  "RWB",
  "CDM",
  "CM",
  "CAM",
  "LM",
  "RM",
  "LW",
  "RW",
  "CF",
  "ST"
];

export function OnboardingForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [primaryPosition, setPrimaryPosition] = useState("CM");
  const [secondaryPosition, setSecondaryPosition] = useState("");

  async function resizePhoto(file: File) {
    const bitmap = await createImageBitmap(file);
    const maxSize = 512;
    const ratio = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * ratio));
    const height = Math.max(1, Math.round(bitmap.height * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not process image.");
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.78);
  }

  async function choosePhoto(file: File | undefined) {
    setError("");
    if (!file) {
      setPhotoPreview("");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Please attach an image file.");
      return;
    }
    if (file.size > 6_000_000) {
      setError("Photo must be under 6 MB.");
      return;
    }

    try {
      setPhotoPreview(await resizePhoto(file));
    } catch {
      setError("Could not process that photo. Try another image.");
    }
  }

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    const payload = Object.fromEntries(formData);
    delete payload.profilePhoto;
    payload.profileImage = photoPreview;

    const response = await fetch("/api/profiles/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    setLoading(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Could not create profile.");
      return;
    }
    router.refresh();
  }

  return (
    <form action={submit} className="profile-create mx-auto">
      <section className="profile-preview">
        <div className="player-card-preview">
          <div className="mb-8 flex items-center justify-between gap-3">
            <span className="position-chip"><Sparkles size={14} /> Matchday profile</span>
            <span className="position-chip">FC</span>
          </div>
          <div className="avatar-ring">
            {photoPreview ? (
              <img src={photoPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <UserRound className="text-white/72" size={42} />
            )}
          </div>
          <div className="mt-5">
            <p className="text-sm font-black uppercase text-white/58">Player card</p>
            <h1 className="mt-1 break-words text-4xl font-black leading-tight text-white">
              {displayName || "Your Name"}
            </h1>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="position-chip"><Shirt size={14} /> {primaryPosition}</span>
              <span className="position-chip">{secondaryPosition || "Flexible"}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid content-center gap-5 p-5 sm:p-7">
        <div>
          <p className="eyebrow">Create profile</p>
          <h2 className="mt-1 text-3xl font-black leading-tight sm:text-4xl">Step onto the pitch</h2>
          <p className="mt-2 text-sm font-medium text-[var(--muted)]">Name, position, photo. No phone number, no clutter.</p>
        </div>

        <div className="grid gap-4">
          <label className="grid gap-2 text-sm font-black">
            Name
            <input
              className="field"
              name="displayName"
              placeholder="Aryan Manjunath"
              autoComplete="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-black">
              Main position
              <select
                className="field"
                name="preferredPosition"
                required
                value={primaryPosition}
                onChange={(event) => setPrimaryPosition(event.target.value)}
              >
                {positionOptions.map((position) => <option key={position}>{position}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-black">
              Secondary position
              <select
                className="field"
                name="secondaryPosition"
                value={secondaryPosition}
                onChange={(event) => setSecondaryPosition(event.target.value)}
              >
                <option value="">None</option>
                {positionOptions.map((position) => <option key={position}>{position}</option>)}
              </select>
            </label>
          </div>

          <label className="grid gap-2 text-sm font-black">
            Player photo
            <span className="grid gap-3 rounded-lg border border-dashed border-[rgba(7,21,35,0.18)] bg-[var(--panel-soft)] p-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <span>
                <span className="block font-black">Upload or attach image</span>
                <span className="mt-1 block text-sm font-medium text-[var(--muted)]">Clear face or football photo, under 1.5 MB.</span>
              </span>
              <span className="btn-secondary cursor-pointer">
                <ImagePlus size={18} />
                Choose photo
                <input
                  className="sr-only"
                  name="profilePhoto"
                  type="file"
                  accept="image/*"
                  onChange={(event) => choosePhoto(event.target.files?.[0])}
                />
              </span>
            </span>
          </label>
        </div>

        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
        <button className="btn-primary w-full sm:w-fit" disabled={loading} type="submit">
          <Check size={18} />
          {loading ? "Saving..." : "Save profile"}
        </button>
      </section>
    </form>
  );
}
