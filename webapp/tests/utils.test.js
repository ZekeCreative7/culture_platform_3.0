import { describe, it, expect } from 'vitest';
import { scoreOf, maskIfSmall } from '../src/utils.js';

describe('scoreOf', () => {
  it('숫자 형태의 값을 그대로 반환해야 한다', () => {
    expect(scoreOf(5)).toBe(5);
    expect(scoreOf(3.2)).toBe(3.2);
  });

  it('텍스트로 표현된 척도 응답을 올바른 숫자 점수로 변환해야 한다', () => {
    expect(scoreOf('매우 그렇다')).toBe(5);
    expect(scoreOf('그렇다')).toBe(4);
    expect(scoreOf('보통')).toBe(3);
    expect(scoreOf('아니다')).toBe(2);
    expect(scoreOf('전혀 아니다')).toBe(1);
  });

  it('무효한 응답 또는 빈 입력에 대해 null을 반환해야 한다', () => {
    expect(scoreOf('모름')).toBeNull();
    expect(scoreOf('해당 없음')).toBeNull();
    expect(scoreOf('')).toBeNull();
    expect(scoreOf(null)).toBeNull();
    expect(scoreOf(undefined)).toBeNull();
  });
});

describe('maskIfSmall', () => {
  it('표본 수 N < 3인 경우 마스킹 문자열("—")을 반환해야 한다', () => {
    expect(maskIfSmall(2, 4.2)).toBe('—');
    expect(maskIfSmall(0, 5.0)).toBe('—');
  });

  it('표본 수 N >= 3인 경우 입력한 평균 값을 그대로 반환해야 한다', () => {
    expect(maskIfSmall(3, 4.2)).toBe(4.2);
    expect(maskIfSmall(10, 3.5)).toBe(3.5);
  });

  it('표본 수 N이 null인 경우 마스킹 처리를 하지 않고 값을 그대로 반환해야 한다', () => {
    expect(maskIfSmall(null, 4.2)).toBe(4.2);
  });
});
