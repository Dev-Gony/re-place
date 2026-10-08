import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { act, cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { JSDOM } from "jsdom";

import { MyWorkspace } from "../../app/my/my-workspace";
import type {
  FavoriteItem,
  RecordItem,
  SettlementItem,
} from "../../lib/workspace-contract";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://fixture.local/my",
});
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  self: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  Event: { configurable: true, value: dom.window.Event },
  Element: { configurable: true, value: dom.window.Element },
  HTMLElement: { configurable: true, value: dom.window.HTMLElement },
  FormData: { configurable: true, value: dom.window.FormData },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true, writable: true },
});

const originalFetch = globalThis.fetch;

type JsonResponse = {
  schemaVersion: 1;
  mutatedAt: string;
  data: {
    item: RecordItem;
    settlement: SettlementItem;
  };
};

function favorite(id: number, title: string): FavoriteItem {
  return {
    id,
    campaign_id: id,
    campaign_snapshot: {
      title,
      platform: "fixture",
      reward: `${id.toLocaleString()}원`,
      deadline_at: "2026-10-31T00:00:00.000Z",
    },
    created_at: "2026-10-08T00:00:00.000Z",
  };
}

function creationResponse(id: number, title: string): JsonResponse {
  const item: RecordItem = {
    id: id + 10_000,
    campaign_id: id,
    source_type: "linked",
    status: "saved",
    title,
    platform: "fixture",
    link: null,
    reward: `${id.toLocaleString()}원`,
    region: "서울",
    deadline_at: "2026-10-31T00:00:00.000Z",
    note: null,
  };
  const settlement: SettlementItem = {
    record_id: item.id,
    record_title: item.title,
    record_platform: item.platform,
    record_status: item.status,
    expected_cash_amount: null,
    expected_provided_value_amount: null,
    expected_points_amount: null,
    expected_reimbursement_amount: null,
    actual_cash_received_amount: null,
    actual_reimbursement_received_amount: null,
    cash_received_at: null,
    reimbursement_received_at: null,
    note: null,
    source_cash_amount: id,
    source_provided_value_amount: null,
    source_points_amount: null,
    source_reimbursement_amount: null,
  };

  return {
    schemaVersion: 1,
    mutatedAt: "2026-10-08T00:00:00.000Z",
    data: { item, settlement },
  };
}

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function renderWorkspace(favorites: FavoriteItem[]) {
  const result = render(
    <MyWorkspace
      initialFavorites={favorites}
      initialRecords={[]}
      initialTasks={[]}
      initialSettlements={[]}
      todayKey="2026-10-08"
    />,
  );
  const details = result.container.querySelector("details");
  if (!details) throw new Error("Expected workspace detail drawer");
  details.open = true;
  fireEvent(details, new Event("toggle"));
  return result;
}

function favoriteRow(container: HTMLElement, title: string) {
  const row = [...container.querySelectorAll<HTMLElement>(".my-favorite-row")].find(
    (candidate) => candidate.textContent?.includes(title),
  );
  if (!row) throw new Error(`Missing favorite row for ${title}`);
  return row;
}

beforeEach(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: () => undefined,
  });
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

describe("MyWorkspace record creation", () => {
  test("updates record and settlement rows from one POST without a follow-up read", async () => {
    const title = "후속 조회 없는 캠페인";
    const calls: Array<{ path: RequestInfo | URL; init?: RequestInit }> = [];
    globalThis.fetch = async (path, init) => {
      calls.push({ path, init });
      return response(creationResponse(101, title), 201);
    };
    const { container } = renderWorkspace([favorite(101, title)]);

    fireEvent.click(
      within(favoriteRow(container, title)).getByRole("button", {
        name: "내 체험단 추가",
      }),
    );

    await waitFor(() => {
      assert.ok(
        within(container.querySelector("#records") as HTMLElement).getByText(title),
      );
      assert.ok(
        within(container.querySelector("#settlements") as HTMLElement).getByText(
          title,
        ),
      );
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, "/api/v1/me/records");
    assert.equal(calls[0].init?.method, "POST");
  });

  test("blocks duplicate clicks for the same favorite before the response arrives", async () => {
    const title = "중복 클릭 캠페인";
    const pending = deferred<Response>();
    let callCount = 0;
    globalThis.fetch = () => {
      callCount += 1;
      return pending.promise;
    };
    const { container } = renderWorkspace([favorite(202, title)]);
    const button = within(favoriteRow(container, title)).getByRole("button", {
      name: "내 체험단 추가",
    });

    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
    });

    assert.equal(callCount, 1);
    pending.resolve(response(creationResponse(202, title), 201));
    await waitFor(() => assert.equal(button.textContent, "추가됨"));
  });

  test("preserves both records and settlements when distinct responses finish in reverse", async () => {
    const firstTitle = "먼저 요청한 캠페인";
    const secondTitle = "나중 요청한 캠페인";
    const pending = new Map<number, ReturnType<typeof deferred<Response>>>();
    let callCount = 0;
    globalThis.fetch = (_path, init) => {
      callCount += 1;
      const campaignId = Number(JSON.parse(String(init?.body)).campaignId);
      const request = deferred<Response>();
      pending.set(campaignId, request);
      return request.promise;
    };
    const { container } = renderWorkspace([
      favorite(301, firstTitle),
      favorite(302, secondTitle),
    ]);

    fireEvent.click(
      within(favoriteRow(container, firstTitle)).getByRole("button", {
        name: "내 체험단 추가",
      }),
    );
    fireEvent.click(
      within(favoriteRow(container, secondTitle)).getByRole("button", {
        name: "내 체험단 추가",
      }),
    );
    assert.equal(callCount, 2);

    pending.get(302)?.resolve(response(creationResponse(302, secondTitle), 201));
    await waitFor(() =>
      assert.ok(
        within(container.querySelector("#settlements") as HTMLElement).getByText(
          secondTitle,
        ),
      ),
    );
    pending.get(301)?.resolve(response(creationResponse(301, firstTitle), 201));

    await waitFor(() => {
      const records = within(container.querySelector("#records") as HTMLElement);
      const settlements = within(
        container.querySelector("#settlements") as HTMLElement,
      );
      assert.ok(records.getByText(firstTitle));
      assert.ok(records.getByText(secondTitle));
      assert.ok(settlements.getByText(firstTitle));
      assert.ok(settlements.getByText(secondTitle));
    });
  });

  test("keeps the manual form and its values after a failed request", async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount += 1;
      return response(
        { error: { code: "FIXTURE_FAILURE", message: "fixture failure" } },
        500,
      );
    };
    const { container } = renderWorkspace([]);

    fireEvent.click(
      within(container.querySelector("#records") as HTMLElement).getByRole(
        "button",
        { name: "직접 등록" },
      ),
    );
    const title = within(
      container.querySelector("#records") as HTMLElement,
    ).getByPlaceholderText("캠페인명 *") as HTMLInputElement;
    fireEvent.change(title, { target: { value: "실패해도 남는 입력" } });
    fireEvent.click(
      within(container.querySelector("#records") as HTMLElement).getByRole(
        "button",
        { name: "등록" },
      ),
    );

    await waitFor(() => {
      assert.equal(title.value, "실패해도 남는 입력");
      assert.notEqual(container.querySelector(".manual-record-form"), null);
      assert.match(container.textContent ?? "", /캠페인을 등록하지 못했습니다/);
    });
    assert.equal(callCount, 1);
  });
});
