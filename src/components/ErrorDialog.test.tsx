import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorDialog } from "./ErrorDialog";

describe("ErrorDialog", () => {
  it("setup guide を構造化して表示する", () => {
    render(
      <ErrorDialog
        title="Export 完了"
        message="1 story を export しました。"
        onClose={vi.fn()}
        setupGuide={{
          requirements: ["ENV.API_TOKEN", "ENV.PASSWORD"],
          footer: "Open Settings to add local values or import a .env file.",
        }}
      />,
    );

    expect(screen.getByLabelText("Setup guide")).toBeInTheDocument();
    expect(screen.getByText("ENV.API_TOKEN")).toBeInTheDocument();
    expect(screen.getByText("ENV.PASSWORD")).toBeInTheDocument();
    expect(screen.getByText("Open Settings to add local values or import a .env file.")).toBeInTheDocument();
  });

  it("primary action を押すと callback を呼ぶ", () => {
    const onPrimaryAction = vi.fn();

    render(
      <ErrorDialog
        title="環境変数が不足しています"
        message="Settings を開いて確認してください。"
        onClose={vi.fn()}
        primaryActionLabel="Settings を開く"
        onPrimaryAction={onPrimaryAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Settings を開く" }));
    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
  });
});