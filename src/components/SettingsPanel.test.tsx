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
        values: [{ key: "TOKEN", value: "jp-token" }],
      },
      {
        id: "us",
        name: "US",
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
            displayName: "ENV.TOKEN",
            status: "available",
            occurrenceCount: 1,
            stories: [{ storyId: "story-1", storyTitle: "Login" }],
          },
        ]}
        environmentSettings={settings}
        environmentSettingsError={null}
        environmentSourceStatus={{ mode: "domain-values", loadedVariableCount: 2, inlineValueCount: 1 }}
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
  it("line item editor で key/value を保存できる", async () => {
    renderSettingsPanel();

    fireEvent.change(screen.getByLabelText("Environment key 1"), { target: { value: "API_KEY" } });
    fireEvent.change(screen.getByLabelText("Environment value 1"), { target: { value: "secret-value" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("1 values saved")).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("API_KEY")).toBeInTheDocument();
    expect(screen.getByDisplayValue("secret-value")).toBeInTheDocument();
  });

  it("duplicate key がある間は保存できず警告を表示する", () => {
    renderSettingsPanel();

    fireEvent.click(screen.getByRole("button", { name: "Add row" }));
    fireEvent.change(screen.getByLabelText("Environment key 1"), { target: { value: "TOKEN" } });
    fireEvent.change(screen.getByLabelText("Environment key 2"), { target: { value: "TOKEN" } });

    expect(screen.getByRole("alert")).toHaveTextContent("Duplicate keys: TOKEN");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("未保存変更を表示し、保存後に消える", async () => {
    renderSettingsPanel();

    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Environment value 1"), { target: { value: "next-token" } });

    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    });
  });

  it("value 検索で対象行だけを表示する", () => {
    renderSettingsPanel({
      domains: [
        {
          id: "jp",
          name: "Japan",
          values: [
            { key: "TOKEN", value: "jp-token" },
            { key: "BASE_URL", value: "https://example.com" },
          ],
        },
      ],
      activeDomainId: "jp",
    });

    fireEvent.change(screen.getByLabelText("Search environment values"), { target: { value: "base" } });

    expect(screen.getByDisplayValue("BASE_URL")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("TOKEN")).not.toBeInTheDocument();
  });

  it("requirement 検索で一致しない場合は空状態を表示する", () => {
    renderSettingsPanel();

    fireEvent.change(screen.getByLabelText("Search environment requirements"), { target: { value: "checkout" } });

    expect(screen.getByText("No matching requirements.")).toBeInTheDocument();
  });

  it("domain tab を切り替えて current domain を削除できる", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderSettingsPanel();

    fireEvent.click(screen.getByRole("tab", { name: "US" }));

    await waitFor(() => {
      expect(screen.getByText("Editing US")).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("us-token")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete current domain" }));

    await waitFor(() => {
      expect(screen.queryByRole("tab", { name: "US" })).not.toBeInTheDocument();
    });

    expect(confirmSpy).toHaveBeenCalledWith('Delete domain "US"?');
  });

  it("domain を追加すると新しい tab が選択される", async () => {
    renderSettingsPanel();

    fireEvent.click(screen.getByRole("button", { name: "+ Add domain" }));

    await waitFor(() => {
      expect(screen.getByText("Editing Domain 3")).toBeInTheDocument();
    });
  });
});