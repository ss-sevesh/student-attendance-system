'use client';

import React, { useEffect, useState } from 'react';
import type { IdCardReviewResult } from '../lib/id-card/types';

interface IdCardUploadProps {
  userEmail: string;
}

const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
type ReviewValues = { name: string; rollNumber: string; birthDate: string; residentialAddress: string; phone: string };
const emptyReview: ReviewValues = { name: '', rollNumber: '', birthDate: '', residentialAddress: '', phone: '' };

export function IdCardUpload({ userEmail }: IdCardUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<IdCardReviewResult | null>(null);
  const [review, setReview] = useState<ReviewValues>(emptyReview);

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
    setReview(emptyReview);

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
    setReview(emptyReview);
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

      const data = (await response.json()) as IdCardReviewResult & {
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
        setReview({
          name: '',
          rollNumber: '',
          birthDate: data.fields.birthDate,
          residentialAddress: data.fields.residentialAddress,
          phone: data.fields.phone,
        });
      }
    } catch {
      setErrorMessage('A network error occurred while uploading. Please check your connection and try again.');
    } finally {
      setIsExtracting(false);
      setProgressMessage('');
    }
  }

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
              <strong>Temporary review:</strong> Check the three suggested values and enter your name and roll number.
              Refreshing or leaving this page clears this data. No profile has been saved yet.
            </p>
          </div>

          {result.status === 'success' && (
            <>
              <div className="extracted-fields-card">
                <h3>Review ID details</h3>
                <div className="review-fields">
                  <label htmlFor="review-name">Name (enter manually)</label>
                  <input id="review-name" value={review.name} onChange={(event) => setReview({ ...review, name: event.target.value })} autoComplete="name" />
                  <label htmlFor="review-roll">Roll number (enter manually)</label>
                  <input id="review-roll" value={review.rollNumber} onChange={(event) => setReview({ ...review, rollNumber: event.target.value })} />
                  <label htmlFor="review-dob">Date of birth</label>
                  <input id="review-dob" value={review.birthDate} onChange={(event) => setReview({ ...review, birthDate: event.target.value })} placeholder="DD.MM.YYYY" />
                  <label htmlFor="review-address">Residential address</label>
                  <textarea id="review-address" rows={4} value={review.residentialAddress} onChange={(event) => setReview({ ...review, residentialAddress: event.target.value })} />
                  <label htmlFor="review-phone">Phone</label>
                  <input id="review-phone" type="tel" inputMode="tel" value={review.phone} onChange={(event) => setReview({ ...review, phone: event.target.value })} />
                </div>
              </div>

              <div className="next-steps-card">
                <p className="form-help">
                  Signed in as <strong>{userEmail}</strong>. These reviewed values stay on this page only and are not saved yet.
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
