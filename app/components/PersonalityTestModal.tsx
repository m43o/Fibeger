'use client';

import { useState, useEffect } from 'react';

interface Answer {
  text: string;
  weights: Record<string, number>;
}

interface Question {
  id: number;
  question: string;
  answers: Answer[];
}

interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  color: string;
}

interface TestData {
  title: string;
  description: string;
  questions: Question[];
  badges: Badge[];
}

interface PersonalityTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (badge: Badge) => void;
  themeColor?: string;
}

export default function PersonalityTestModal({
  isOpen,
  onClose,
  onComplete,
  themeColor = '#8B5CF6',
}: PersonalityTestModalProps) {
  const [testData, setTestData] = useState<TestData | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Badge | null>(null);
  const [error, setError] = useState('');

  // Fetch test data when modal opens
  useEffect(() => {
    if (isOpen && !testData) {
      fetchTestData();
    }
  }, [isOpen]);

  const fetchTestData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/personality-test');
      if (res.ok) {
        const data = await res.json();
        setTestData(data);
      } else {
        setError('Failed to load test');
      }
    } catch (err) {
      setError('Error loading test');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (answerIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answerIndex;
    setAnswers(newAnswers);

    // Automatically move to next question after selection
    setTimeout(() => {
      if (currentQuestion < (testData?.questions.length || 0) - 1) {
        setCurrentQuestion(currentQuestion + 1);
      }
    }, 300);
  };

  const handleSubmit = async () => {
    if (!testData || answers.length !== testData.questions.length) {
      setError('Please answer all questions');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/personality-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data.badge);
      } else {
        setError('Failed to submit test');
      }
    } catch (err) {
      setError('Error submitting test');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = () => {
    if (result) {
      onComplete(result);
      handleClose();
    }
  };

  const handleClose = () => {
    setCurrentQuestion(0);
    setAnswers([]);
    setResult(null);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div
        className="rounded-lg p-8 max-w-2xl w-full my-8"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        {loading ? (
          <div className="text-center py-12">
            <div
              className="inline-block animate-spin rounded-full h-12 w-12 border-4 mb-4"
              style={{
                borderColor: themeColor,
                borderTopColor: 'transparent',
              }}
            ></div>
            <p style={{ color: 'var(--text-secondary)' }}>Loading test...</p>
          </div>
        ) : result ? (
          // Results screen
          <div className="text-center">
            <h2
              className="text-3xl font-bold mb-4"
              style={{ color: 'var(--text-primary)' }}
            >
              Your Personality Type
            </h2>
            <div
              className="text-8xl mb-6"
              style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }}
            >
              {result.emoji}
            </div>
            <h3
              className="text-2xl font-bold mb-3"
              style={{ color: result.color }}
            >
              {result.name}
            </h3>
            <p
              className="text-lg mb-8"
              style={{ color: 'var(--text-secondary)' }}
            >
              {result.description}
            </p>
            <div className="flex gap-4">
              <button
                onClick={handleComplete}
                className="flex-1 px-6 py-3 text-white rounded-md font-medium transition"
                style={{ backgroundColor: result.color }}
              >
                Save to Profile
              </button>
              <button
                onClick={handleClose}
                className="px-6 py-3 text-white rounded-md font-medium"
                style={{ backgroundColor: 'var(--text-tertiary)' }}
              >
                Close
              </button>
            </div>
          </div>
        ) : testData ? (
          // Test questions
          <>
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2
                  className="text-2xl font-bold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {testData.title}
                </h2>
                <button
                  onClick={handleClose}
                  className="text-2xl"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  ✕
                </button>
              </div>
              <p
                className="text-sm mb-4"
                style={{ color: 'var(--text-secondary)' }}
              >
                {testData.description}
              </p>
              {/* Progress bar */}
              <div
                className="w-full h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: 'var(--bg-primary)' }}
              >
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    backgroundColor: themeColor,
                    width: `${((currentQuestion + 1) / testData.questions.length) * 100}%`,
                  }}
                ></div>
              </div>
              <p
                className="text-xs mt-2 text-right font-medium"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Question {currentQuestion + 1} of {testData.questions.length}
              </p>
            </div>

            {error && (
              <div
                className="mb-4 p-4 rounded-md"
                style={{ backgroundColor: 'var(--danger)', color: '#fff' }}
              >
                {error}
              </div>
            )}

            <div className="mb-6">
              <h3
                className="text-xl font-semibold mb-6"
                style={{ color: 'var(--text-primary)' }}
              >
                {testData.questions[currentQuestion].question}
              </h3>
              <div className="space-y-3">
                {testData.questions[currentQuestion].answers.map(
                  (answer, index) => (
                    <button
                      key={index}
                      onClick={() => handleAnswerSelect(index)}
                      className="w-full p-4 rounded-md text-left transition font-medium"
                      style={{
                        backgroundColor:
                          answers[currentQuestion] === index
                            ? `${themeColor}20`
                            : 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        border: answers[currentQuestion] === index
                          ? `2px solid ${themeColor}`
                          : '2px solid transparent',
                      }}
                    >
                      {answer.text}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                disabled={currentQuestion === 0}
                className="px-6 py-3 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                }}
              >
                Previous
              </button>
              {currentQuestion === testData.questions.length - 1 &&
              answers.length === testData.questions.length ? (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 px-6 py-3 text-white rounded-md font-medium disabled:opacity-50"
                  style={{ backgroundColor: themeColor }}
                >
                  {submitting ? 'Submitting...' : 'Get Results'}
                </button>
              ) : (
                <button
                  onClick={() =>
                    setCurrentQuestion(
                      Math.min(testData.questions.length - 1, currentQuestion + 1)
                    )
                  }
                  disabled={answers[currentQuestion] === undefined}
                  className="flex-1 px-6 py-3 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: themeColor }}
                >
                  Next
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p style={{ color: 'var(--text-secondary)' }}>
              Failed to load test. Please try again.
            </p>
            <button
              onClick={handleClose}
              className="mt-4 px-6 py-3 text-white rounded-md font-medium"
              style={{ backgroundColor: 'var(--danger)' }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
