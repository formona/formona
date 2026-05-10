import { afterEach, describe, expect, it, vi } from 'vitest';

const loadFaceLandmarkerModule = async ({
  forVisionTasks = vi.fn().mockResolvedValue({ wasm: 'vision-fileset' }),
  createFromOptions = vi.fn().mockResolvedValue({ detectForVideo: vi.fn() }),
}: {
  forVisionTasks?: ReturnType<typeof vi.fn>;
  createFromOptions?: ReturnType<typeof vi.fn>;
} = {}) => {
  vi.resetModules();
  vi.doMock('@mediapipe/tasks-vision', () => ({
    FaceLandmarker: {
      createFromOptions,
    },
    FilesetResolver: {
      forVisionTasks,
    },
  }));

  const faceLandmarkerModule = await import('./face-landmarker');

  return {
    ...faceLandmarkerModule,
    createFromOptions,
    forVisionTasks,
  };
};

describe('MediaPipe face landmarker infrastructure adapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock('@mediapipe/tasks-vision');
    vi.resetModules();
  });

  it('creates and caches a CPU-compatible face landmarker instance', async () => {
    const landmarker = { detectForVideo: vi.fn() };
    const faceLandmarkerModule = await loadFaceLandmarkerModule({
      createFromOptions: vi.fn().mockResolvedValue(landmarker),
    });

    const first = await faceLandmarkerModule.getFaceLandmarker();
    const second = await faceLandmarkerModule.getFaceLandmarker();

    expect(first).toBe(second);

    expect(faceLandmarkerModule.forVisionTasks).toHaveBeenCalledOnce();
    expect(faceLandmarkerModule.createFromOptions).toHaveBeenCalledOnce();
    expect(faceLandmarkerModule.createFromOptions).toHaveBeenCalledWith(
      { wasm: 'vision-fileset' },
      expect.objectContaining({
        baseOptions: expect.objectContaining({ delegate: 'CPU' }),
        runningMode: 'VIDEO',
        numFaces: 1,
      }),
    );
  });

  it('suppresses known MediaPipe native runtime logs during video detection', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const landmarker = {
      detectForVideo: vi.fn(() => {
        console.error('INFO: Created TensorFlow Lite XNNPACK delegate for CPU.');
        console.warn('W0510 inference_feedback_manager.cc:121] Feedback manager requires a model with a single signature inference.');
        console.warn('W0510 face_landmarker_graph.cc:180] Sets FaceBlendshapesGraph acceleration to xnnpack by default.');
        console.warn('real warning');
        console.error('real error');

        return { faceLandmarks: [] };
      }),
    };
    const faceLandmarkerModule = await loadFaceLandmarkerModule({
      createFromOptions: vi.fn().mockResolvedValue(landmarker),
    });

    const wrappedLandmarker = await faceLandmarkerModule.getFaceLandmarker();
    const result = wrappedLandmarker.detectForVideo({} as HTMLVideoElement, 1000);

    expect(result).toEqual({ faceLandmarks: [] });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('real warning');
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('real error');
  });

  it('resets the cached promise after startup failure so callers can retry', async () => {
    const forVisionTasks = vi.fn()
      .mockRejectedValueOnce(new Error('network offline'))
      .mockResolvedValueOnce({ wasm: 'vision-fileset' });
    const recoveredLandmarker = { detectForVideo: vi.fn() };
    const faceLandmarkerModule = await loadFaceLandmarkerModule({
      forVisionTasks,
      createFromOptions: vi.fn().mockResolvedValue(recoveredLandmarker),
    });

    await expect(faceLandmarkerModule.getFaceLandmarker()).rejects.toThrow('network offline');
    const wrappedLandmarker = await faceLandmarkerModule.getFaceLandmarker();

    expect(wrappedLandmarker).not.toBe(recoveredLandmarker);
    expect(wrappedLandmarker.detectForVideo).toEqual(expect.any(Function));
    expect(forVisionTasks).toHaveBeenCalledTimes(2);
  });
});
