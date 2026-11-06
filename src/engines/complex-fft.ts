/*************************************************************************
 * 2. RADIX-2 128-POINT 2D COMPLEX FFT ENGINE
 *************************************************************************/
export class ComplexFFT {
  /** In-place forward transform of the complex signal `re + i·im`; the length must be a power of two. */
  static transform(re: Float64Array, im: Float64Array): void {
    const n = re.length;
    let j = 0;
    for (let i = 0; i < n; i++) {
      if (i < j) {
        const tr = re[i];
        re[i] = re[j];
        re[j] = tr;
        const ti = im[i];
        im[i] = im[j];
        im[j] = ti;
      }
      let m = n >> 1;
      while (m >= 1 && j >= m) {
        j -= m;
        m >>= 1;
      }
      j += m;
    }
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1;
      const ang = (-2 * Math.PI) / len;
      const wlenRe = Math.cos(ang);
      const wlenIm = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let wRe = 1,
          wIm = 0;
        for (let k = 0; k < half; k++) {
          const uRe = re[i + k],
            uIm = im[i + k];
          const vRe = re[i + k + half] * wRe - im[i + k + half] * wIm;
          const vIm = re[i + k + half] * wIm + im[i + k + half] * wRe;
          re[i + k] = uRe + vRe;
          im[i + k] = uIm + vIm;
          re[i + k + half] = uRe - vRe;
          im[i + k + half] = uIm - vIm;
          const nextWRe = wRe * wlenRe - wIm * wlenIm;
          wIm = wRe * wlenIm + wIm * wlenRe;
          wRe = nextWRe;
        }
      }
    }
  }
}
