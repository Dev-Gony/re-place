import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import { act, cleanup, render, waitFor } from "@testing-library/react";
import { JSDOM } from "jsdom";

import {
  CampaignVisibilityAdminAccessProvider,
  CampaignVisibilityAdminLink,
} from "../../app/campaign-visibility-admin-entry";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://fixture.local/",
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

type RequestAccess = (signal: AbortSignal) => Promise<boolean>;

function Harness({
  sessionKey,
  pathname = "/",
  requestAccess,
}: {
  sessionKey: string | null;
  pathname?: string;
  requestAccess: RequestAccess;
}) {
  return (
    <CampaignVisibilityAdminAccessProvider
      sessionKey={sessionKey}
      pathname={pathname}
      requestAccess={requestAccess}
    >
      <CampaignVisibilityAdminLink surface="header" />
      <CampaignVisibilityAdminLink surface="account" />
    </CampaignVisibilityAdminAccessProvider>
  );
}

function adminEntries(container: HTMLElement) {
  return container.querySelectorAll('a[href="/admin/campaigns"]');
}

afterEach(() => cleanup());

describe("campaign visibility admin navigation", () => {
  test("does not request or render an entry without a session", () => {
    let requests = 0;
    const result = render(
      <Harness
        sessionKey={null}
        requestAccess={async () => {
          requests += 1;
          return true;
        }}
      />,
    );

    assert.equal(requests, 0);
    assert.equal(adminEntries(result.container).length, 0);
  });

  test("renders desktop and account entries only after server approval", async () => {
    const result = render(
      <Harness
        sessionKey="approved-fixture-user"
        requestAccess={async () => true}
      />,
    );

    await waitFor(() => assert.equal(adminEntries(result.container).length, 2));
  });

  test("keeps the entry hidden when the server denies access", async () => {
    let requests = 0;
    const result = render(
      <Harness
        sessionKey="ordinary-fixture-user"
        requestAccess={async () => {
          requests += 1;
          return false;
        }}
      />,
    );

    await waitFor(() => assert.equal(requests, 1));
    assert.equal(adminEntries(result.container).length, 0);
  });

  test("handles login, logout, restored sessions, navigation, and pageshow", async () => {
    let requests = 0;
    const requestAccess = async () => {
      requests += 1;
      return true;
    };
    const result = render(
      <Harness sessionKey={null} pathname="/" requestAccess={requestAccess} />,
    );

    result.rerender(
      <Harness
        sessionKey="approved-fixture-user"
        pathname="/"
        requestAccess={requestAccess}
      />,
    );
    await waitFor(() => {
      assert.equal(requests, 1);
      assert.equal(adminEntries(result.container).length, 2);
    });

    result.rerender(
      <Harness sessionKey={null} pathname="/" requestAccess={requestAccess} />,
    );
    assert.equal(adminEntries(result.container).length, 0);

    result.rerender(
      <Harness
        sessionKey="approved-fixture-user"
        pathname="/calendar"
        requestAccess={requestAccess}
      />,
    );
    await waitFor(() => {
      assert.equal(requests, 2);
      assert.equal(adminEntries(result.container).length, 2);
    });

    await act(async () => {
      window.dispatchEvent(new Event("pageshow"));
    });
    await waitFor(() => assert.equal(requests, 3));
  });
});
