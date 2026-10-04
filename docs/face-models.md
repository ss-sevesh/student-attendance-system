# Face model setup for the local attendance demo

The browser loads face-api.js and three models from `/face-api/` on the same app origin. It does not request jsDelivr during enrollment or check-in. The files were downloaded into this workspace on 2026-10-04. Run setup again if they are absent on another checkout; until installed, enrollment and check-in display a setup error.

From the project root, on a machine that can reach jsDelivr, run:

```powershell
npm.cmd run setup:face-models
```

The script downloads version **0.22.2** of `face-api.min.js` from [`face-api.js` on npm](https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js), plus these versioned manifests and their listed shard files from the [upstream weights directory](https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights/):

- `tiny_face_detector_model-weights_manifest.json` and its shard
- `face_landmark_68_model-weights_manifest.json` and its shard
- `face_recognition_model-weights_manifest.json` and its shards

The script writes `public/face-api/face-api.min.js` and `public/face-api/weights/*`. If a checkout cannot download them, run the command on an internet-connected copy and copy that directory back. The real-model browser test is `npm.cmd run test:e2e -- --project=chromium tests/e2e/attendance-real-model.spec.ts`; it uses the attributed [photographic fixture](../tests/fixtures/README.md) and a blank image. On 2026-10-04, the script, all manifests, and all shards returned HTTP 200 in the browser, with no console warnings or errors. The blank was rejected, the portrait enrolled with a finite 128-number descriptor, and a controlled video stream of that portrait matched. A live person, physical card, and hardware camera check-in remain unverified.

The upstream [face-api.js project](https://github.com/justadudewhohacks/face-api.js) is MIT licensed. Review its license and model provenance before distributing the downloaded assets. This local demo has no liveness detection and browser-generated face descriptors can be replayed; it must not be used for real attendance decisions.
