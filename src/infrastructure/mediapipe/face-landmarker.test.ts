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
    vi.doUnmock('@mediapipe/tasks-vision');
    vi.resetModules();
  });

  it('creates and caches a GPU face landmarker instance', async () => {
    const landmarker = { detectForVideo: vi.fn() };
    const faceLandmarkerModule = await loadFaceLandmarkerModule({
      createFromOptions: vi.fn().mockResolvedValue(landmarker),
    });

    await expect(faceLandmarkerModule.getFaceLandmarker()).resolves.toBe(landmarker);
    await expect(faceLandmarkerModule.getFaceLandmarker()).resolves.toBe(landmarker);

    expect(faceLandmarkerModule.forVisionTasks).toHaveBeenCalledOnce();
    expect(faceLandmarkerModule.createFromOptions).toHaveBeenCalledOnce();
    expect(faceLandmarkerModule.createFromOptions).toHaveBeenCalledWith(
      { wasm: 'vision-fileset' },
      expect.objectContaining({
        baseOptions: expect.objectContaining({ delegate: 'GPU' }),
        runningMode: 'VIDEO',
        numFaces: 1,
      }),
    );
  });

  it('falls back to CPU options when GPU creation fails', async () => {
    const cpuLandmarker = { detectForVideo: vi.fn() };
    const createFromOptions = vi.fn()
      .mockRejectedValueOnce(new Error('GPU unavailable'))
      .mockResolvedValueOnce(cpuLandmarker);
    const faceLandmarkerModule = await loadFaceLandmarkerModule({ createFromOptions });

    await expect(faceLandmarkerModule.getFaceLandmarker()).resolves.toBe(cpuLandmarker);

    expect(createFromOptions).toHaveBeenCalledTimes(2);
    expect(createFromOptions).toHaveBeenNthCalledWith(
      2,
      { wasm: 'vision-fileset' },
      expect.objectContaining({
        baseOptions: expect.not.objectContaining({ delegate: 'GPU' }),
      }),
    );
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
    await expect(faceLandmarkerModule.getFaceLandmarker()).resolves.toBe(recoveredLandmarker);

    expect(forVisionTasks).toHaveBeenCalledTimes(2);
  });
});
