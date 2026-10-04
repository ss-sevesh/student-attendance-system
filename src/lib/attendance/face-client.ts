type FaceResult = { descriptor: Float32Array };
type FaceApi = {
  nets: {
    tinyFaceDetector: { loadFromUri(uri: string): Promise<void> };
    faceLandmark68Net: { loadFromUri(uri: string): Promise<void> };
    faceRecognitionNet: { loadFromUri(uri: string): Promise<void> };
  };
  TinyFaceDetectorOptions: new () => object;
  detectAllFaces(input: HTMLImageElement | HTMLVideoElement, options: object): {
    withFaceLandmarks(): { withFaceDescriptors(): Promise<FaceResult[]> };
  };
};

declare global { interface Window { faceapi?: FaceApi } }

const scriptUrl = '/face-api/face-api.min.js';
const modelUrl = '/face-api/weights';
let modelsPromise: Promise<FaceApi> | null = null;

export function loadFaceModels(): Promise<FaceApi> {
  if (!modelsPromise) modelsPromise = (async () => {
    if (!window.faceapi) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = scriptUrl;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Face models are not installed on this server. Run npm run setup:face-models.'));
        document.head.appendChild(script);
      });
    }
    const api = window.faceapi;
    if (!api) throw new Error('Face matching is unavailable in this browser.');
    await Promise.all([
      api.nets.tinyFaceDetector.loadFromUri(modelUrl),
      api.nets.faceLandmark68Net.loadFromUri(modelUrl),
      api.nets.faceRecognitionNet.loadFromUri(modelUrl),
    ]).catch(() => { throw new Error('Face model weights could not load. Run npm run setup:face-models and refresh.'); });
    return api;
  })().catch((error) => { modelsPromise = null; throw error; });
  return modelsPromise;
}

export async function describeFace(input: HTMLImageElement | HTMLVideoElement): Promise<number[]> {
  const api = await loadFaceModels();
  const faces = await api.detectAllFaces(input, new api.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();
  if (faces.length !== 1) throw new Error(faces.length === 0 ? 'No face found. Use a clearer photo or camera view.' : 'More than one face found. Show only your face.');
  return Array.from(faces[0].descriptor);
}
