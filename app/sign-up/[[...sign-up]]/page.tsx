import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="grid min-h-[calc(100vh-40px)] place-items-center px-4 py-6">
      <SignUp />
    </div>
  );
}
