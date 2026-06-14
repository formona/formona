import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import HomePage from './page';
import { APP_TIMING_MS } from '../constants';
import {
  FaceShape,
  type EyebrowOverlayAnchors,
  type FaceAlignment,
  type FaceAnalysisResult,
} from '../domain/types';

const analysisMock = vi.hoisted(() => ({
  current: null as FaceAnalysisResult | null,
}));
const capturePageMock = vi.hoisted(() => ({
  props: [] as Array<{ autoStartCamera?: boolean }>,
}));

vi.mock('motion/react', async () => {
  const ReactModule = await import('react');
  const ignoredMotionProps = new Set([
    'animate',
    'exit',
    'initial',
    'layout',
    'transition',
    'whileHover',
    'whileTap',
  ]);
  const createMotionElement = (tagName: string) => ReactModule.forwardRef<HTMLElement, Record<string, unknown>>(
    ({ children, ...props }, ref) => {
      const domProps = Object.fromEntries(
        Object.entries(props).filter(([key]) => !ignoredMotionProps.has(key)),
      );

      return ReactModule.createElement(tagName, { ...domProps, ref }, children as React.ReactNode);
    },
  );

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => ReactModule.createElement(ReactModule.Fragment, null, children),
    motion: new Proxy({}, {
      get: (_, tagName: string) => createMotionElement(tagName),
    }),
  };
});

vi.mock('../interface-adapters/react/components/CapturePage', () => ({
  CapturePage: ({
    autoStartCamera,
    onAnalysisComplete,
  }: {
    autoStartCamera?: boolean;
    onAnalysisComplete: (imageDataUrl: string, analysis: FaceAnalysisResult) => void;
  }) => {
    capturePageMock.props.push({ autoStartCamera });

    return (
      <>
        {autoStartCamera && <span>Mock camera auto-start</span>}
        <button
          type="button"
          onClick={() => {
            if (!analysisMock.current) throw new Error('Missing mocked analysis');
            onAnalysisComplete('data:image/jpeg;base64,monabrow', analysisMock.current);
          }}
        >
          Mock capture complete
        </button>
      </>
    );
  },
}));

const readyAlignment: FaceAlignment = {
  detected: true,
  centered: true,
  distanceOk: true,
  pitchOk: true,
  yawOk: true,
  guidance: '정면 위치가 안정적입니다',
  confidence: 0.9,
  ready: true,
};

const mockOverlayAnchors: EyebrowOverlayAnchors = {
  left: {
    sp: { x: 0.44, y: 0.35 },
    hp: { x: 0.38, y: 0.31, source: 'iris' },
    ep: { x: 0.28, y: 0.35 },
    confidence: 1,
  },
  right: {
    sp: { x: 0.56, y: 0.35 },
    hp: { x: 0.62, y: 0.31, source: 'iris' },
    ep: { x: 0.72, y: 0.35 },
    confidence: 1,
  },
  confidence: 1,
  transform: {
    origin: { x: 0.5, y: 0.45 },
    scale: 0.24,
    rotationRadians: 0,
    rotationDegrees: 0,
    confidence: 1,
  },
};

