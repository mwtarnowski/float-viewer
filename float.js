const buffer = new ArrayBuffer(8);
const uview = new BigUint64Array(buffer);
const fview = new Float64Array(buffer);

function float64ToUint64(x) {
  fview[0] = x;
  return uview[0];
}

function uint64ToFloat64(n) {
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
  return number;
}

function incMod(value, max, neg) {
  return (neg ? (value === 0n ? max : value - 1n) 
              : (value === max ? 0n : value + 1n));
}

function bitLength(value) {
  // if (value === 0n) return 0n;
  return BigInt(value.toString(2).length);
}

function rshiftRNE(value, shift) {
  if (shift === 0n) return value;
  const rem = value & ((1n << shift) - 1n);
  const half = 1n << (shift - 1n);
  value >>= shift;
  if (rem > half || (rem === half && (value & 1n)))
    value += 1n;
  return value;
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

const FP16 = new Format(5, 10);
const BF16 = new Format(8, 7);
const FP32 = new Format(8, 23);
const FP64 = new Format(11, 52);

function encode(sign, exponent, mantissa, format) {
  return (sign << format.exponentBits | exponent) << format.mantissaBits | mantissa;
}

function decode(raw, format) {
  const sign = (raw >> (format.exponentBits + format.mantissaBits)) & 1n;
  const exponent = (raw >> format.mantissaBits) & format.maxExponent;
  const mantissa = raw & format.maxMantissa;
  return [sign, exponent, mantissa];
}

function convert(exponent, mantissa, srcFormat, dstFormat) {
  // Handle Inf and NaN
  if (exponent === srcFormat.maxExponent) {
    const isNaN = mantissa !== 0n;
    return [dstFormat.maxExponent, isNaN ? dstFormat.maxMantissa : 0n];
  }

  // Handle zero and subnormals
  if (exponent === 0n) {
    if (mantissa === 0n) {
      return [0n, 0n];
    }

    // Normalize subnormal
    const shift = srcFormat.mantissaBits + 1n - bitLength(mantissa);
    mantissa = (mantissa << shift) & srcFormat.maxMantissa;
    exponent = 1n - shift;
  }

  exponent += dstFormat.exponentBias - srcFormat.exponentBias;

  // Handle exponent overflow
  if (exponent >= dstFormat.maxExponent) {
    return [dstFormat.maxExponent, 0n];
  }

  let mantissaShift = dstFormat.mantissaBits - srcFormat.mantissaBits;

  // Handle subnormal result
  if (exponent <= 0n) {
    mantissa |= 1n << srcFormat.mantissaBits;
    mantissaShift -= (1n - exponent);
    exponent = 0n;
  }

  if (mantissaShift < 0) {
    mantissa = rshiftRNE(mantissa, -mantissaShift);
    if (mantissa > dstFormat.maxMantissa) {
      mantissa = 0n;
      exponent += 1n;
    }
  } else {
    mantissa <<= mantissaShift;
  }

  return [exponent, mantissa];
}

class FloatingPoint {
  constructor(format) {
    this.format = format;
    this.isFP64 = FP64.equals(this.format);

    this.raw = 0n;
    this.sign = 0n;
    this.exponent = 0n;
    this.mantissa = 0n;
  }

  setFormat(format) {
    if (this.format.equals(format)) return;
    const oldFormat = this.format;
    this.format = format;
    this.isFP64 = FP64.equals(this.format);
    [this.exponent, this.mantissa] = convert(this.exponent, this.mantissa, oldFormat, this.format);
    this.updateRaw();
  }

  updateParts() {
    [this.sign, this.exponent, this.mantissa] = decode(this.raw, this.format);
  }

  updateRaw() {
    this.raw = encode(this.sign, this.exponent, this.mantissa, this.format);
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
  setParts(sign, exponent, mantissa) {
    if (!this.isValidSign(sign) || !this.isValidExponent(exponent) || !this.isValidMantissa(mantissa)) return false;
    if (this.sign === sign && this.exponent === exponent && this.mantissa === mantissa) return false;
    this.sign = sign;
    this.exponent = exponent;
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
    if (this.isFP64) {
      return uint64ToFloat64(this.raw);
    } else {
      const [exponent, mantissa] = convert(this.exponent, this.mantissa, this.format, FP64);
      const raw = encode(this.sign, exponent, mantissa, FP64);
      return uint64ToFloat64(raw);
    }
  }

  setNumber(number) {
    if (this.isFP64) {
      return this.setRaw(float64ToUint64(number));
    } else {
      const raw = float64ToUint64(number);
      let [sign, exponent, mantissa] = decode(raw, FP64);
      [exponent, mantissa] = convert(exponent, mantissa, FP64, this.format);
      return this.setParts(sign, exponent, mantissa);
    }
  }
};


