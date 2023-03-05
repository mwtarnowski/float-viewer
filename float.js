const buffer = new ArrayBuffer(4);
const uview = new Uint32Array(buffer);
const fview = new Float32Array(buffer);

function numberToFloat32(x) {
  fview[0] = x;
  return fview[0];
}

function float32ToUint32(x) {
  fview[0] = x;
  return uview[0];
}

function uint32ToFloat32(n) {
  uview[0] = n;
  return fview[0];
}

function parseBigUint(str, radix) {
  if (!str) return;
  const regex = radix == 16 ? /^[0-9A-F]+$/i : /^[0-9]+$/;
  if (!regex.test(str)) return;
  return BigInt(radix == 16 ? '0x' + str : str);
}

function parseFloatStrict(str) {
  if (!str) return;
  const number = Number(str);
  if (isNaN(number) && str !== "NaN") return;
  return numberToFloat32(number);
}

class FloatingPoint {
  constructor() {
    this.totalBits = 32;
    this.raw = 0n;
    this.maxRaw = (1n << BigInt(this.totalBits)) - 1n;
  }

  isValidRaw(raw) { return raw != null && 0n <= raw && raw <= this.maxRaw; }

  getRaw() { return this.raw; }

  setRaw(raw) {
    if (!this.isValidRaw(raw) || this.raw === raw) return false;
    this.raw = raw;
    return true;
  }

  getBit(index) {
    return Number((this.raw >> BigInt(index)) & 1n);
  }

  setBit(index, bit) {
    const mask = (1n << BigInt(index)) & this.maxRaw;
    const raw = bit ? (this.raw | mask) : (this.raw & ~mask);
    return this.setRaw(raw);
  }

  getNumber() {
    return uint32ToFloat32(Number(this.raw));
  }

  setNumber(number) {
    if (number == null) return false;
    return this.setRaw(BigInt(float32ToUint32(number)));
  }
};


