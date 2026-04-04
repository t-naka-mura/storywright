import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StepEditor } from "./StepEditor";
import type { Step } from "../types";

function createStep(overrides?: Partial<Step>): Step {
  return {
    id: "step-1",
    order: 1,
    action: "type",
    target: "#input",
    value: "test-value",
    description: "",
    ...overrides,
  };
}

describe("StepEditor sensitive トグル", () => {
  it("type アクションで sensitive チェックボックスが表示される", () => {
    render(
      <StepEditor
        step={createStep({ action: "type" })}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("機密値（パスワード等）")).toBeInTheDocument();
  });

  it("click アクションでは sensitive チェックボックスが表示されない", () => {
    render(
      <StepEditor
        step={createStep({ action: "click", value: "" })}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("機密値（パスワード等）")).not.toBeInTheDocument();
  });

  it("sensitive=true のステップはチェックボックスが ON", () => {
    render(
      <StepEditor
        step={createStep({ sensitive: true })}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const checkbox = screen.getByLabelText("機密値（パスワード等）") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("sensitive=true のとき value 入力が password type になる", () => {
    render(
      <StepEditor
        step={createStep({ sensitive: true })}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const inputs = screen.getAllByDisplayValue("test-value");
    const valueInput = inputs.find((el) => el.getAttribute("type") === "password");
    expect(valueInput).toBeTruthy();
  });

  it("sensitive=false のとき value 入力が text type になる", () => {
    render(
      <StepEditor
        step={createStep({ sensitive: false })}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const inputs = screen.getAllByDisplayValue("test-value");
    const valueInput = inputs.find((el) => el.getAttribute("type") === "text");
    expect(valueInput).toBeTruthy();
  });

  it("チェックボックスを ON にして Save すると sensitive=true で保存される", () => {
    const onSave = vi.fn();
    render(
      <StepEditor
        step={createStep({ sensitive: false })}
        onSave={onSave}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const checkbox = screen.getByLabelText("機密値（パスワード等）");
    fireEvent.click(checkbox);

    const saveButton = screen.getByText("Save");
    fireEvent.click(saveButton);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ sensitive: true }),
    );
  });

  it("チェックボックスを OFF にして Save すると sensitive が undefined になる", () => {
    const onSave = vi.fn();
    render(
      <StepEditor
        step={createStep({ sensitive: true })}
        onSave={onSave}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const checkbox = screen.getByLabelText("機密値（パスワード等）");
    fireEvent.click(checkbox);

    const saveButton = screen.getByText("Save");
    fireEvent.click(saveButton);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ sensitive: undefined }),
    );
  });

  it("ENV 参照があると Settings 導線を表示する", () => {
    render(
      <StepEditor
        step={createStep({ target: "#input", value: "{{LOCAL_ENV.USERNAME}}" })}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );

    expect(screen.getByText("Uses LOCAL_ENV.USERNAME")).toBeInTheDocument();
    expect(screen.getByText("Settings を開く")).toBeInTheDocument();
  });

  it("Settings 導線を押すとコールバックを呼ぶ", () => {
    const onOpenSettings = vi.fn();
    render(
      <StepEditor
        step={createStep({ target: "#input", value: "{{LOCAL_ENV.USERNAME}}" })}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onOpenSettings={onOpenSettings}
      />,
    );

    fireEvent.click(screen.getByText("Settings を開く"));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("ENV 参照の type step では sensitive 提案を表示する", () => {
    render(
      <StepEditor
        step={createStep({ action: "type", value: "{{LOCAL_ENV.PASSWORD}}", sensitive: false })}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("sensitive にする")).toBeInTheDocument();
  });

  it("sensitive 提案を押して Save すると sensitive=true で保存される", () => {
    const onSave = vi.fn();
    render(
      <StepEditor
        step={createStep({ action: "type", value: "{{LOCAL_ENV.PASSWORD}}", sensitive: false })}
        onSave={onSave}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("sensitive にする"));
    fireEvent.click(screen.getByText("Save"));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ sensitive: true }));
  });
});
