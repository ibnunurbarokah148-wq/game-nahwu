const VERSIONS = [
  { version: 1, size: 21, dataCodewords: 19, ecCodewords: 7, alignment: [] as number[] },
  { version: 2, size: 25, dataCodewords: 34, ecCodewords: 10, alignment: [6, 18] },
  { version: 3, size: 29, dataCodewords: 55, ecCodewords: 15, alignment: [6, 22] },
  { version: 4, size: 33, dataCodewords: 80, ecCodewords: 20, alignment: [6, 26] },
  { version: 5, size: 37, dataCodewords: 108, ecCodewords: 26, alignment: [6, 30] },
] as const;

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(() => {
  let value = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = value;
    GF_LOG[value] = i;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function buildRsGenerator(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i += 1) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function computeEcBytes(data: Uint8Array, ecCount: number): Uint8Array {
  const generator = buildRsGenerator(ecCount);
  const buffer = new Uint8Array(data.length + ecCount);
  buffer.set(data);
  for (let i = 0; i < data.length; i += 1) {
    const lead = buffer[i];
    if (lead === 0) continue;
    for (let j = 0; j < generator.length; j += 1) {
      buffer[i + j] ^= gfMul(generator[j], lead);
    }
  }
  return buffer.slice(data.length);
}

function encodeDataCodewords(bytes: Uint8Array, capacity: number): Uint8Array {
  const bits: number[] = [];
  const pushBits = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) {
      bits.push((value >> i) & 1);
    }
  };

  pushBits(0b0100, 4); // Byte mode
  pushBits(bytes.length, 8);
  for (const byte of bytes) pushBits(byte, 8);

  const maxBits = capacity * 8;
  const terminator = Math.min(4, maxBits - bits.length);
  for (let i = 0; i < terminator; i += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = new Uint8Array(capacity);
  let idx = 0;
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b += 1) byte = (byte << 1) | bits[i + b];
    codewords[idx] = byte;
    idx += 1;
  }

  let padToggle = 0;
  while (idx < capacity) {
    codewords[idx] = padToggle === 0 ? 0xec : 0x11;
    padToggle ^= 1;
    idx += 1;
  }
  return codewords;
}

function createMatrix(size: number): { modules: boolean[][]; reserved: boolean[][] } {
  return {
    modules: Array.from({ length: size }, () => Array(size).fill(false)),
    reserved: Array.from({ length: size }, () => Array(size).fill(false)),
  };
}

function drawFinder(modules: boolean[][], reserved: boolean[][], row: number, col: number): void {
  const size = modules.length;
  for (let dr = -1; dr <= 7; dr += 1) {
    for (let dc = -1; dc <= 7; dc += 1) {
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || r >= size || c < 0 || c >= size) continue;
      const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
      const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
      const inCenter = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
      modules[r][c] = inOuter && (onBorder || inCenter);
      reserved[r][c] = true;
    }
  }
}

function drawAlignment(modules: boolean[][], reserved: boolean[][], centerR: number, centerC: number): void {
  for (let dr = -2; dr <= 2; dr += 1) {
    for (let dc = -2; dc <= 2; dc += 1) {
      const r = centerR + dr;
      const c = centerC + dc;
      modules[r][c] = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
      reserved[r][c] = true;
    }
  }
}

function drawFunctionPatterns(
  modules: boolean[][],
  reserved: boolean[][],
  alignment: readonly number[]
): void {
  const size = modules.length;
  drawFinder(modules, reserved, 0, 0);
  drawFinder(modules, reserved, 0, size - 7);
  drawFinder(modules, reserved, size - 7, 0);

  for (let i = 8; i < size - 8; i += 1) {
    const bit = i % 2 === 0;
    modules[6][i] = bit;
    modules[i][6] = bit;
    reserved[6][i] = true;
    reserved[i][6] = true;
  }

  if (alignment.length > 0) {
    for (const r of alignment) {
      for (const c of alignment) {
        if (!reserved[r][c]) {
          drawAlignment(modules, reserved, r, c);
        }
      }
    }
  }

  // Reserve format info strips + dark module
  for (let i = 0; i < 9; i += 1) {
    if (i !== 6) {
      reserved[8][i] = true;
      reserved[i][8] = true;
    }
  }
  for (let i = size - 8; i < size; i += 1) {
    reserved[8][i] = true;
    reserved[i][8] = true;
  }
  modules[size - 8][8] = true;
  reserved[size - 8][8] = true;
}

