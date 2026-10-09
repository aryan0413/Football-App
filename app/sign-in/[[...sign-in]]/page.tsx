import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="grid min-h-[calc(100vh-40px)] place-items-center px-4 py-6">
      <SignIn />
    </div>
  );
}
