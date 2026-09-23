import { useEffect, useState } from "react";
import { Check, Copy, Download, Printer, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { buildQuickBookingUrl, generateQuickBookingQrDataUrl, sanitizeForFilename } from "@/lib/quickBookingQr";

// Big enough to fill the card nicely and stay easily scannable on screen.
const DISPLAY_SIZE_PX = 240;
// High enough resolution for a crisp A4 print without an oversized download.
const DOWNLOAD_SIZE_PX = 1024;

interface QuickBookingQrCardProps {
  salonName: string;
  quickBookingCode: string;
}

export function QuickBookingQrCard({ salonName, quickBookingCode }: QuickBookingQrCardProps) {
  const [displayQr, setDisplayQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const bookingUrl = buildQuickBookingUrl(quickBookingCode);

  useEffect(() => {
    let cancelled = false;
    setDisplayQr(null);
    generateQuickBookingQrDataUrl(bookingUrl, DISPLAY_SIZE_PX).then((dataUrl) => {
      if (!cancelled) setDisplayQr(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [bookingUrl]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      toast.success("Booking link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  const handleDownload = async () => {
    try {
      const highResQr = await generateQuickBookingQrDataUrl(bookingUrl, DOWNLOAD_SIZE_PX);
      const link = document.createElement("a");
      link.href = highResQr;
      link.download = `snippr-quick-booking-${sanitizeForFilename(salonName)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      toast.error("Couldn't generate the QR download");
    }
  };

  const handlePrint = async () => {
    try {
      const printQr = await generateQuickBookingQrDataUrl(bookingUrl, DOWNLOAD_SIZE_PX);
      const printWindow = window.open("", "_blank", "width=480,height=640");
      if (!printWindow) {
        toast.error("Please allow pop-ups to print the QR code");
        return;
      }

      const safeSalonName = salonName.replace(/[<>&]/g, "");
      printWindow.document.write(`<!doctype html>
<html>
<head>
<title>Snippr Quick Booking QR</title>
<style>
  @page { margin: 24px; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; text-align: center; padding: 32px; }
  .brand { font-size: 20px; font-weight: 800; color: #7C3AED; margin-bottom: 4px; }
  .heading { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #666; margin-bottom: 24px; }
  img { width: 320px; height: 320px; }
  .scan { margin-top: 24px; font-size: 16px; font-weight: 600; color: #111; }
</style>
</head>
<body>
  <div class="brand">Snippr</div>
  <div class="heading">Quick Booking</div>
  <img src="${printQr}" alt="Quick Booking QR code" />
  <div class="scan">Scan to book at ${safeSalonName}</div>
</body>
</html>`);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
    } catch {
      toast.error("Couldn't prepare the QR code for printing");
    }
  };

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="font-display text-xl font-bold text-foreground">Quick Booking QR</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Customers can scan this QR code with any phone camera to book an appointment at your salon.
        </p>

        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-muted/30 p-6 sm:flex-row sm:items-start">
          <div
            className="flex h-[240px] w-[240px] shrink-0 items-center justify-center rounded-xl bg-white p-3 shadow-sm"
            role="img"
            aria-label={`QR code for ${salonName}'s Quick Booking link`}
          >
            {displayQr ? (
              <img src={displayQr} alt={`QR code linking to ${bookingUrl}`} className="h-full w-full" width={DISPLAY_SIZE_PX} height={DISPLAY_SIZE_PX} />
            ) : (
              <div className="h-full w-full animate-pulse rounded-lg bg-muted" aria-hidden="true" />
            )}
          </div>

          <div className="flex w-full min-w-0 flex-col gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{salonName}</p>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">Scan to Quick Book</p>
            </div>

            <p className="break-all rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-muted-foreground">
              {bookingUrl}
            </p>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyLink}
                className="min-h-[44px] gap-2"
                aria-label="Copy booking link"
              >
                {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                Copy link
              </Button>
              <Button
                type="button"
                onClick={handleDownload}
                className="min-h-[44px] gap-2"
                aria-label="Download QR code as PNG"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Download QR
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handlePrint}
                className="min-h-[44px] gap-2"
                aria-label="Print QR code"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                Print
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
