import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Copy, CheckCircle2, AlertCircle, Video, Youtube, Instagram, Facebook, Twitter, ClipboardPaste, Chrome, ExternalLink } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
const API_BASE = "https://transcriber-production-f2f1.up.railway.app";
const YOUTUBE_SCRAPER_API = "https://youtube-scraper-backend-production.up.railway.app";

// "YT Transcript Scraper" Chrome extension. Once the listing is approved,
// replace this with the exact store URL (…/detail/<slug>/<id>). The search
// URL below is a working fallback so the install button is never broken.
const EXTENSION_STORE_URL = "https://chromewebstore.google.com/search/YT%20Transcript%20Scraper";

// postMessage protocol shared with the extension's bridge.js
const EXT_SOURCE = "yt-scraper-ext";
const APP_SOURCE = "pulltranscript-app";

interface Segment {
  start: number;
  end: number;
  text: string;
}

interface ExtSegment {
  timestamp: string;
  text: string;
}

// Ask the installed extension to scrape a YouTube transcript in the user's own
// browser tab (their residential IP + logged-in session), sidestepping the
// server-side IP blocks that make server-side YouTube scraping unreliable.
const fetchYouTubeViaExtension = (videoUrl: string): Promise<Segment[]> =>
  new Promise((resolve, reject) => {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("The extension timed out fetching this transcript."));
    }, 90000);

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const msg = event.data;
      if (!msg || msg.source !== EXT_SOURCE || msg.type !== "result") return;
      if (msg.requestId !== requestId) return;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      if (!msg.ok) {
        reject(new Error(msg.error || "The extension could not get this transcript."));
        return;
      }
      const extSegs: ExtSegment[] = Array.isArray(msg.segments) ? msg.segments : [];
      if (extSegs.length) {
        resolve(
          extSegs.map((s) => {
            const seconds = parseTimestampToSeconds(String(s.timestamp || "0"));
            return { start: seconds, end: seconds, text: (s.text || "").trim() };
          })
        );
        return;
      }
      // Fallback: parse the plain timestamped text the extension returns.
      const text: string = msg.text || "";
      const parsed = text
        .split("\n")
        .map((line) => line.match(/^([\d:]+)\s*-\s*(.*)$/))
        .filter((m): m is RegExpMatchArray => !!m)
        .map((m) => {
          const seconds = parseTimestampToSeconds(m[1].trim());
          return { start: seconds, end: seconds, text: m[2].trim() };
        });
      if (parsed.length) resolve(parsed);
      else reject(new Error("No transcript is available for this video."));
    };

    window.addEventListener("message", onMessage);
    window.postMessage({ source: APP_SOURCE, type: "scrape", requestId, url: videoUrl }, window.location.origin);
  });

const isYouTubeUrl = (url: string): boolean => {
  const lower = url.toLowerCase();
  return (
    lower.includes("youtube.com/watch") ||
    lower.includes("youtube.com/shorts/") ||
    lower.includes("youtu.be/") ||
    lower.includes("youtube.com/embed/")
  );
};

const parseTimestampToSeconds = (timestamp: string): number => {
  const parts = timestamp.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
};

const parseYouTubeScraperTranscript = (transcript: string): Segment[] => {
  return transcript.split("\n").filter(Boolean).map((line) => {
    const match = line.match(/^([\d:]+)\s*-\s*(.*)$/);
    if (!match) return { start: 0, end: 0, text: line.trim() };
    const seconds = parseTimestampToSeconds(match[1].trim());
    return { start: seconds, end: seconds, text: match[2].trim() };
  });
};

const fetchYouTubeTranscriptFromScraper = async (videoUrl: string): Promise<Segment[]> => {
  const response = await fetch(`${YOUTUBE_SCRAPER_API}/api/transcript`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: videoUrl }),
  });
  const data = await response.json();
  if (data.status === "success" && data.transcript) {
    return parseYouTubeScraperTranscript(data.transcript);
  }
  throw new Error(data.detail || "YouTube scraper failed");
};

