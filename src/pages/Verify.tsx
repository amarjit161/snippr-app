import OTPVerification from "@/components/OTPVerification";

const Verify = () => {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_10%,_rgba(109,40,217,0.2),_transparent_35%),radial-gradient(circle_at_84%_16%,_rgba(249,115,22,0.2),_transparent_38%)]" />
      <div className="relative w-full max-w-[440px]">
        <OTPVerification />
      </div>
    </div>
  );
};

export default Verify;

