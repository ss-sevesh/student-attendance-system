'use client';

import React, { useEffect, useState } from 'react';
import type { ExtractionResult } from '../lib/id-card/types';

interface IdCardUploadProps {
  userEmail: string;
}

const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export function IdCardUpload({ userEmail }: IdCardUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractionResult | null>(null);

  // Clean up Object URL when previewUrl changes or component unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setErrorMessage(null);
    setResult(null);

    if (!file) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    // Client-side pre-validation
    if (file.size > MAX_BYTES) {
      setErrorMessage('The selected file exceeds the 10 MB limit. Please choose a smaller image.');
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSelectedFile(null);
      setPreviewUrl(null);
      event.target.value = '';
      return;
    }

    if (!SUPPORTED_TYPES.includes(file.type)) {
      setErrorMessage('Unsupported file format. Please upload a JPEG, PNG, or WebP image.');
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSelectedFile(null);
      setPreviewUrl(null);
      event.target.value = '';
      return;
    }

    // Revoke previous URL before creating new one
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleReset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setErrorMessage(null);
    setProgressMessage('');
    const input = document.getElementById('id-card-input') as HTMLInputElement | null;
    if (input) input.value = '';
  }

  async function handleExtract(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedFile || isExtracting) return;

    setIsExtracting(true);
    setErrorMessage(null);
    setResult(null);
    setProgressMessage('Uploading and reading ID card image…');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/id-card/extract', {
        method: 'POST',
        body: formData,
      });

      const data = (await response.json()) as ExtractionResult & {
        error?: { code: string; message: string };
      };

      if (!response.ok || data.status === 'failed' || data.status === 'unavailable') {
        const errorMsg =
          data.error?.message ||
          'Failed to extract details from the ID card. Please ensure the card is clear and try again.';
        setErrorMessage(errorMsg);
        if (data.source === 'id-card') setResult(data);
      } else {
        setResult(data);
      }
    } catch {
      setErrorMessage('A network error occurred while uploading. Please check your connection and try again.');
    } finally {
      setIsExtracting(false);
      setProgressMessage('');
    }
  }

  const knownFieldLabels: { key: keyof ExtractionResult['fields']; label: string }[] = [
    { key: 'name', label: 'Full Name' },
    { key: 'studentId', label: 'Student ID / Roll No' },
    { key: 'department', label: 'Department' },
    { key: 'program', label: 'Program / Course' },
    { key: 'birthDate', label: 'Date of Birth' },
    { key: 'year', label: 'Academic Year / Batch' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
  ];

  return (
    <div className="id-card-module">
      <section className="upload-section" aria-labelledby="upload-heading">
        <h2 id="upload-heading">Upload Student ID Card</h2>
        <p className="section-desc">
          Select a clear photo or scan of your student ID card. Extracted information is kept in memory
          for your review and is not saved to your profile yet.
        </p>

        <form onSubmit={handleExtract} className="upload-form">
          <div className="file-field">
            <label htmlFor="id-card-input" className="file-label">
              Choose ID card image (JPEG, PNG, or WebP, up to 10 MB)
            </label>
            <input
              id="id-card-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              disabled={isExtracting}
              aria-describedby="file-requirements"
            />
            <p id="file-requirements" className="form-help">
              Supported formats: JPEG, PNG, WebP. Maximum size: 10 MB.
            </p>
          </div>

          {selectedFile && previewUrl && (
            <div className="preview-container">
              <p className="preview-meta">
                <strong>Selected:</strong> {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
              <div className="preview-box">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Selected student ID card preview"
                  className="preview-image"
                />
              </div>
            </div>
          )}

          <div className="form-actions">
            <button
              type="submit"
              disabled={!selectedFile || isExtracting}
              className="extract-button"
            >
              {isExtracting ? (progressMessage || 'Processing…') : 'Extract Details'}
            </button>

            {selectedFile && (
              <button
                type="button"
                onClick={handleReset}
                disabled={isExtracting}
                className="reset-button"
              >
                Replace Image
              </button>
            )}
          </div>
        </form>

        {/* Live regions for status and errors */}
        <div role="status" aria-live="polite" className="sr-status">
          {progressMessage}
        </div>

        {errorMessage && (
          <div role="alert" className="form-error-banner">
            <strong>Error:</strong> {errorMessage}
          </div>
        )}
      </section>

      {/* Extraction Results */}
      {result && (
        <section className="results-section" aria-labelledby="results-heading">
          <h2 id="results-heading">Extraction Review</h2>

          <div className="memory-notice" role="note">
            <p>
              <strong>Temporary candidate data:</strong> These values were extracted in-memory by local OCR.
              Refreshing or leaving this page clears this data. No profile has been saved yet.
            </p>
          </div>

          {result.status === 'success' && (
            <>
              <div className="extracted-fields-card">
                <h3>Detected Candidate Fields</h3>
                <dl className="fields-grid">
                  {knownFieldLabels.map(({ key, label }) => {
                    const value = result.fields[key];
                    return (
                      <div key={key} className="field-row">
                        <dt className="field-name">{label}</dt>
                        <dd className="field-value">
                          {value ? (
                            <span className="value-detected">{value}</span>
                          ) : (
                            <span className="value-empty">(not detected)</span>
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </div>

              {result.additionalFields.length > 0 && (
                <div className="additional-fields-card">
                  <h3>Additional Detected Labels</h3>
                  <dl className="fields-grid">
                    {result.additionalFields.map((field, idx) => (
                      <div key={idx} className="field-row">
                        <dt className="field-name">{field.label}</dt>
                        <dd className="field-value">
                          <span className="value-detected">{field.value}</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              <div className="raw-text-card">
                <h3>Raw OCR Text (Untrusted source text)</h3>
                <p className="form-help">
                  Inspect the verbatim text read from your card to verify accuracy:
                </p>
                <pre className="raw-text-content">{result.rawText}</pre>
              </div>

              <div className="next-steps-card">
                <p className="form-help">
                  Signed in as <strong>{userEmail}</strong>. When the reviewed-profile module is ready,
                  you will be able to review, adjust, and confirm these details alongside your portal profile.
                </p>
                <button type="button" onClick={handleReset} className="reset-button">
                  Upload a different card
                </button>
              </div>
            </>
          )}

          {(result.status === 'failed' || result.status === 'unavailable') && (
            <div className="failed-card">
              <p>
                The image could not be processed. Please make sure the ID card is well-lit, in focus,
                and contains legible printed text.
              </p>
              <button type="button" onClick={handleReset} className="extract-button">
                Try Another Image
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
