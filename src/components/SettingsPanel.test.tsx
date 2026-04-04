import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "./SettingsPanel";
import type { EnvironmentSettings } from "../types";

function createEnvironmentSettings(): EnvironmentSettings {
  return {
    domains: [
      {
        id: "jp",
        name: "Japan",
        matchHost: "example.jp",
        values: [{ key: "TOKEN", value: "jp-token" }],
      },
      {
        id: "us",
        name: "US",
        matchHost: "example.com",
        values: [{ key: "TOKEN", value: "us-token" }],
      },
    ],
    activeDomainId: "jp",
  };
}

function renderSettingsPanel(initialSettings: EnvironmentSettings = createEnvironmentSettings()) {
  const onImportEnvironmentFile = vi.fn(async () => null);

  function Harness() {
    const [settings, setSettings] = useState(initialSettings);

    return (
      <SettingsPanel
        requirements={[
          {
            name: "TOKEN",
            displayName: "LOCAL_ENV.TOKEN",
            status: "available",
            occurrenceCount: 1,
            stories: [{ storyId: "story-1", storyTitle: "Login" }],
          },
        ]}
        environmentSettings={settings}
        environmentSettingsError={null}
        onSaveEnvironmentSettings={async (nextSettings) => {
          setSettings(nextSettings);
        }}
        onImportEnvironmentFile={onImportEnvironmentFile}
      />
    );
  }

  return {
    onImportEnvironmentFile,
    ...render(<Harness />),
  };
}

describe("SettingsPanel", () => {
  it("サイドバーの件数は保存済み value 数を表示する", () => {
    renderSettingsPanel();

    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("line item editor で key/value を自動保存できる", async () => {
    renderSettingsPanel();

    fireEvent.change(screen.getByLabelText("Environment key 1"), { target: { value: "API_KEY" } });
    fireEvent.change(screen.getByLabelText("Environment value 1"), { target: { value: "secret-value" } });

    await waitFor(() => {
      expect(screen.getByDisplayValue("secret-value")).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("API_KEY")).toBeInTheDocument();
    expect(screen.getByDisplayValue("secret-value")).toBeInTheDocument();
  });

  it("duplicate key がある間は保存できず警告を表示する", () => {
    renderSettingsPanel();

    fireEvent.click(screen.getByRole("button", { name: "Add environment value" }));
    fireEvent.change(screen.getByLabelText("Environment key 1"), { target: { value: "TOKEN" } });
    fireEvent.change(screen.getByLabelText("Environment key 2"), { target: { value: "TOKEN" } });

    expect(screen.getByRole("alert")).toHaveTextContent("Duplicate keys: TOKEN");
  });

  it("値変更は自動保存される", async () => {
    renderSettingsPanel();

    fireEvent.change(screen.getByLabelText("Environment value 1"), { target: { value: "next-token" } });

    await waitFor(() => {
      expect(screen.getByDisplayValue("next-token")).toBeInTheDocument();
    });
  });

  it("environment tab を切り替えて close button で削除できる", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderSettingsPanel();

    fireEvent.click(screen.getByRole("button", { name: "US" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("us-token")).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("us-token")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete LOCAL_ENV US" }));

    await waitFor(() => {
      expect(screen.queryByRole("tab", { name: "US" })).not.toBeInTheDocument();
    });

    expect(confirmSpy).toHaveBeenCalledWith('Delete LOCAL_ENV "US"?');
  });

  it("environment を追加すると新しい tab が選択される", async () => {
    renderSettingsPanel();

    fireEvent.click(screen.getByRole("button", { name: "Add LOCAL_ENV" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("LOCAL_ENV")).toBeInTheDocument();
    });
  });

  it("tab は 10 件で追加ボタンを表示しない", () => {
    renderSettingsPanel({
      domains: Array.from({ length: 10 }, (_, index) => ({
        id: `env-${index + 1}`,
        name: `LOCAL_ENV_${index + 1}`,
        matchHost: `example${index + 1}.com`,
        values: [],
      })),
      activeDomainId: "env-1",
    });

    expect(screen.queryByRole("button", { name: "Add LOCAL_ENV" })).not.toBeInTheDocument();
  });

  it("value row を close button で削除できる", async () => {
    renderSettingsPanel({
      domains: [
        {
          id: "jp",
          name: "Japan",
          matchHost: "example.jp",
          values: [
            { key: "TOKEN", value: "jp-token" },
            { key: "BASE_URL", value: "https://example.com" },
          ],
        },
      ],
      activeDomainId: "jp",
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove environment value 2" }));

    await waitFor(() => {
      expect(screen.queryByDisplayValue("BASE_URL")).not.toBeInTheDocument();
    });
  });
});