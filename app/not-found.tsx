import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#05080b] px-4">
      <div className="w-full max-w-md border-2 border-gold bg-[#0a0f14] p-6 text-center shadow-[8px_8px_0_#05080b]">
        <p className="font-pixel text-[0.6rem] text-gold">404 · JALAN BUNTU</p>
        <h1 className="mt-3 font-pixel text-base text-bone">Lorong ini tidak ada di peta</h1>
        <p className="mt-3 text-sm leading-6 text-ash">
          Mungkin tautannya salah, atau run ini sudah ditutup.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block border-2 border-gold bg-gold px-4 py-2 font-pixel text-[0.6rem] text-void"
        >
          KEMBALI KE GERBANG
        </Link>
      </div>
    </main>
  );
}
