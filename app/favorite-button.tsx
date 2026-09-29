"use client";

import { useState } from "react";

import { useFavorites } from "./favorites-provider";

export function FavoriteButton({
  campaignId,
  title,
}: {
  campaignId: number;
  title: string;
}) {
  const { ready, ids, toggle } = useFavorites();
  const [pending, setPending] = useState(false);
  const active = ids.has(campaignId);

  async function handleClick() {
    if (pending) return;
    setPending(true);
    try {
      await toggle(campaignId);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      className={`favorite-button ${active ? "active" : ""}`}
      onClick={handleClick}
      disabled={!ready || pending}
      aria-pressed={active}
      aria-label={active ? `${title} 찜 해제` : `${title} 찜하기`}
      title={active ? "찜 해제" : "찜하기"}
    >
      <span aria-hidden="true">{active ? "♥" : "♡"}</span>
    </button>
  );
}
