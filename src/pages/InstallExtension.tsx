import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Download, ArrowLeft, CheckCircle2, ShieldCheck, Youtube } from "lucide-react";

const EXTENSION_ZIP = "/youtube-transcript-extension.zip";

const Step = ({
  n,
  title,
  children,
  image,
  imageAlt,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
  image?: string;
  imageAlt?: string;
}) => (
  <div className="flex gap-4">
    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
      {n}
    </div>
    <div className="flex-1 space-y-3 pb-2">
      <h3 className="text-lg font-semibold leading-snug">{title}</h3>
      <div className="text-muted-foreground space-y-2 text-[15px] leading-relaxed">{children}</div>
      {image && (
        <img
          src={image}
          alt={imageAlt}
          className="w-full max-w-xl rounded-xl border border-border shadow-sm"
          loading="lazy"
        />
      )}
    </div>
  </div>
);

const InstallExtension = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center p-4 py-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-2xl space-y-10">
        {/* Header */}
        <div className="space-y-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to PullTranscript
          </Link>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
              <Youtube className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Get YouTube Transcripts</h1>
              <p className="text-muted-foreground text-sm">A one-time, 2-minute setup. No tech skills needed.</p>
            </div>
          </div>
          <p className="text-[15px] text-muted-foreground leading-relaxed">
            YouTube doesn't let websites grab transcripts directly. So we made a tiny free helper
            (a "Chrome extension") that runs inside <em>your</em> browser and gets the transcript for you.
            Follow the steps below once — after that, YouTube links just work on PullTranscript.
          </p>
        </div>

        {/* Download button */}
        <div className="rounded-xl bg-card border border-primary/40 p-6 text-center space-y-4">
          <p className="font-medium">Start here — download the helper</p>
          <a href={EXTENSION_ZIP} download>
            <Button className="h-12 px-7 text-base bg-primary text-primary-foreground hover:bg-primary/90">
              <Download className="w-5 h-5 mr-2" />
              Download the Extension
            </Button>
          </a>
          <p className="text-xs text-muted-foreground">
            Saves a file called <span className="font-mono">youtube-transcript-extension.zip</span> (look in your Downloads folder).
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-8">
          <Step n={1} title="Download the file">
            <p>
              Click the big <strong>Download the Extension</strong> button above. Your browser saves a file
              named <span className="font-mono">youtube-transcript-extension.zip</span> — usually into your{" "}
              <strong>Downloads</strong> folder.
            </p>
          </Step>

          <Step
            n={2}
            title="Unzip it"
            image="/guide/step-unzip.svg"
            imageAlt="Double-click the zip file to turn it into a folder"
          >
            <p>
              The file is "zipped" (squished). You need to unzip it into a normal folder:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>On a Mac:</strong> double-click the file. A folder appears right next to it.</li>
              <li><strong>On Windows:</strong> right-click the file → <strong>Extract All…</strong> → <strong>Extract</strong>.</li>
            </ul>
            <p>
              You'll now have a <strong>folder</strong> named <span className="font-mono">youtube-transcript-extension</span>.
              Keep it somewhere you won't delete it — Chrome reads the extension from this folder.
            </p>
          </Step>

          <Step n={3} title="Open Chrome's extensions page">
            <p>
              Open the <strong>Google Chrome</strong> browser. Click the address bar at the very top, type the
              following, and press <strong>Enter</strong>:
            </p>
            <p className="font-mono bg-muted/60 rounded-md px-3 py-2 inline-block select-all">chrome://extensions</p>
            <p className="text-sm">
              (Same thing as clicking the <strong>⋮</strong> menu in the top-right → <strong>Extensions</strong> → <strong>Manage Extensions</strong>.)
            </p>
          </Step>

          <Step
            n={4}
            title='Turn on "Developer mode"'
            image="/guide/step-devmode.svg"
            imageAlt="Toggle the Developer mode switch in the top-right corner"
          >
            <p>
              Look at the <strong>top-right corner</strong> of that page. Flip the{" "}
              <strong>Developer mode</strong> switch <strong>ON</strong>. A new row of buttons appears.
            </p>
          </Step>

          <Step
            n={5}
            title='Click "Load unpacked" and choose the folder'
            image="/guide/step-load-unpacked.svg"
            imageAlt="Click Load unpacked, then select the unzipped folder"
          >
            <p>
              Click the new <strong>Load unpacked</strong> button. A window opens. Find and select the{" "}
              <strong>folder you unzipped in step 2</strong> (<span className="font-mono">youtube-transcript-extension</span>), then click{" "}
              <strong>Select</strong> (Mac) or <strong>Select Folder</strong> (Windows).
            </p>
            <p>The "YT Transcript Scraper" now shows up in your list. That's it — it's installed. 🎉</p>
          </Step>

          <Step n={6} title="Come back and transcribe">
            <p>
              Return to <Link to="/" className="text-primary underline underline-offset-2">PullTranscript</Link>,{" "}
              <strong>refresh the page</strong>, and paste a YouTube link. You'll see a green{" "}
              <span className="inline-flex items-center gap-1 align-middle">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> <span>YouTube extension connected</span>
              </span>{" "}
              message — and your transcript appears.
            </p>
          </Step>
        </div>

        {/* Reassurance */}
        <div className="rounded-xl bg-card border border-border p-5 flex gap-3">
          <ShieldCheck className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong className="text-foreground">Is this safe?</strong> Yes. The extension only reads YouTube
              transcripts and hands them to PullTranscript. It collects no personal data and sends nothing
              anywhere else.
            </p>
            <p>
              Chrome may pop up a small note about "Developer mode extensions" when it starts. That's normal for
              extensions installed this way — you can close it. And don't delete the unzipped folder, or you'll
              need to add it again.
            </p>
          </div>
        </div>

        <div className="text-center pb-6">
          <Link to="/">
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to PullTranscript
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default InstallExtension;
