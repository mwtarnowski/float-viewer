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

function incMod(value, max, neg) {
  return (neg ? (value === 0n ? max : value - 1n) 
              : (value === max ? 0n : value + 1n));
}

class Format {
  constructor(exponentBits, mantissaBits) {
    this.exponentBits = BigInt(exponentBits);
    this.mantissaBits = BigInt(mantissaBits);
    this.totalBits = 1n + this.exponentBits + this.mantissaBits;
    this.maxRaw = (1n << this.totalBits) - 1n;
    this.maxExponent = (1n << this.exponentBits) - 1n;
    this.maxMantissa = (1n << this.mantissaBits) - 1n;
    this.exponentBias = (1n << (this.exponentBits - 1n)) - 1n;
  }

  equals(other) {
    return (other instanceof Format &&
      this.exponentBits === other.exponentBits &&
      this.mantissaBits === other.mantissaBits);
  }
}

const FP32 = new Format(8, 23);

class FloatingPoint {
  constructor(format) {
    this.format = format;
    this.raw = 0n;
    this.sign = 0n;
    this.exponent = 0n;
    this.mantissa = 0n;
  }

  updateParts() {
    this.sign = (this.raw >> (this.format.exponentBits + this.format.mantissaBits)) & 1n;
    this.exponent = (this.raw >> this.format.mantissaBits) & this.format.maxExponent;
    this.mantissa = this.raw & this.format.maxMantissa;
  }

  updateRaw() {
    this.raw = (this.sign << this.format.exponentBits | this.exponent) << this.format.mantissaBits | this.mantissa;
  }

  isValidRaw(raw) { return raw != null && 0n <= raw && raw <= this.format.maxRaw; }
  isValidSign(sign) { return sign != null && 0n <= sign && sign <= 1n; }
  isValidExponent(exponent) { return exponent != null && 0n <= exponent && exponent <= this.format.maxExponent; }
  isValidMantissa(mantissa) { return mantissa != null && 0n <= mantissa && mantissa <= this.format.maxMantissa; }

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

  incRaw(neg) {
    this.raw = incMod(this.raw, this.format.maxRaw, neg);
    this.updateParts();
  }
  incSign() { 
    this.sign ^= 1n;
    this.updateRaw();
  }
  incExponent(neg) {
    this.exponent = incMod(this.exponent, this.format.maxExponent, neg);
    this.updateRaw();
  }
  incMantissa(neg) {
    this.mantissa = incMod(this.mantissa, this.format.maxMantissa, neg);
    this.updateRaw();
  }

  getBit(index) {
    return Number((this.raw >> BigInt(index)) & 1n);
  }

  setBit(index, bit) {
    const mask = (1n << BigInt(index)) & this.format.maxRaw;
    const raw = bit ? (this.raw | mask) : (this.raw & ~mask);
    return this.setRaw(raw);
  }

  getNumber() {
    if (!FP32.equals(this.format)) throw new Error("Unsupported format");
    return uint32ToFloat32(Number(this.raw));
  }

  setNumber(number) {
    if (number == null) return false;
    if (!FP32.equals(this.format)) throw new Error("Unsupported format");
    return this.setRaw(BigInt(float32ToUint32(number)));
  }
};


