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
    this.exponentBits = 8n;
    this.mantissaBits = 23n;
    this.totalBits = 1n + this.exponentBits + this.mantissaBits;

    this.maxRaw = (1n << this.totalBits) - 1n;
    this.maxExponent = (1n << this.exponentBits) - 1n;
    this.maxMantissa = (1n << this.mantissaBits) - 1n;

    this.raw = 0n;
    this.sign = 0n;
    this.exponent = 0n;
    this.mantissa = 0n;
  }

  updateParts() {
    this.sign = (this.raw >> (this.exponentBits + this.mantissaBits)) & 1n;
    this.exponent = (this.raw >> this.mantissaBits) & this.maxExponent;
    this.mantissa = this.raw & this.maxMantissa;
  }

  updateRaw() {
    this.raw = (this.sign << this.exponentBits | this.exponent) << this.mantissaBits | this.mantissa;
  }

  isValidRaw(raw) { return raw != null && 0n <= raw && raw <= this.maxRaw; }
  isValidSign(sign) { return sign != null && 0n <= sign && sign <= 1n; }
  isValidExponent(exponent) { return exponent != null && 0n <= exponent && exponent <= this.maxExponent; }
  isValidMantissa(mantissa) { return mantissa != null && 0n <= mantissa && mantissa <= this.maxMantissa; }

  getRaw() { return this.raw; }
  getSign() { return this.sign; }
  getExponent() { return this.exponent; }
  getMantissa() { return this.mantissa; }

  setRaw(raw) {
    if (!this.isValidRaw(raw) || this.raw === raw) return false;
    this.raw = raw;
    this.updateParts();
    return true;
  }
  setSign(sign) {
    if (!this.isValidSign(sign) || this.sign === sign) return false;
    this.sign = sign;
    this.updateRaw();
    return true;
  }
  setExponent(exponent) {
    if (!this.isValidExponent(exponent) || this.exponent === exponent) return false;
    this.exponent = exponent;
    this.updateRaw();
    return true;
  }
  setMantissa(mantissa) {
    if (!this.isValidMantissa(mantissa) || this.mantissa === mantissa) return false;
    this.mantissa = mantissa;
    this.updateRaw();
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


