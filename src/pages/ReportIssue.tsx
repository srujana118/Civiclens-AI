import { useState, useRef, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send,
  ImagePlus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Tag,
  Zap,
  Globe,
  FileText,
  AlertTriangle,
  Hash,
  MapPin,
  Mic,
} from 'lucide-react';
import { supabase, REPORT_CATEGORIES, LANGUAGES, type ReportAnalysis } from '@/lib/supabase';
import { useVoiceInput } from '@/lib/useVoiceInput';
import PageHeader from '@/components/PageHeader';

const urgencyStyles: Record<string, string> = {
  Low: 'bg-green-50 text-green-700',
  Medium: 'bg-yellow-50 text-yellow-700',
  High: 'bg-orange-50 text-orange-700',
  Critical: 'bg-red-50 text-red-700',
};

export default function ReportIssue() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [language, setLanguage] = useState('en');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ReportAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'success' | 'denied' | 'error'>('idle');

  const { listening, detectedLang, error: voiceError, start, stop } = useVoiceInput(
    language,
    (result) => {
      setDescription(result.transcript);
    },
  );

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('error');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setGeoStatus('success');
        setGeoLoading(false);
      },
      () => {
        setGeoStatus('denied');
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError(null);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!description.trim() || !category || !location.trim()) {
      setError('Please fill in the description, category, and location.');
      return;
    }

    setSubmitting(true);

    try {
      let imageUrl: string | null = null;

      if (imageFile) {
        const ext = imageFile.name.split('.').pop();
        const fileName = `report-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('report-images')
          .upload(fileName, imageFile);

        if (uploadError) {
          imageUrl = null;
        } else {
          const { data: urlData } = supabase.storage
            .from('report-images')
            .getPublicUrl(fileName);
          imageUrl = urlData.publicUrl;
        }
      }

      const { data: insertData, error: insertError } = await supabase
        .from('civic_reports')
        .insert({
          description: description.trim(),
          category,
          location: location.trim(),
          latitude: coords?.lat ?? null,
          longitude: coords?.lng ?? null,
          image_url: imageUrl,
          language,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Show success immediately — the report is saved.
      setSuccess(true);
      setAnalyzing(true);

      // Fire Gemini analysis in the background. Do NOT await this.
      if (insertData?.id) {
        const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-report`;
        fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            description: description.trim(),
            reportId: insertData.id,
          }),
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.analysis) {
              setAnalysis(data.analysis as ReportAnalysis);
              setAnalysisError(false);
            } else {
              setAnalysisError(true);
            }
          })
          .catch(() => {
            setAnalysisError(true);
          })
          .finally(() => {
            setAnalyzing(false);
          });
      }
    } catch {
      setError('Something went wrong submitting your report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div>
        <PageHeader title="Report an Issue" subtitle="Help your community by reporting what you see." />
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="card animate-fade-in flex flex-col items-center p-8 text-center sm:p-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="mt-6 text-2xl font-semibold text-[#1e1e1e]">
              Report Submitted Successfully
            </h2>
            <p className="mt-3 text-base text-[#6b6b6b]">
              Your report has been received.
              <br />
              AI analysis is processing in the background.
            </p>
          </div>

          {/* AI Analysis section */}
          {analyzing ? (
            <div className="card mt-6 animate-fade-in flex flex-col items-center p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1e40af]/5">
                <Loader2 className="h-6 w-6 animate-spin text-[#1e40af]" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[#1e1e1e]">
                AI Analysis in Progress
              </h3>
              <p className="mt-2 text-sm text-[#6b6b6b]">
                Gemini is analyzing your report in the background. You can continue
                using the app — results will appear on the dashboard shortly.
              </p>
              <button
                onClick={() => navigate('/intelligence')}
                className="btn-primary mt-5"
              >
                View on Dashboard
              </button>
            </div>
          ) : analysis ? (
            <div className="card mt-6 animate-fade-in overflow-hidden">
              <div className="flex items-center gap-2.5 border-b border-[#e5e5e5] bg-[#1e40af]/5 px-6 py-4">
                <Sparkles className="h-5 w-5 text-[#1e40af]" />
                <h3 className="text-base font-semibold text-[#1e1e1e]">
                  AI Analysis
                </h3>
                <span className="ml-auto text-xs font-medium text-[#6b6b6b]">
                  Powered by Gemini
                </span>
              </div>
              <div className="space-y-5 p-6">
                {/* Summary */}
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-[#6b6b6b]">
                    <FileText className="h-4 w-4 text-[#1e40af]" />
                    Summary
                  </div>
                  <p className="mt-1.5 text-sm text-[#1e1e1e]">{analysis.summary}</p>
                </div>

                {/* Category + Issue Type */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-[#6b6b6b]">
                      <Tag className="h-4 w-4 text-[#1e40af]" />
                      AI Category
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-[#1e1e1e]">
                      {analysis.category}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-[#6b6b6b]">
                      <Tag className="h-4 w-4 text-[#1e40af]" />
                      Issue Type
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-[#1e1e1e]">
                      {analysis.issueType}
                    </p>
                  </div>
                </div>

                {/* Urgency + Impact */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-[#6b6b6b]">
                      <Zap className="h-4 w-4 text-[#1e40af]" />
                      Urgency
                    </div>
                    <span
                      className={`mt-1.5 inline-flex items-center rounded-md px-2.5 py-1 text-sm font-medium ${
                        urgencyStyles[analysis.urgency] ?? 'bg-gray-50 text-gray-700'
                      }`}
                    >
                      {analysis.urgency}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-[#6b6b6b]">
                      <AlertTriangle className="h-4 w-4 text-[#1e40af]" />
                      Impact
                    </div>
                    <p className="mt-1.5 text-sm text-[#1e1e1e]">{analysis.impact}</p>
                  </div>
                </div>

                {/* Keywords */}
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-[#6b6b6b]">
                    <Hash className="h-4 w-4 text-[#1e40af]" />
                    Keywords
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {analysis.keywords.map((keyword, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center rounded-full bg-[#1e40af]/5 px-3 py-1 text-xs font-medium text-[#1e40af]"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="border-t border-[#e5e5e5] px-6 py-4">
                <button
                  onClick={() => navigate('/intelligence')}
                  className="btn-primary w-full"
                >
                  View on Dashboard
                </button>
              </div>
            </div>
          ) : analysisError ? (
            <div className="card mt-6 animate-fade-in flex flex-col items-center p-6 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-50">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-[#1e1e1e]">
                AI Analysis Still Processing
              </h3>
              <p className="mt-2 max-w-sm text-sm text-[#6b6b6b]">
                Your report was submitted successfully. The AI analysis is still
                processing and will appear on the dashboard shortly.
              </p>
              <button
                onClick={() => navigate('/intelligence')}
                className="btn-secondary mt-5"
              >
                Continue to Dashboard
              </button>
            </div>
          ) : (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => navigate('/intelligence')}
                className="btn-primary"
              >
                View on Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Report an Issue" subtitle="Help your community by reporting what you see." />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        <form onSubmit={handleSubmit} className="card animate-fade-in space-y-6 p-6 sm:p-8">
          {/* Description */}
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="description" className="label-text">
                Issue Description <span className="text-[#1e40af]">*</span>
              </label>
              <button
                type="button"
                onClick={listening ? stop : start}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  listening
                    ? 'bg-red-50 text-red-600 ring-1 ring-red-200'
                    : 'bg-[#1e40af]/5 text-[#1e40af] hover:bg-[#1e40af]/10'
                }`}
              >
                {listening ? (
                  <>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                    </span>
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Mic className="h-3.5 w-3.5" />
                    Voice Input
                  </>
                )}
              </button>
            </div>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="input-field resize-none"
              placeholder="Describe the issue you encountered, or use voice input to speak..."
              required
            />
            <div className="mt-2 flex flex-col gap-1.5">
              {listening && detectedLang && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-[#1e40af]">
                  <Mic className="h-3 w-3 animate-pulse" />
                  Listening in {detectedLang}...
                </p>
              )}
              {!listening && detectedLang && (
                <p className="flex items-center gap-1.5 text-xs text-green-600">
                  <Mic className="h-3 w-3" />
                  Detected language: {detectedLang}
                </p>
              )}
              {voiceError && (
                <p className="flex items-center gap-1.5 text-xs text-red-500">
                  <AlertCircle className="h-3 w-3" />
                  {voiceError}
                </p>
              )}
              <p className="flex items-center gap-1.5 text-xs text-[#9b9b9b]">
                <Sparkles className="h-3 w-3 text-[#1e40af]" />
                Your description will be analyzed by AI to extract structured insights
              </p>
            </div>
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="label-text">
              Category <span className="text-[#1e40af]">*</span>
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-field cursor-pointer"
              required
            >
              <option value="" disabled>
                Select a category
              </option>
              {REPORT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div>
            <label htmlFor="location" className="label-text">
              Location <span className="text-[#1e40af]">*</span>
            </label>
            <input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="input-field"
              placeholder="e.g. 123 Main St, Downtown, or nearest intersection"
              required
            />
            <div className="mt-2">
              {geoStatus === 'success' && coords ? (
                <p className="flex items-center gap-1.5 text-xs text-green-600">
                  <MapPin className="h-3 w-3" />
                  GPS coordinates captured ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}) — helps hotspot detection
                </p>
              ) : geoStatus === 'denied' ? (
                <p className="flex items-center gap-1.5 text-xs text-[#9b9b9b]">
                  <MapPin className="h-3 w-3" />
                  Location access denied — reports will be grouped by text location instead
                </p>
              ) : (
                <button
                  type="button"
                  onClick={detectLocation}
                  disabled={geoLoading}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#1e40af] hover:underline disabled:opacity-50"
                >
                  {geoLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <MapPin className="h-3 w-3" />
                  )}
                  Share my GPS location for better hotspot detection
                </button>
              )}
            </div>
          </div>

          {/* Image */}
          <div>
            <span className="label-text">Image (optional)</span>
            {imagePreview ? (
              <div className="relative rounded-lg border border-[#e5e5e5] overflow-hidden">
                <img src={imagePreview} alt="Report preview" className="h-48 w-full object-cover" />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute top-2 right-2 rounded-md bg-white/90 px-3 py-1 text-xs font-medium text-[#1e1e1e] shadow-sm hover:bg-white"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-[#c5c5c5] bg-[#faf9f7] px-4 py-8 text-sm text-[#6b6b6b] transition-colors hover:border-[#1e40af] hover:text-[#1e40af]"
              >
                <ImagePlus className="h-6 w-6" />
                Click to upload an image
                <span className="text-xs text-[#9b9b9b]">PNG or JPG, up to 5MB</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleImageChange}
              className="hidden"
            />
          </div>

          {/* Language */}
          <div>
            <label htmlFor="language" className="label-text">
              <Globe className="mr-1 inline h-3.5 w-3.5 text-[#1e40af]" />
              Language
            </label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="input-field cursor-pointer"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {analyzing ? 'Analyzing with AI...' : 'Submitting...'}
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Submit Report
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