const formatTimestamp = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
};

const Index = () => {
  const [url, setUrl] = useState("");
  const [transcribedUrl, setTranscribedUrl] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isServerOffline, setIsServerOffline] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [serverStatus, setServerStatus] = useState<"checking" | "online" | "offline">("checking");
  const [extensionReady, setExtensionReady] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        const response = await fetch(API_BASE, { method: "GET" });
        if (response.ok) {
          setServerStatus("online");
        } else {
          setServerStatus("offline");
        }
      } catch {
        setServerStatus("offline");
      }
    };
    checkServerHealth();
  }, []);

  // Detect the YT Transcript Scraper extension. Its bridge.js announces itself
  // on pulltranscript.com via postMessage — no extension ID needed here.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const msg = event.data;
      if (msg && msg.source === EXT_SOURCE && msg.type === "ready") {
        setExtensionReady(true);
        setShowInstallPrompt(false);
      }
    };
    window.addEventListener("message", onMessage);
    // Ping in case the extension loaded before this listener attached.
    window.postMessage({ source: APP_SOURCE, type: "ping" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const fetchOriginalTranscript = async (videoUrl: string) => {
    const response = await fetch(`${API_BASE}/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: videoUrl }),
    });
    const data = await response.json();
    if (data.success && data.segments) {
      return data.segments as Segment[];
    }
    throw new Error(data.error || data.message || "Failed to transcribe video");
  };

  const handleTranscribe = async () => {
    if (!url.trim()) {
      setError("Please enter a video URL");
      return;
    }

    setIsLoading(true);
    setError("");
    setIsServerOffline(false);
    setShowInstallPrompt(false);
    setSegments([]);

    const trimmedUrl = url.trim();

    try {
      let result: Segment[];

      if (isYouTubeUrl(trimmedUrl)) {
        // YouTube is only reliable through the user's own browser, so prefer
        // the extension. If it isn't installed, prompt to install it, then
        // fall back to the (less reliable) server scrapers as a best effort.
        if (extensionReady) {
          try {
            result = await fetchYouTubeViaExtension(trimmedUrl);
          } catch (extErr) {
            console.warn("Extension scrape failed, falling back to server:", extErr);
            try {
              result = await fetchYouTubeTranscriptFromScraper(trimmedUrl);
            } catch {
              result = await fetchOriginalTranscript(trimmedUrl);
            }
          }
        } else {
          setShowInstallPrompt(true);
          try {
            result = await fetchYouTubeTranscriptFromScraper(trimmedUrl);
          } catch (scraperErr) {
            console.warn("YouTube scraper failed, falling back to original method:", scraperErr);
            result = await fetchOriginalTranscript(trimmedUrl);
          }
        }
      } else {
        result = await fetchOriginalTranscript(trimmedUrl);
      }

      setSegments(result);
      setTranscribedUrl(trimmedUrl);
      setServerStatus("online");
    } catch (err) {
      if (err instanceof Error && err.message && !err.message.includes("Failed to fetch")) {
        setError(err.message);
      } else {
        setIsServerOffline(true);
        setServerStatus("offline");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    const transcriptText = `${transcribedUrl}\n\n` + segments.map(seg => `${formatTimestamp(seg.start)}    ${seg.text}`).join('\n');
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

  const handleCopyTextOnly = async () => {
    const textOnly = `${transcribedUrl}\n\n` + segments.map(seg => seg.text).join('\n');
    try {
      await navigator.clipboard.writeText(textOnly);
      setCopiedText(true);
      toast({
        title: "Copied!",
        description: "Text copied without timestamps",
      });
      setTimeout(() => setCopiedText(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center pt-16 md:pt-4 md:justify-center p-4 relative">
      {/* Top Right Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            serverStatus === "checking" ? "bg-yellow-500 animate-pulse" :
            serverStatus === "online" ? "bg-green-500" : "bg-red-500"
          }`} />
          <span className="text-xs text-muted-foreground">
            {serverStatus === "checking" ? "Checking..." :
             serverStatus === "online" ? "Online" : "Offline"}
          </span>
        </div>
        <ThemeToggle />
      </div>

      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-card border border-border mb-4">
            <Video className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            PullTranscript
          </h1>
          <p className="text-muted-foreground">
            Any Video. Any Platform. Instant Text.
          </p>
        </div>

        {/* Input Section */}
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Input
                type="url"
                placeholder="https://www.instagram.com/reel/... or https://www.facebook.com/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-12 pr-20 bg-card border-border font-mono text-sm placeholder:text-muted-foreground focus-visible:ring-primary"
                onKeyDown={(e) => e.key === "Enter" && handleTranscribe()}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button
                  type="button"
                  disabled={!url}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(url);
                      toast({
                        title: "Copied!",
                        description: "URL copied to clipboard",
                      });
                    } catch {
                      toast({
                        title: "Failed to copy",
                        description: "Please try again",
                        variant: "destructive",
                      });
                    }
                  }}
                  className={`transition-colors ${url ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/30 cursor-not-allowed'}`}
                  title="Copy URL"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      setUrl(text);
                    } catch {
                      toast({
                        title: "Unable to paste",
                        description: "Please allow clipboard access or paste manually",
                        variant: "destructive",
                      });
                    }
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Paste from clipboard"
                >
                  <ClipboardPaste className="w-4 h-4" />
                </button>
              </div>
            </div>
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

        {/* Supported Platforms */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-4">
            <Youtube className="w-5 h-5 text-muted-foreground" />
            <Instagram className="w-5 h-5 text-muted-foreground" />
            <svg className="w-5 h-5 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
            </svg>
            <Facebook className="w-5 h-5 text-muted-foreground" />
            <Twitter className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">
            Works with YouTube, Instagram, TikTok, Facebook, Twitter/X and 1000+ more sites
          </p>
        </div>

        {/* Install Extension Prompt (YouTube needs the extension to be reliable) */}
        {showInstallPrompt && !extensionReady && (
          <div className="rounded-xl bg-card border border-primary/40 p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 flex-shrink-0">
                <Youtube className="w-5 h-5 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">Install the free browser extension for YouTube</p>
                <p className="text-sm text-muted-foreground">
                  YouTube blocks transcripts pulled from servers. Our extension grabs them straight from
                  your own browser — so YouTube transcripts work every time. Install it, refresh this page,
                  then hit Transcribe again.
                </p>
              </div>
            </div>
            <a href={EXTENSION_STORE_URL} target="_blank" rel="noopener noreferrer">
              <Button className="h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90">
                <Chrome className="w-4 h-4 mr-2" />
                Add to Chrome
                <ExternalLink className="w-3.5 h-3.5 ml-2 opacity-70" />
              </Button>
            </a>
          </div>
        )}

        {/* Extension connected indicator */}
        {extensionReady && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            <span>YouTube extension connected</span>
          </div>
        )}

        {/* Results Section */}
        {(isLoading || segments.length > 0 || error || isServerOffline) && (
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

            {/* Server Offline State */}
            {isServerOffline && !isLoading && (
              <div className="p-6 bg-red-950/30 border-b border-red-900/50">
                <div className="flex items-start gap-3 text-red-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">⚠️ Server Offline</p>
                    <p className="text-sm text-red-400/80 mt-1">
                      The transcription server is not responding. This may be due to Railway usage limits. Check your Railway dashboard.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error State */}
            {error && !isLoading && !isServerOffline && (
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
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyTextOnly}
                      className="h-8 px-3 text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      {copiedText ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2 text-primary" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy Text Only
                        </>
                      )}
                    </Button>
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
                </div>
                <div className="p-6 max-h-96 overflow-y-auto">
                  {transcribedUrl && (
                    <div className="mb-4 pb-3 border-b border-border">
                      <span className="font-mono text-sm text-primary break-all">{transcribedUrl}</span>
                    </div>
                  )}
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

      </div>
    </div>
  );
};

export default Index;
