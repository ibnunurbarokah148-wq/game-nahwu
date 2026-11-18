import { describe, expect, it } from "vitest";
import { encodeQrMatrix } from "./qr";

describe("QR matrix encoder", () => {
  it("generates a valid square QR matrix with standard finder patterns", () => {
    const matrix = encodeQrMatrix("http://192.168.1.13:3000/join/KARTU7");
    const size = matrix.length;
    expect(size).toBeGreaterThanOrEqual(21);
    expect(matrix.every((row) => row.length === size)).toBe(true);

    // Top-left 7x7 finder pattern outer ring and center 3x3
    for (let i = 0; i < 7; i += 1) {
      expect(matrix[0][i]).toBe(true);
      expect(matrix[6][i]).toBe(true);
      expect(matrix[i][0]).toBe(true);
      expect(matrix[i][6]).toBe(true);
    }
    expect(matrix[3][3]).toBe(true);
    expect(matrix[1][1]).toBe(false);

    // Top-right and bottom-left finder centers
    expect(matrix[3][size - 4]).toBe(true);
    expect(matrix[size - 4][3]).toBe(true);

    // Mandatory dark module next to bottom-left finder
    expect(matrix[size - 8][8]).toBe(true);
  });
});