function placeDataBits(modules: boolean[][], reserved: boolean[][], codewords: Uint8Array): void {
  const size = modules.length;
  let bitIndex = 0;
  const totalBits = codewords.length * 8;
  let upward = true;

  for (let rightCol = size - 1; rightCol >= 1; rightCol -= 2) {
    if (rightCol === 6) rightCol -= 1;
    for (let step = 0; step < size; step += 1) {
      const r = upward ? size - 1 - step : step;
      for (let offset = 0; offset < 2; offset += 1) {
        const c = rightCol - offset;
        if (reserved[r][c]) continue;
        let bit = false;
        if (bitIndex < totalBits) {
          const byte = codewords[bitIndex >> 3];
          bit = ((byte >> (7 - (bitIndex & 7))) & 1) === 1;
          bitIndex += 1;
        }
        modules[r][c] = bit;
      }
    }
    upward = !upward;
  }
}

function maskMatches(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0:
      return (r + c) % 2 === 0;
    case 1:
      return r % 2 === 0;
    case 2:
      return c % 3 === 0;
    case 3:
      return (r + c) % 3 === 0;
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    default:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  }
}

function applyFormatBits(modules: boolean[][], mask: number): void {
  const size = modules.length;
  const data = (0b01 << 3) | mask;
  let rem = data << 10;
  for (let i = 14; i >= 10; i -= 1) {
    if ((rem >> i) & 1) rem ^= 0x537 << (i - 10);
  }
  const bits = ((data << 10) | rem) ^ 0x5412;

  for (let i = 0; i < 15; i += 1) {
    const bit = ((bits >> (14 - i)) & 1) === 1;
    if (i < 6) modules[8][i] = bit;
    else if (i === 6) modules[8][7] = bit;
    else if (i === 7) modules[8][8] = bit;
    else if (i === 8) modules[7][8] = bit;
    else modules[14 - i][8] = bit;

    if (i < 7) modules[size - 1 - i][8] = bit;
    else modules[8][size - 15 + i] = bit;
  }
}

function scoreMatrix(modules: boolean[][]): number {
  const size = modules.length;
  let penalty = 0;

  for (let r = 0; r < size; r += 1) {
    let runColor = modules[r][0];
    let runLen = 1;
    for (let c = 1; c < size; c += 1) {
      if (modules[r][c] === runColor) {
        runLen += 1;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = modules[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }

  for (let c = 0; c < size; c += 1) {
    let runColor = modules[0][c];
    let runLen = 1;
    for (let r = 1; r < size; r += 1) {
      if (modules[r][c] === runColor) {
        runLen += 1;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = modules[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }

  for (let r = 0; r < size - 1; r += 1) {
    for (let c = 0; c < size - 1; c += 1) {
      const color = modules[r][c];
      if (
        modules[r][c + 1] === color &&
        modules[r + 1][c] === color &&
        modules[r + 1][c + 1] === color
      ) {
        penalty += 3;
      }
    }
  }

  let darkCount = 0;
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (modules[r][c]) darkCount += 1;
    }
  }
  const percent = (darkCount * 100) / (size * size);
  const prevStep = Math.floor(Math.abs(percent - 50) / 5);
  penalty += prevStep * 10;

  return penalty;
}

export function encodeQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const spec =
    VERSIONS.find((candidate) => bytes.length <= candidate.dataCodewords - 2) ??
    VERSIONS[VERSIONS.length - 1];
  const clampedBytes = bytes.slice(0, spec.dataCodewords - 2);
  const data = encodeDataCodewords(clampedBytes, spec.dataCodewords);
  const ec = computeEcBytes(data, spec.ecCodewords);
  const fullCodewords = new Uint8Array(data.length + ec.length);
  fullCodewords.set(data);
  fullCodewords.set(ec, data.length);

  const base = createMatrix(spec.size);
  drawFunctionPatterns(base.modules, base.reserved, spec.alignment);
  placeDataBits(base.modules, base.reserved, fullCodewords);

  let bestMask = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestModules = base.modules;

  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = base.modules.map((row, r) =>
      row.map((val, c) => (base.reserved[r][c] ? val : val !== maskMatches(mask, r, c)))
    );
    applyFormatBits(candidate, mask);
    const score = scoreMatrix(candidate);
    if (score < bestScore) {
      bestScore = score;
      bestMask = mask;
      bestModules = candidate;
    }
  }

  void bestMask;
  return bestModules;
}
