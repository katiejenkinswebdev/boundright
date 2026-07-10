import { UpdatePasswordForm } from "./UpdatePasswordForm";

export default function UpdatePasswordPage() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-md rounded-lg border border-line bg-card p-8">
        <h1 className="mb-6 text-2xl font-semibold">Choose a new password</h1>
        <UpdatePasswordForm />
      </div>
    </main>
  );
}