const makeAnalysis = (faceShape: FaceShape): FaceAnalysisResult => ({
  faceShape,
  faceDimensions: {
    faceWidth: 0.58,
    faceHeight: 0.72,
    jawWidth: 0.38,
    cheekWidth: 0.54,
    foreheadWidth: 0.58,
  },
  normalizedGeometry: {
    faceWidth: 0.58,
    faceHeight: 0.72,
    jawWidth: 0.38,
    cheekWidth: 0.54,
    foreheadWidth: 0.58,
    heightToWidth: 0.72 / 0.58,
    jawToCheek: 0.38 / 0.54,
    foreheadToCheek: 0.58 / 0.54,
    cheekToFaceWidth: 0.54 / 0.58,
  },
  proportionMetrics: {
    faceHeightToWidth: 0.72 / 0.58,
    faceWidthToHeight: 0.58 / 0.72,
    foreheadToFaceWidth: 0.58 / 0.58,
    cheekToFaceWidth: 0.54 / 0.58,
    jawToFaceWidth: 0.38 / 0.58,
    foreheadToCheek: 0.58 / 0.54,
    jawToCheek: 0.38 / 0.54,
    averageBrowToEye: 0.12,
    browToEyeHeight: 3,
    browToFaceHeight: 0.12 / 0.72,
    browGapToFaceWidth: 0.28,
    browLengthToFaceWidth: 0.24,
    archHeightToFaceHeight: 0.04,
    eyeHeightToFaceHeight: 0.05,
    eyeWidthToFaceWidth: 0.15,
    interEyeToFaceWidth: 0.28,
    confidence: 1,
  },
  faceCoordinateSpace: {
    origin: { x: 0.5, y: 0.43 },
    scale: 0.2,
    xAxis: { x: 1, y: 0 },
    yAxis: { x: 0, y: 1 },
    rotationRadians: 0,
    rotationDegrees: 0,
    confidence: 1,
    landmarks: Array.from({ length: 478 }, () => ({ x: 0, y: 0 })),
  },
  measurements: [
    { label: 'SP', value: '18.2mm' },
    { label: 'HP', value: '33.4mm' },
    { label: 'EP', value: '49.1mm' },
    { label: '전체 길이', value: '50.2mm' },
    { label: '두께', value: '6.1mm' },
    { label: '아치 높이', value: '7.3mm' },
    { label: '미간 간격', value: '21.0mm' },
  ],
  metrics: {
    sp: 18.2,
    hp: 33.4,
    ep: 49.1,
    totalLength: 50.2,
    thickness: 6.1,
    archHeight: 7.3,
    gap: 21,
  },
  eyebrowPosition: {
    left: {
      browHeight: 17.5,
      length: 50.1,
      archHeight: 7.1,
      archLocation: 0.48,
      startToPupil: 18.3,
      archToPupil: 33.2,
      endToPupil: 49.4,
    },
    right: {
      browHeight: 17.1,
      length: 50.3,
      archHeight: 7.5,
      archLocation: 0.5,
      startToPupil: 18.1,
      archToPupil: 33.6,
      endToPupil: 48.8,
    },
    browHeight: 17.3,
    browSpacing: 21,
    archHeight: 7.3,
    archLocation: 0.49,
    leftRightSymmetry: 98.6,
    heightAsymmetry: 0.02,
    lengthAsymmetry: 0.004,
    archLocationAsymmetry: 0.02,
    confidence: 1,
  },
  eyeGeometry: {
    left: {
      width: 21,
      height: 18.7,
      tiltDegrees: 0,
    },
    right: {
      width: 21,
      height: 18.7,
      tiltDegrees: 0,
    },
    eyeWidth: 21,
    eyeHeight: 18.7,
    eyeTiltDegrees: 0,
    interEyeSpacing: 42,
    confidence: 1,
  },
  ipdMm: 63,
  pupilIpd: {
    leftPupil: { x: 0.4, y: 0.43 },
    rightPupil: { x: 0.6, y: 0.43 },
    leftPupilPx: { x: 432, y: 825.6 },
    rightPupilPx: { x: 648, y: 825.6 },
    ipdPx: 216,
    normalizedIpd: 0.2,
    source: 'iris',
    confidence: 1,
  },
  pxToMmScale: 63 / 216,
  alignment: readyAlignment,
  overlayAnchors: mockOverlayAnchors,
  overlay: {
    left: 'M10,20 Q50,10 90,20',
    right: 'M10,20 Q50,10 90,20',
    viewBox: '0 0 100 100',
  },
});

