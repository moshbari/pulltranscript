import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Copy, CheckCircle2, AlertCircle, Video } from "lucide-react";

interface Segment {
  start: number;
  end: number;
  text: string;
}

const formatTimestamp = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
};

const Index = () => {
  const [url, setUrl] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleTranscribe = async () => {
    if (!url.trim()) {
      setError("Please enter a Facebook or Instagram video URL");
      return;
    }

    setIsLoading(true);
    setError("");
    setSegments([]);

    try {
      const response = await fetch(
        "https://transcriber-production-f2f1.up.railway.app/transcribe",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: url.trim() }),
        }
      );

      const data = await response.json();

      if (data.success && data.segments) {
        setSegments(data.segments);
      } else {
        setError(data.message || "Failed to transcribe video");
      }
    } catch (err) {
      setError("Failed to connect to the transcription service");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    const transcriptText = segments.map(seg => `${formatTimestamp(seg.start)}    ${seg.text}`).join('\n');
    try {
      await navigator.clipboard.writeText(transcriptText);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Transcript copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen gradient-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-card border border-border mb-4">
            <Video className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Video Transcriber
          </h1>
          <p className="text-muted-foreground">
            Paste a Facebook or Instagram video URL to get the transcript
          </p>
        </div>

        {/* Input Section */}
        <div className="space-y-4">
          <div className="flex gap-3">
            <Input
              type="url"
              placeholder="https://www.instagram.com/reel/... or https://www.facebook.com/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 h-12 bg-card border-border font-mono text-sm placeholder:text-muted-foreground focus-visible:ring-primary"
              onKeyDown={(e) => e.key === "Enter" && handleTranscribe()}
            />
            <Button
              onClick={handleTranscribe}
              disabled={isLoading}
              className="h-12 px-6 bg-primary text-primary-foreground hover:bg-primary/90 glow-primary transition-all duration-300 hover:glow-primary-strong"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin-slow" />
              ) : (
                "Transcribe"
              )}
            </Button>
          </div>
        </div>

        {/* Results Section */}
        {(isLoading || segments.length > 0 || error) && (
          <div className="rounded-xl bg-card border border-border overflow-hidden">
            {/* Loading State */}
            {isLoading && (
              <div className="p-12 flex flex-col items-center justify-center space-y-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-2 border-muted" />
                  <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin-slow" />
                </div>
                <p className="text-muted-foreground text-sm animate-pulse-glow">
                  Transcribing video...
                </p>
              </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
              <div className="p-6 flex items-center gap-3 text-destructive">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Transcript */}
            {segments.length > 0 && !isLoading && (
              <>
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <span className="text-sm text-muted-foreground font-medium">
                    Transcript
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-8 px-3 text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2 text-primary" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <div className="p-6 max-h-96 overflow-y-auto">
                  <div className="space-y-1">
                    {segments.map((segment, index) => (
                      <div key={index} className="flex gap-4 text-sm leading-relaxed">
                        <span className="font-mono text-muted-foreground shrink-0">
                          {formatTimestamp(segment.start)}
                        </span>
                        <span className="text-foreground">{segment.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          Supports public Facebook & Instagram videos and reels
        </p>
      </div>
    </div>
  );
};

export default Index;
