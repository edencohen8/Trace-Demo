// Subtract the decimal values represented by parsed measurements. Scaling to
// integers avoids exposing binary subtraction residue as measured precision.
export function decimalDifference(a: number, b: number): number {
  const parts = (value: number) => {
    if (!Number.isFinite(value)) throw new Error('Cannot calculate a non-finite measurement');
    const [mantissa, exponent = '0'] = String(value).split('e');
    const fraction = mantissa!.split('.')[1]?.length ?? 0;
    return { integer: BigInt(mantissa!.replace('.', '')), scale: fraction - Number(exponent) };
  };
  const left = parts(a);
  const right = parts(b);
  const scale = Math.max(0, left.scale, right.scale);
  const difference = left.integer * 10n ** BigInt(scale - left.scale)
    - right.integer * 10n ** BigInt(scale - right.scale);
  return Number(`${difference}e-${scale}`);
}