describe('HomePage recommendation routing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    analysisMock.current = makeAnalysis(FaceShape.HEART);
    capturePageMock.props = [];
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ record: null }), { status: 201 })));
  });

  afterEach(() => {
    delete window.kakao;
    vi.useRealTimers();
  });

  it('passes the detected classifier face shape into eyebrow recommendations', async () => {
    render(<HomePage />);

    await act(async () => {
      vi.advanceTimersByTime(APP_TIMING_MS.splash);
    });

    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mock capture complete' }));

    expect(screen.getByRole('heading', { name: '추천 눈썹 디자인 결과' })).toBeInTheDocument();
    expect(screen.getAllByText(FaceShape.HEART).length).toBeGreaterThan(0);
    expect(screen.getByText('추천 디자인: 일자형')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '직선 수평형 선택' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: '자연 아치형 선택' })).not.toBeInTheDocument();

    expect(fetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '낮은 아치형 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    expect(screen.getByRole('heading', { name: '배송지 정보 입력' })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('continues to results when captured geometry confidence is zero but measurements are valid', async () => {
    const analysis = makeAnalysis(FaceShape.HEART);
    analysisMock.current = {
      ...analysis,
      eyebrowPosition: {
        ...analysis.eyebrowPosition,
        confidence: 0,
      },
      eyeGeometry: {
        ...analysis.eyeGeometry,
        confidence: 0,
      },
    };

    render(<HomePage />);

    await act(async () => {
      vi.advanceTimersByTime(APP_TIMING_MS.splash);
    });

    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mock capture complete' }));

    expect(screen.queryByText('Recommendation Error')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '기준점 신뢰도가 낮아요' })).not.toBeInTheDocument();
    expect(screen.getByText('추천 디자인: 일자형')).toBeInTheDocument();
  });

  it('shows an explicit recommendation error instead of fallback styles when metrics are invalid', async () => {
    analysisMock.current = {
      ...makeAnalysis(FaceShape.HEART),
      metrics: {
        ...makeAnalysis(FaceShape.HEART).metrics,
        totalLength: Number.NaN,
      },
    };

    render(<HomePage />);

    await act(async () => {
      vi.advanceTimersByTime(APP_TIMING_MS.splash);
    });

    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mock capture complete' }));

    expect(screen.getByText('Recommendation Error')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '눈썹 측정값을 다시 확인해야 해요' })).toBeInTheDocument();
    expect(screen.getByText(/임의 추천을 표시하지 않았습니다/)).toBeInTheDocument();
    expect(screen.queryByText('직선 수평형')).not.toBeInTheDocument();
    expect(screen.queryByText('자연 아치형')).not.toBeInTheDocument();
  });

  it('auto-starts the camera when returning to capture from recommendation retry', async () => {
    render(<HomePage />);

    await act(async () => {
      vi.advanceTimersByTime(APP_TIMING_MS.splash);
    });

    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));
    expect(capturePageMock.props.at(-1)).toEqual({ autoStartCamera: false });

    fireEvent.click(screen.getByRole('button', { name: 'Mock capture complete' }));
    fireEvent.click(screen.getByRole('button', { name: '다시 측정' }));

    expect(screen.getByText('Mock camera auto-start')).toBeInTheDocument();
    expect(capturePageMock.props.at(-1)).toEqual({ autoStartCamera: true });
  });

  it('opens the address form after the result next step and can return to result', async () => {
    render(<HomePage />);

    await act(async () => {
      vi.advanceTimersByTime(APP_TIMING_MS.splash);
    });

    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mock capture complete' }));
    fireEvent.click(screen.getByRole('button', { name: '낮은 아치형 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    expect(screen.getByRole('heading', { name: '배송지 정보 입력' })).toBeInTheDocument();
    expect(screen.getByLabelText('받는 분')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '주문 완료' })).toBeInTheDocument();

    const submitOrderButton = screen.getByRole('button', { name: '주문 완료' });
    fireEvent.click(submitOrderButton);

    expect(screen.getByText('받는 분, 연락처, 배송지 주소, 상세 주소 확인이 필요합니다.')).toBeInTheDocument();
    expect(screen.getByText('받는 분을 입력해주세요.')).toBeInTheDocument();
    expect(screen.getByText('연락처를 입력해주세요.')).toBeInTheDocument();
    expect(screen.getByText('주소 검색으로 배송지를 선택해주세요.')).toBeInTheDocument();
    expect(screen.getByText('상세 주소를 입력해주세요.')).toBeInTheDocument();
    expect(screen.getByLabelText('받는 분')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('연락처')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('우편번호')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('기본 주소')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('상세 주소')).toHaveAttribute('aria-invalid', 'true');

    window.kakao = {
      Postcode: vi.fn(function MockPostcode(
        this: { open: () => void },
        options: { oncomplete: (data: {
          zonecode: string;
          address: string;
          roadAddress: string;
          jibunAddress: string;
          userSelectedType: 'R' | 'J';
          bname: string;
          buildingName: string;
          apartment: 'Y' | 'N';
        }) => void },
      ) {
        this.open = () => options.oncomplete({
          zonecode: '06142',
          address: '서울 강남구 테헤란로 123',
          roadAddress: '서울 강남구 테헤란로 123',
          jibunAddress: '서울 강남구 역삼동 123',
          userSelectedType: 'R',
          bname: '역삼동',
          buildingName: '포모나타워',
          apartment: 'N',
        });
      }),
    };

    fireEvent.change(screen.getByLabelText('기본 주소'), { target: { value: '테헤란로 123' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '주소 검색' }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByLabelText('우편번호')).toHaveValue('06142');
    expect(screen.getByLabelText('기본 주소')).toHaveValue('서울 강남구 테헤란로 123 (역삼동)');
    expect(screen.queryByText('주소가 입력되었습니다. 상세 주소를 확인해주세요.')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('기본 주소'), { target: { value: '서울 강남구 테헤란로 999' } });
    expect(screen.getByLabelText('우편번호')).toHaveValue('');
    expect(screen.getByText('주소가 변경되어 주소 검색을 다시 진행해주세요.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('기본 주소'), { target: { value: '테헤란로 123' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '주소 검색' }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByLabelText('우편번호')).toHaveValue('06142');
    expect(screen.getByLabelText('기본 주소')).toHaveValue('서울 강남구 테헤란로 123 (역삼동)');
    expect(screen.queryByText('주소가 변경되어 주소 검색을 다시 진행해주세요.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '배송 메모 문 앞에 놓아주세요' }));
    fireEvent.click(screen.getByRole('option', { name: '배송 전 연락주세요' }));

    expect(screen.getByRole('button', { name: '배송 메모 배송 전 연락주세요' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '주문 완료' }));
    expect(screen.getByText('받는 분을 입력해주세요.')).toBeInTheDocument();
    expect(screen.getByText('연락처를 입력해주세요.')).toBeInTheDocument();
    expect(screen.queryByText('주소 검색으로 배송지를 선택해주세요.')).not.toBeInTheDocument();
    expect(screen.getByText('상세 주소를 입력해주세요.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('받는 분'), { target: { value: '1' } });
    expect(screen.getByText('받는 분은 2~30자로 입력해주세요.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('받는 분'), { target: { value: '홍길동' } });
    expect(screen.queryByText('받는 분은 2~30자로 입력해주세요.')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('상세 주소'), { target: { value: '상'.repeat(101) } });
    expect(screen.getByText('상세 주소는 100자 이하로 입력해주세요.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('상세 주소'), { target: { value: '101동 1203호' } });
    expect(screen.queryByText('상세 주소는 100자 이하로 입력해주세요.')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('연락처'), { target: { value: '010-12' } });
    expect(screen.getByLabelText('연락처')).toHaveValue('010-12');
    expect(screen.getByText('올바른 연락처 형식으로 입력해주세요.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '주문 완료' }));
    expect(screen.getByText('올바른 연락처 형식으로 입력해주세요.')).toBeInTheDocument();
    expect(screen.getByLabelText('연락처')).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(screen.getByLabelText('연락처'), { target: { value: '01012345678' } });
    expect(screen.getByLabelText('연락처')).toHaveValue('010-1234-5678');
    expect(screen.queryByText('올바른 연락처 형식으로 입력해주세요.')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('연락처'), { target: { value: '0212345678' } });
    expect(screen.getByLabelText('연락처')).toHaveValue('02-1234-5678');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '주문 완료' }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole('dialog', { name: '주문이 완료되었습니다' })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/orders', expect.objectContaining({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }));
    const [, requestInit] = vi.mocked(fetch).mock.calls.at(-1) ?? [];
    const payload = JSON.parse(String(requestInit?.body));
    expect(payload).toMatchObject({
      schemaVersion: 'formona.order-submission.v1',
      measurement: {
        faceShape: FaceShape.HEART,
        selectedStyle: {
          id: 'low_arch',
          name: '낮은 아치형',
        },
      },
      shippingAddress: {
        recipient: '홍길동',
        phone: '02-1234-5678',
        postalCode: '06142',
        baseAddress: '서울 강남구 테헤란로 123 (역삼동)',
        detailAddress: '101동 1203호',
        deliveryMemo: '배송 전 연락주세요',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    fireEvent.click(screen.getByRole('button', { name: '이전 단계' }));

    expect(screen.getByRole('heading', { name: '추천 눈썹 디자인 결과' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

    expect(screen.getByRole('heading', { name: '배송지 정보 입력' })).toBeInTheDocument();
    expect(screen.getByLabelText('받는 분')).toHaveValue('홍길동');
    expect(screen.getByLabelText('연락처')).toHaveValue('02-1234-5678');
    expect(screen.getByLabelText('우편번호')).toHaveValue('06142');
    expect(screen.getByLabelText('기본 주소')).toHaveValue('서울 강남구 테헤란로 123 (역삼동)');
    expect(screen.getByLabelText('상세 주소')).toHaveValue('101동 1203호');
    expect(screen.getByRole('button', { name: '배송 메모 배송 전 연락주세요' })).toBeInTheDocument();
  });
});
