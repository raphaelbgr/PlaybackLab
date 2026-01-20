/**
 * ErrorDisplay Component - Plain-language error explanations
 * SOLID: Single Responsibility - Error display and explanation only
 */

import { useState } from 'react';
import { getErrorExplanation, searchErrors, type ErrorExplanation } from '../../../shared/utils/errorExplanations';
import { safeUpperCase } from '../../../shared/utils/stringUtils';

interface Props {
  error?: string | null;
  showSearch?: boolean;
}

export function ErrorDisplay({ error, showSearch = false }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedError, setSelectedError] = useState<ErrorExplanation | null>(null);

  // Get explanation for current error
  const explanation = error ? getErrorExplanation(error) : null;

  // Search results
  const searchResults = searchQuery.length >= 2 ? searchErrors(searchQuery) : [];

  // Get severity color
  const getSeverityColor = (severity: ErrorExplanation['severity']) => {
    switch (severity) {
      case 'info':
        return 'severity-info';
      case 'warning':
        return 'severity-warning';
      case 'error':
        return 'severity-error';
      case 'critical':
        return 'severity-critical';
      default:
        return '';
    }
  };

  // Get category icon
  const getCategoryIcon = (category: ErrorExplanation['category']) => {
    switch (category) {
      case 'network':
        return '🌐';
      case 'drm':
        return '🔐';
      case 'manifest':
        return '📋';
      case 'playback':
        return '▶️';
      case 'codec':
        return '🎬';
      default:
        return '❓';
    }
  };

  // Render error explanation card
  const renderExplanation = (exp: ErrorExplanation) => (
    <div className={`error-explanation ${getSeverityColor(exp.severity)}`}>
      <div className="error-header">
        <span className="error-icon">{getCategoryIcon(exp.category)}</span>
        <div className="error-title-section">
          <h3 className="error-title">{exp.title}</h3>
          <span className={`error-severity ${getSeverityColor(exp.severity)}`}>
            {safeUpperCase(exp.severity)}
          </span>
        </div>
      </div>

      <p className="error-description">{exp.description}</p>

      <div className="error-details">
        <div className="error-section">
          <h4>Possible Causes</h4>
          <ul className="cause-list">
            {exp.possibleCauses.map((cause, i) => (
              <li key={i}>{cause}</li>
            ))}
          </ul>
        </div>

        <div className="error-section">
          <h4>Suggested Fixes</h4>
          <ul className="fix-list">
            {exp.suggestedFixes.map((fix, i) => (
              <li key={i}>{fix}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="error-footer">
        <span className="error-code">Code: {exp.code}</span>
        <span className="error-category">Category: {exp.category}</span>
      </div>
    </div>
  );

  return (
    <div className="error-display">
      {/* Current Error */}
      {error && explanation && (
        <div className="current-error">
          <h2>Current Error</h2>
          {renderExplanation(explanation)}
        </div>
      )}

      {error && !explanation && (
        <div className="current-error">
          <h2>Current Error</h2>
          <div className="error-explanation severity-warning">
            <div className="error-header">
              <span className="error-icon">❓</span>
              <div className="error-title-section">
                <h3 className="error-title">Unknown Error</h3>
                <span className="error-severity severity-warning">UNKNOWN</span>
              </div>
            </div>
            <p className="error-description">
              We don't have a specific explanation for this error code.
            </p>
            <div className="error-raw">
              <code>{error}</code>
            </div>
            <div className="error-section">
              <h4>General Suggestions</h4>
              <ul className="fix-list">
                <li>Try refreshing the page</li>
                <li>Check your internet connection</li>
                <li>Try a different browser</li>
                <li>Clear browser cache and cookies</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Error Search */}
      {showSearch && (
        <div className="error-search">
          <h2>Error Reference</h2>
          <input
            type="text"
            className="search-input"
            placeholder="Search for error codes or descriptions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {searchResults.length > 0 && (
            <div className="search-results">
              <h3>Search Results ({searchResults.length})</h3>
              <div className="result-list">
                {searchResults.slice(0, 10).map((result) => (
                  <div
                    key={result.code}
                    className={`result-item ${selectedError?.code === result.code ? 'selected' : ''}`}
                    onClick={() => setSelectedError(result)}
                  >
                    <span className="result-icon">{getCategoryIcon(result.category)}</span>
                    <div className="result-info">
                      <span className="result-code">{result.code}</span>
                      <span className="result-title">{result.title}</span>
                    </div>
                    <span className={`result-severity ${getSeverityColor(result.severity)}`}>
                      {result.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedError && (
            <div className="selected-error">
              <h3>Error Details</h3>
              {renderExplanation(selectedError)}
            </div>
          )}

          {searchQuery.length >= 2 && searchResults.length === 0 && (
            <div className="no-results">
              <p>No errors found matching "{searchQuery}"</p>
            </div>
          )}
        </div>
      )}

      {/* Quick Reference */}
      {!error && !showSearch && (
        <div className="error-quick-ref">
          <h2>Common Errors Quick Reference</h2>
          <div className="quick-ref-grid">
            <div className="quick-ref-item" onClick={() => setSelectedError(getErrorExplanation('403'))}>
              <span className="quick-icon">🚫</span>
              <span className="quick-title">403 Forbidden</span>
              <span className="quick-desc">Access denied / Token expired</span>
            </div>
            <div className="quick-ref-item" onClick={() => setSelectedError(getErrorExplanation('404'))}>
              <span className="quick-icon">🔍</span>
              <span className="quick-title">404 Not Found</span>
              <span className="quick-desc">Content missing or removed</span>
            </div>
            <div className="quick-ref-item" onClick={() => setSelectedError(getErrorExplanation('DRM_NOT_SUPPORTED'))}>
              <span className="quick-icon">🔐</span>
              <span className="quick-title">DRM Error</span>
              <span className="quick-desc">License or decryption issue</span>
            </div>
            <div className="quick-ref-item" onClick={() => setSelectedError(getErrorExplanation('BUFFER_STALLED'))}>
              <span className="quick-icon">⏳</span>
              <span className="quick-title">Buffering</span>
              <span className="quick-desc">Network too slow</span>
            </div>
            <div className="quick-ref-item" onClick={() => setSelectedError(getErrorExplanation('CODEC_NOT_SUPPORTED'))}>
              <span className="quick-icon">🎬</span>
              <span className="quick-title">Codec Error</span>
              <span className="quick-desc">Unsupported video format</span>
            </div>
            <div className="quick-ref-item" onClick={() => setSelectedError(getErrorExplanation('503'))}>
              <span className="quick-icon">🔧</span>
              <span className="quick-title">503 Unavailable</span>
              <span className="quick-desc">Server overloaded</span>
            </div>
          </div>

          {selectedError && (
            <div className="selected-error">
              {renderExplanation(selectedError)}
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedError(null)}
              >
                Close
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
