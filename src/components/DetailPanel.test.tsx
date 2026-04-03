import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DetailPanel } from "./DetailPanel";
import type { Story } from "../types";

function createStory(overrides?: Partial<Story>): Story {
  return {
    id: "test-story",
    title: "Test Story",
    steps: [],
    ...overrides,
  };
}

const defaultProps = {
  isOpen: true,
  story: null as Story | null,
  storyResult: null,
  onUpdateStory: vi.fn(),
  onRunStory: vi.fn(),
  onRunStoryRepeat: vi.fn(),
  onCancelRun: vi.fn(),
  onCancelRepeat: vi.fn(),
  isRunning: false,
  repeatProgress: null,
  repeatResult: null,
  standaloneStories: [],
  storyResults: {},
};

describe("DetailPanel sensitive マスキング", () => {
  it("sensitive な値は「••••••」で表示される", () => {
    const story = createStory({
      steps: [
        { order: 1, action: "type", target: "#password", value: "secret123", description: "", sensitive: true },
      ],
    });

    render(<DetailPanel {...defaultProps} story={story} />);

    expect(screen.getByText(/••••••/)).toBeInTheDocument();
    expect(screen.queryByText("secret123")).not.toBeInTheDocument();
  });

  it("sensitive でない値はそのまま表示される", () => {
    const story = createStory({
      steps: [
        { order: 1, action: "type", target: "#username", value: "admin", description: "" },
      ],
    });

    render(<DetailPanel {...defaultProps} story={story} />);

    expect(screen.getByText(/admin/)).toBeInTheDocument();
  });

  it("sensitive ステップに鍵バッジが表示される", () => {
    const story = createStory({
      steps: [
        { order: 1, action: "type", target: "#password", value: "secret", description: "", sensitive: true },
      ],
    });

    render(<DetailPanel {...defaultProps} story={story} />);

    const badge = screen.getByTitle("機密値");
    expect(badge).toBeInTheDocument();
  });

  it("sensitive でないステップに鍵バッジは表示されない", () => {
    const story = createStory({
      steps: [
        { order: 1, action: "type", target: "#username", value: "admin", description: "" },
      ],
    });

    render(<DetailPanel {...defaultProps} story={story} />);

    expect(screen.queryByTitle("機密値")).not.toBeInTheDocument();
  });
});
