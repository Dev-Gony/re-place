import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { JSDOM } from "jsdom";

import { FavoriteList } from "../../app/my/favorite-list";
import { FAVORITE_STATE_EVENT } from "../../lib/favorite-events";
import type { FavoriteItem } from "../../lib/workspace-contract";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://fixture.local/my#favorites",
});

Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  self: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  Event: { configurable: true, value: dom.window.Event },
  Element: { configurable: true, value: dom.window.Element },
  HTMLElement: { configurable: true, value: dom.window.HTMLElement },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true, writable: true },
});

function favorite(id: number, title: string): FavoriteItem {
  return {
    id,
    campaign_id: id,
    campaign_snapshot: {
      title,
      platform: "fixture",
      link: `https://example.com/campaign/${id}`,
      reward: `${id.toLocaleString()}원`,
      deadline_at: "2026-10-31T00:00:00.000Z",
    },
    created_at: "2026-10-08T00:00:00.000Z",
  };
}

afterEach(() => cleanup());

describe("FavoriteList", () => {
  test("renders a discoverable list with original, add, and remove actions", () => {
    const result = render(
      <FavoriteList
        initialItems={[favorite(101, "강남 카페 체험")]}
        recordCampaignIds={[]}
        onAddToRecords={() => undefined}
        removeRequest={async () => ({})}
      />,
    );

    assert.equal(result.getByRole("heading", { name: "찜목록" }).textContent, "찜목록");
    assert.ok(result.getByText("강남 카페 체험"));
    assert.equal(result.getByRole("link", { name: "원문" }).getAttribute("target"), "_blank");
    assert.ok(result.getByRole("button", { name: "내 체험단 추가" }));
    assert.ok(result.getByRole("button", { name: "찜 해제" }));
  });

  test("shows an empty state and a route back to discovery", () => {
    const result = render(
      <FavoriteList
        initialItems={[]}
        recordCampaignIds={[]}
        onAddToRecords={() => undefined}
        removeRequest={async () => ({})}
      />,
    );

    assert.ok(result.getByText("아직 찜한 캠페인이 없습니다."));
    assert.equal(
      result.getByRole("link", { name: "캠페인 탐색으로 돌아가기" }).getAttribute("href"),
      "/",
    );
  });

  test("removes a row after one successful request and updates the count", async () => {
    let requests = 0;
    let announcedCampaignId: number | null = null;
    let resolveRequest!: () => void;
    const pending = new Promise<void>((resolve) => {
      resolveRequest = resolve;
    });
    const result = render(
      <FavoriteList
        initialItems={[favorite(202, "성수 식당 체험")]}
        recordCampaignIds={[]}
        onAddToRecords={() => undefined}
        removeRequest={async () => {
          requests += 1;
          await pending;
        }}
      />,
    );
    window.addEventListener(
      FAVORITE_STATE_EVENT,
      ((event: CustomEvent<{ campaignId: number }>) => {
        announcedCampaignId = event.detail.campaignId;
      }) as EventListener,
      { once: true },
    );

    const remove = result.getByRole("button", { name: "찜 해제" });
    fireEvent.click(remove);
    fireEvent.click(remove);
    assert.equal(requests, 1);
    assert.ok(result.getByRole("button", { name: "해제 중" }).hasAttribute("disabled"));

    await act(async () => {
      resolveRequest();
      await pending;
    });
    await waitFor(() => assert.equal(result.queryByText("성수 식당 체험"), null));
    assert.ok(result.getByText("아직 찜한 캠페인이 없습니다."));
    assert.equal(result.getByLabelText("찜 0개").textContent?.trim(), "0개");
    assert.equal(announcedCampaignId, 202);
  });

  test("keeps the row and explains a failed removal", async () => {
    const result = render(
      <FavoriteList
        initialItems={[favorite(303, "부산 숙소 체험")]}
        recordCampaignIds={[]}
        onAddToRecords={() => undefined}
        removeRequest={async () => {
          throw new Error("fixture failure");
        }}
      />,
    );

    fireEvent.click(result.getByRole("button", { name: "찜 해제" }));

    await waitFor(() => {
      assert.ok(result.getByRole("alert"));
      assert.ok(result.getByText("부산 숙소 체험"));
      assert.equal(result.getByRole("button", { name: "찜 해제" }).hasAttribute("disabled"), false);
    });
  });
});
