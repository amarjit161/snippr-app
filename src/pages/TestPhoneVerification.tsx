import { useState } from "react";
import SignInButton from "@/components/SignInButton";
import PhoneEmailVerification from "@/components/PhoneEmailVerification";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, CheckCircle, AlertCircle, Code } from "lucide-react";

const CONFIGURED_CLIENT_ID = import.meta.env.VITE_PHONE_EMAIL_CLIENT_ID || "15695407177920574360";

export default function TestPhoneVerification() {
  const [simpleResult, setSimpleResult] = useState<string>("");
  const [fullResult, setFullResult] = useState<string>("");

  const handleSimpleStart = () => {
    setSimpleResult("🔄 Waiting for verification...");
  };

  const handleFullSuccess = (data: any) => {
    setFullResult(`✅ Success! Phone: ${data.phone_number}`);
  };

  const handleFullError = (error: any) => {
    setFullResult(`❌ Error: ${error}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Phone className="w-8 h-8 text-blue-600" />
            <h1 className="text-4xl font-bold text-slate-900">
              phone.email Integration Test
            </h1>
          </div>
          <p className="text-slate-600">
            Test both component variants and verify backend integration
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="simple" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="simple">Simple Button</TabsTrigger>
            <TabsTrigger value="full">Full Component</TabsTrigger>
            <TabsTrigger value="api">Backend Test</TabsTrigger>
          </TabsList>

          {/* Simple Button Tab */}
          <TabsContent value="simple">
            <Card>
              <CardHeader>
                <CardTitle>SignInButton (Simple)</CardTitle>
                <CardDescription>
                  Minimal implementation using official phone.email pattern
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900 font-medium mb-2">Test Instructions:</p>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Click the phone.email button below</li>
                    <li>Enter a valid phone number</li>
                    <li>Verify via SMS/call</li>
                    <li>Check the result message below</li>
                    <li>Check browser console for debug output</li>
                  </ol>
                </div>

                {/* SignInButton Component */}
                <div className="flex justify-center p-6 bg-slate-50 border border-slate-200 rounded-lg">
                  <SignInButton
                    clientId={CONFIGURED_CLIENT_ID}
                    onVerificationStart={handleSimpleStart}
                  />
                </div>

                {/* Result */}
                {simpleResult && (
                  <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-amber-900">{simpleResult}</p>
                  </div>
                )}

                {/* Code Reference */}
                <div className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto">
                  <div className="flex items-center gap-2 mb-3">
                    <Code className="w-4 h-4" />
                    <span className="text-xs font-semibold text-slate-400">Usage</span>
                  </div>
                  <pre className="text-xs font-mono">
{`import SignInButton from "@/components/SignInButton";

<SignInButton 
  clientId="15695407177920574360"
  onVerificationStart={() => console.log("Started")}
/>`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Full Component Tab */}
          <TabsContent value="full">
            <Card>
              <CardHeader>
                <CardTitle>PhoneEmailVerification (Full)</CardTitle>
                <CardDescription>
                  Complete component with UI, error handling, and redirect
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-900 font-medium mb-2">What to expect:</p>
                  <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
                    <li>Green phone icon at the top</li>
                    <li>Loading spinner while verifying</li>
                    <li>Success message with verified phone number</li>
                    <li>Stores phone in localStorage</li>
                    <li>Auto-redirects to /dashboard on success</li>
                  </ul>
                </div>

                {/* PhoneEmailVerification Component */}
                <div className="flex justify-center p-6 bg-slate-50 border border-slate-200 rounded-lg">
                  <PhoneEmailVerification
                    clientId={CONFIGURED_CLIENT_ID}
                    onSuccess={handleFullSuccess}
                    onError={handleFullError}
                    autoRedirect={false}
                  />
                </div>

                {/* Result */}
                {fullResult && (
                  <div className="flex items-start gap-3 p-4 bg-slate-100 border border-slate-300 rounded-lg">
                    {fullResult.includes("✅") ? (
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    )}
                    <p className="text-slate-900 font-medium">{fullResult}</p>
                  </div>
                )}

                {/* Code Reference */}
                <div className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto">
                  <div className="flex items-center gap-2 mb-3">
                    <Code className="w-4 h-4" />
                    <span className="text-xs font-semibold text-slate-400">Usage</span>
                  </div>
                  <pre className="text-xs font-mono">
{`import PhoneEmailVerification from "@/components/PhoneEmailVerification";

<PhoneEmailVerification
  clientId="15695407177920574360"
  onSuccess={(data) => console.log(data.phone_number)}
  onError={(error) => console.error(error)}
  autoRedirect={true}
/>`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Test Tab */}
          <TabsContent value="api">
            <Card>
              <CardHeader>
                <CardTitle>Backend Endpoint Test</CardTitle>
                <CardDescription>
                  POST /api/verify-phone-email - Test the backend verification
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-sm text-purple-900 font-medium mb-2">Test with PowerShell:</p>
                  <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded overflow-x-auto">
{`$body = @{
  user_json_url = "https://user.phone.email/user_XXXX.json"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:5173/api/verify-phone-email" \
  -Method POST \
  -Headers @{"Content-Type"="application/json"} \
  -Body $body -UseBasicParsing | Select-Object -Property StatusCode, Content`}
                  </pre>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-slate-900">Expected Response:</h3>
                  <div className="bg-slate-900 text-slate-100 p-4 rounded overflow-x-auto">
                    <pre className="text-xs font-mono">
{`{
  "phone_number": "+1234567890",
  "country_code": "US",
  "verified": true,
  "message": "Phone verified successfully"
}`}
                    </pre>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-slate-900">Steps:</h3>
                  <ol className="space-y-2">
                    <li className="flex gap-3">
                      <span className="font-semibold text-blue-600 flex-shrink-0">1.</span>
                      <span className="text-slate-700">Verify /api/verify-phone-email exists</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-semibold text-blue-600 flex-shrink-0">2.</span>
                      <span className="text-slate-700">Complete verification above to get user_json_url</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-semibold text-blue-600 flex-shrink-0">3.</span>
                      <span className="text-slate-700">Copy the URL and test with PowerShell (within 5 minutes)</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-semibold text-blue-600 flex-shrink-0">4.</span>
                      <span className="text-slate-700">Check status code is 200 and phone_number is correct</span>
                    </li>
                  </ol>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-900">
                    <strong>Note:</strong> The user_json_url is only valid for ~5 minutes. Test quickly after verification above.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer Info */}
        <div className="mt-8 p-6 bg-slate-100 border border-slate-300 rounded-lg">
          <h3 className="font-semibold text-slate-900 mb-3">Debug Info</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-600">Phone.email Enabled:</p>
              <p className="font-mono text-slate-900">{import.meta.env.VITE_PHONE_EMAIL_ENABLED || "false"}</p>
            </div>
            <div>
              <p className="text-slate-600">Client ID:</p>
              <p className="font-mono text-slate-900">{CONFIGURED_CLIENT_ID}</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 mt-4">
            Open browser DevTools (F12) → Console to see detailed debug messages
          </p>
        </div>
      </div>
    </div>
  );
}
