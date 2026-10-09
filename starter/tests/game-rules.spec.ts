import { describe, expect, it } from "vitest";
import { generateBoard } from "../src/domain/game/board-generator";
import { durationToCells } from "../src/domain/game/duration-config";
import { poolForCell, resolveCorrectAnswer, resolveIncorrectAnswer } from "../src/domain/game/game-rules";

 describe("durationToCells", () => {
  it("uses approved presets", () => {
    expect(durationToCells(20)).toBe(4);
    expect(durationToCells(60)).toBe(9);
  });
});

describe("generateBoard", () => {
  it("is deterministic and respects plus-one constraints", () => {
    const board = generateBoard({ length: 9, seed: "example-game" });
    expect(board).toEqual(generateBoard({ length: 9, seed: "example-game" }));
    expect(board[0].modifier).toBe("NONE");
    expect(board.at(-1)?.modifier).toBe("NONE");
    for (let index = 1; index < board.length; index += 1) {
      expect(board[index - 1].modifier === "PLUS_ONE" && board[index].modifier === "PLUS_ONE").toBe(false);
    }
  });
});

describe("pools", () => {
  it("maps crossed questions correctly", () => {
    expect(poolForCell("CROSSED", "PAU")).toBe("PAU_TECLA");
    expect(poolForCell("CROSSED", "TECLA")).toBe("TECLA_PAU");
  });
});

describe("answer resolution", () => {
  const plusOne = { position: 4, type: "PERSONAL" as const, modifier: "PLUS_ONE" as const };
  it("moves one extra cell without chaining", () => {
    expect(resolveCorrectAnswer(3, plusOne, 7).finalPosition).toBe(5);
  });
  it("applies double drink on plus-one failure", () => {
    expect(resolveIncorrectAnswer(3, plusOne).drinkCount).toBe(2);
  });
});
